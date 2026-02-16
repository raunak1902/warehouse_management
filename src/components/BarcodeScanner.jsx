import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { deviceApi } from '../api/deviceApi'
import {
  ScanBarcode,
  X,
  Check,
  AlertCircle,
  Package,
  Smartphone,
  Monitor,
  LayoutGrid,
  Loader2,
  Camera,
  Zap,
} from 'lucide-react'

/**
 * BarcodeScanner with JSON QR code support
 * Handles both plain barcodes and JSON-encoded QR codes
 */
const BarcodeScanner = ({ onClose, onDeviceFound }) => {
  const [scannerActive, setScannerActive] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const [scannedDevice, setScannedDevice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanHistory, setScanHistory] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState('')

  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)

  // Initialize ZXing code reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader()
    console.log('ZXing BarcodeReader initialized')
    
    return () => {
      stopCamera()
    }
  }, [])

  // Parse barcode - handle both JSON and plain text
  const parseBarcodeData = (scannedText) => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(scannedText)
      
      // If it's JSON with barcode field, use that
      if (parsed.barcode) {
        console.log('Detected JSON QR code, extracting barcode:', parsed.barcode)
        return {
          barcode: parsed.barcode,
          isJson: true,
          fullData: parsed
        }
      }
      
      // If JSON but no barcode field, use the whole thing as string
      return {
        barcode: scannedText,
        isJson: false,
        fullData: null
      }
    } catch (e) {
      // Not JSON, use as-is
      console.log('Plain text barcode:', scannedText)
      return {
        barcode: scannedText,
        isJson: false,
        fullData: null
      }
    }
  }

  // Start camera and barcode scanning with ZXing
  const startCamera = async () => {
    try {
      setError(null)
      setIsScanning(true)
      
      console.log('Starting ZXing barcode scanner...')
      
      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      console.log('Available cameras:', videoDevices.length)
      
      if (videoDevices.length === 0) {
        setError('No camera found on this device')
        setIsScanning(false)
        return
      }

      // Select camera (prefer back camera on mobile)
      const selectedDevice = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('environment')
      ) || videoDevices[0]

      console.log('Selected camera:', selectedDevice.label || 'Default camera')

      // Start continuous decoding from video device
      await codeReaderRef.current.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedText = result.getText()
            
            // Prevent duplicate scans
            if (scannedText !== lastScannedCode) {
              console.log('✅ QR/Barcode detected:', scannedText)
              setLastScannedCode(scannedText)
              
              // Parse the barcode (handle JSON)
              const { barcode, isJson, fullData } = parseBarcodeData(scannedText)
              
              console.log('Parsed barcode:', barcode)
              if (isJson) {
                console.log('Full QR data:', fullData)
              }
              
              // Stop scanning and fetch device
              stopCamera()
              fetchDeviceByBarcode(barcode)
            }
          }
          
          // Ignore NotFoundException - just means no barcode in frame
          if (error && !(error instanceof NotFoundException)) {
            console.error('Scan error:', error)
          }
        }
      )

      setScannerActive(true)
      console.log('Scanner active - point camera at barcode/QR code')
      
    } catch (err) {
      console.error('Camera start error:', err)
      setError(`Failed to start camera: ${err.message}`)
      setIsScanning(false)
      setScannerActive(false)
    }
  }

  // Stop camera and scanner
  const stopCamera = () => {
    console.log('Stopping scanner...')
    
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
    }
    
    setScannerActive(false)
    setIsScanning(false)
    setLastScannedCode('')
  }

  // Fetch device by barcode from backend
  const fetchDeviceByBarcode = async (barcode) => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching device with barcode:', barcode)
      const device = await deviceApi.getByBarcode(barcode)
      
      console.log('Device found:', device)
      setScannedDevice(device)
      setScannedBarcode(barcode)
      
      setScanHistory(prev => [{
        barcode,
        deviceCode: device.code,
        timestamp: new Date().toISOString(),
        found: true
      }, ...prev.slice(0, 9)])
      
      if (onDeviceFound) {
        onDeviceFound(device)
      }
    } catch (err) {
      console.error('Device lookup error:', err)
      setError(`Device not found with barcode: ${barcode}`)
      
      setScanHistory(prev => [{
        barcode,
        timestamp: new Date().toISOString(),
        found: false
      }, ...prev.slice(0, 9)])
    } finally {
      setLoading(false)
    }
  }

  const handleManualEntry = () => {
    if (manualBarcode.trim()) {
      const { barcode } = parseBarcodeData(manualBarcode.trim())
      fetchDeviceByBarcode(barcode.toUpperCase())
      setManualBarcode('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualEntry()
    }
  }

  const resetScanner = () => {
    setScannedDevice(null)
    setScannedBarcode('')
    setManualBarcode('')
    setError(null)
    setLastScannedCode('')
  }

  const getDeviceIcon = (type) => {
    const icons = {
      tv: Monitor,
      tablet: Smartphone,
      stand: LayoutGrid,
      istand: Monitor,
    }
    return icons[type] || Package
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScanBarcode className="w-7 h-7" />
              <div>
                <h2 className="text-2xl font-bold">Barcode Scanner</h2>
                <p className="text-blue-100 text-sm">
                  {isScanning ? 'Scanning for barcode...' : 'Scan or enter device barcode'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Camera Scanner */}
          {!scannedDevice && (
            <div className="space-y-4">
              {/* Camera View */}
              <div className="relative border-4 border-blue-500 rounded-xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-auto"
                  style={{
                    minHeight: '300px',
                    maxHeight: '500px',
                    backgroundColor: '#000',
                    display: 'block',
                    objectFit: 'contain'
                  }}
                />
                
                {/* Scanning overlay */}
                {scannerActive && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative">
                        {/* Target box */}
                        <div className="w-64 h-64 border-4 border-green-500 rounded-lg shadow-lg">
                          {/* Corner markers */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
                        </div>
                        
                        {/* Scanning line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 animate-scan shadow-lg"></div>
                      </div>
                    </div>
                    
                    {/* Status badge */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
                      <Zap className="w-4 h-4 animate-pulse" />
                      Scanning...
                    </div>
                  </>
                )}
                
                {!scannerActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                      <ScanBarcode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 font-medium">Camera not active</p>
                      <p className="text-gray-500 text-sm mt-2">Click "Start Scanner" below</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex gap-3">
                {!scannerActive ? (
                  <button
                    onClick={startCamera}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                  >
                    <Camera className="w-5 h-5" />
                    Start Scanner
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 font-medium transition-all shadow-lg"
                  >
                    <X className="w-5 h-5 inline mr-2" />
                    Stop Scanner
                  </button>
                )}
              </div>

              {/* Instructions */}
              {scannerActive && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm text-gray-900 font-medium mb-2">
                    📸 How to scan:
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>Point camera at QR code or barcode</li>
                    <li>Keep barcode inside the green box</li>
                    <li>Hold steady - detection is automatic</li>
                    <li>Make sure barcode is well-lit and in focus</li>
                  </ul>
                </div>
              )}

              {/* Manual Entry */}
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or enter barcode manually:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="EDSG-TV-12345678-A1B2"
                    disabled={loading}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono disabled:opacity-50"
                  />
                  <button
                    onClick={handleManualEntry}
                    disabled={!manualBarcode.trim() || loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Search
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Device Found - BEAUTIFUL UI */}
          {scannedDevice && (
            <div className="space-y-6 animate-fadeIn">
              {/* Success Banner with Animation */}
              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl flex items-center gap-4 shadow-lg">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center animate-bounce">
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-green-900 mb-1">Device Found!</p>
                  <p className="text-sm text-green-700 font-mono bg-white/50 px-3 py-1 rounded inline-block">
                    {scannedBarcode}
                  </p>
                </div>
              </div>

              {/* Device Information Card */}
              <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-2xl border-2 border-blue-200 p-6 shadow-xl">
                <div className="flex items-start gap-4 mb-6">
                  {(() => {
                    const Icon = getDeviceIcon(scannedDevice.type)
                    return (
                      <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Icon className="w-10 h-10 text-white" />
                      </div>
                    )
                  })()}
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{scannedDevice.code}</h3>
                    <p className="text-lg text-gray-600 capitalize font-medium">{scannedDevice.type}</p>
                  </div>
                </div>

                {/* Device Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {scannedDevice.brand && (
                    <div className="bg-white/80 p-4 rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-500 font-medium mb-1">Brand</p>
                      <p className="font-bold text-gray-900 text-lg">{scannedDevice.brand}</p>
                    </div>
                  )}
                  {scannedDevice.model && (
                    <div className="bg-white/80 p-4 rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-500 font-medium mb-1">Model</p>
                      <p className="font-bold text-gray-900 text-lg">{scannedDevice.model}</p>
                    </div>
                  )}
                  {scannedDevice.size && (
                    <div className="bg-white/80 p-4 rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-500 font-medium mb-1">Size</p>
                      <p className="font-bold text-gray-900 text-lg">{scannedDevice.size}</p>
                    </div>
                  )}
                  <div className="bg-white/80 p-4 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
                    <p className="font-bold text-gray-900 text-lg capitalize">{scannedDevice.lifecycleStatus}</p>
                  </div>
                  {scannedDevice.location && (
                    <div className="bg-white/80 p-4 rounded-xl border border-gray-200 col-span-2">
                      <p className="text-xs text-gray-500 font-medium mb-1">Location</p>
                      <p className="font-bold text-gray-900 text-lg">{scannedDevice.location}</p>
                    </div>
                  )}
                  {scannedDevice.client && (
                    <div className="bg-white/80 p-4 rounded-xl border border-gray-200 col-span-2">
                      <p className="text-xs text-gray-500 font-medium mb-1">Assigned To</p>
                      <p className="font-bold text-gray-900 text-lg">{scannedDevice.client.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all text-lg"
                >
                  Scan Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-semibold transition-all shadow-lg text-lg"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Scan History */}
          {scanHistory.length > 0 && !scannedDevice && (
            <div className="border-t-2 border-gray-200 pt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Recent Scans</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {scanHistory.map((scan, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 ${
                      scan.found
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <code className="font-mono text-xs">{scan.barcode}</code>
                      <span className={`font-medium ${
                        scan.found ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {scan.found ? '✓ Found' : '✗ Not Found'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Animations CSS */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(256px); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}

export default BarcodeScanner
