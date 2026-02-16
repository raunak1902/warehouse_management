import { useState, useEffect, useRef } from 'react'
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
  Info,
  Loader2,
} from 'lucide-react'

/**
 * Updated BarcodeScanner Component
 * Scans barcode and shows device information
 */
const BarcodeScanner = ({ onClose, onDeviceFound }) => {
  // Scanner state
  const [scannerActive, setScannerActive] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const [scannedDevice, setScannedDevice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanHistory, setScanHistory] = useState([])

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Initialize camera for barcode scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      setScannerActive(true)
      setError(null)
    } catch (err) {
      setError('Camera access denied. Please use manual entry.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setScannerActive(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  // Fetch device by barcode from backend
  const fetchDeviceByBarcode = async (barcode) => {
    setLoading(true)
    setError(null)
    
    try {
      const device = await deviceApi.getByBarcode(barcode)
      setScannedDevice(device)
      setScannedBarcode(barcode)
      
      // Add to scan history
      setScanHistory(prev => [{
        barcode,
        deviceCode: device.code,
        timestamp: new Date().toISOString(),
        found: true
      }, ...prev.slice(0, 9)])
      
      stopCamera()
      
      // Notify parent component
      if (onDeviceFound) {
        onDeviceFound(device)
      }
    } catch (err) {
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
      fetchDeviceByBarcode(manualBarcode.trim().toUpperCase())
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
                <p className="text-blue-100 text-sm">Scan or enter device barcode</p>
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
              <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                {scannerActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ScanBarcode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">Camera not active</p>
                    </div>
                  </div>
                )}
                
                {/* Scanner overlay */}
                {scannerActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-4 border-blue-500 rounded-lg"></div>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex gap-3">
                {!scannerActive ? (
                  <button
                    onClick={startCamera}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ScanBarcode className="w-5 h-5" />
                    Start Camera
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
                    Stop Camera
                  </button>
                )}
              </div>

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
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Scan
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

          {/* Device Found */}
          {scannedDevice && (
            <div className="space-y-6">
              {/* Success Banner */}
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-3">
                <Check className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-900">Device Found!</p>
                  <p className="text-sm text-green-700">Barcode: {scannedBarcode}</p>
                </div>
              </div>

              {/* Device Information Card */}
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border-2 border-blue-200 p-6">
                <div className="flex items-start gap-4 mb-4">
                  {(() => {
                    const Icon = getDeviceIcon(scannedDevice.type)
                    return <Icon className="w-12 h-12 text-blue-600" />
                  })()}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{scannedDevice.code}</h3>
                    <p className="text-gray-600 capitalize">{scannedDevice.type}</p>
                  </div>
                </div>

                {/* Device Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {scannedDevice.brand && (
                    <div>
                      <p className="text-gray-600">Brand</p>
                      <p className="font-bold text-gray-900">{scannedDevice.brand}</p>
                    </div>
                  )}
                  {scannedDevice.model && (
                    <div>
                      <p className="text-gray-600">Model</p>
                      <p className="font-bold text-gray-900">{scannedDevice.model}</p>
                    </div>
                  )}
                  {scannedDevice.size && (
                    <div>
                      <p className="text-gray-600">Size</p>
                      <p className="font-bold text-gray-900">{scannedDevice.size}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600">Status</p>
                    <p className="font-bold text-gray-900 capitalize">{scannedDevice.lifecycleStatus}</p>
                  </div>
                  {scannedDevice.location && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Location</p>
                      <p className="font-bold text-gray-900">{scannedDevice.location}</p>
                    </div>
                  )}
                  {scannedDevice.client && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Assigned To</p>
                      <p className="font-bold text-gray-900">{scannedDevice.client.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={resetScanner}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Scan Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Scan History */}
          {scanHistory.length > 0 && (
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
                      <code className="font-mono">{scan.barcode}</code>
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
    </div>
  )
}

export default BarcodeScanner