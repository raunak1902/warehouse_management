import { useState, useEffect, useRef } from 'react'
import { useInventory } from '../context/InventoryContext'
import {
  ScanBarcode,
  X,
  Check,
  AlertCircle,
  Package,
  Truck,
  Warehouse,
  User,
  MapPin,
  Camera,
  Info,
  ArrowRight,
  CheckCircle,
  XCircle,
  Smartphone,
  Monitor,
  LayoutGrid,
  Clock,
  Calendar,
  Zap,
} from 'lucide-react'

const BarcodeScanner = ({ onClose }) => {
  const {
    devices,
    clients,
    updateDevice,
    getClientById,
  } = useInventory()

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [scannedDevice, setScannedDevice] = useState(null)
  const [scanHistory, setScanHistory] = useState([])

  // Action state
  const [action, setAction] = useState('') // 'deploy' or 'warehouse'
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [deploymentLocation, setDeploymentLocation] = useState({
    state: '',
    district: '',
    location: ''
  })

  // UI state
  const [processing, setProcessing] = useState(false)
  const [notification, setNotification] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const warehouses = ['Warehouse A', 'Warehouse B', 'Warehouse C']

  // States for deployment location dropdown
  const indianStates = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Haryana', 'Gujarat', 'Rajasthan', 'Uttar Pradesh']

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
    } catch (error) {
      showNotification('error', 'Camera access denied. Please use manual entry.')
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

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleScan = (code) => {
    const device = devices.find(d => d.code === code.toUpperCase())
    
    if (device) {
      setScannedDevice(device)
      setScannedCode(code)
      
      // Add to scan history
      setScanHistory(prev => [{
        code,
        timestamp: new Date().toISOString(),
        deviceType: device.type,
        found: true
      }, ...prev.slice(0, 9)]) // Keep last 10 scans
      
      stopCamera()
      showNotification('success', `Device ${code} found!`)
    } else {
      showNotification('error', `Device ${code} not found in inventory`)
      setScanHistory(prev => [{
        code,
        timestamp: new Date().toISOString(),
        found: false
      }, ...prev.slice(0, 9)])
    }
  }

  const handleManualEntry = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
      setManualCode('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualEntry()
    }
  }

  const resetScanner = () => {
    setScannedDevice(null)
    setScannedCode('')
    setAction('')
    setSelectedClient('')
    setSelectedWarehouse('')
    setDeploymentLocation({ state: '', district: '', location: '' })
    setManualCode('')
  }

  const canProceed = () => {
    if (!action) return false
    
    if (action === 'deploy') {
      return selectedClient && deploymentLocation.state && deploymentLocation.location
    }
    
    if (action === 'warehouse') {
      return selectedWarehouse
    }
    
    return false
  }

  const handleSubmit = async () => {
    if (!canProceed()) return
    
    setProcessing(true)
    
    try {
      const updates = {
        lifecycleStatus: action === 'deploy' ? 'deployed' : 'warehouse',
      }
      
      if (action === 'deploy') {
        updates.clientId = parseInt(selectedClient)
        updates.state = deploymentLocation.state
        updates.district = deploymentLocation.district
        updates.location = deploymentLocation.location
        updates.subscriptionStart = new Date().toISOString().split('T')[0]
        // Set subscription end to 6 months from now by default
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 6)
        updates.subscriptionEnd = endDate.toISOString().split('T')[0]
      } else {
        updates.clientId = null
        updates.state = ''
        updates.district = ''
        updates.location = selectedWarehouse
        updates.subscriptionStart = null
        updates.subscriptionEnd = null
      }
      
      updateDevice(scannedDevice.id, updates)
      
      const actionText = action === 'deploy' 
        ? `deployed to ${getClientById(parseInt(selectedClient))?.name}`
        : `added to ${selectedWarehouse}`
      
      showNotification('success', `Device ${scannedDevice.code} ${actionText}`)
      
      // Wait a moment then reset for next scan
      setTimeout(() => {
        resetScanner()
        setProcessing(false)
      }, 1500)
      
    } catch (error) {
      showNotification('error', 'Failed to update device')
      setProcessing(false)
    }
  }

  const getDeviceIcon = (type) => {
    const icons = {
      tablet: Smartphone,
      tv: Monitor,
      stand: LayoutGrid,
      istand: Monitor,
    }
    return icons[type] || Package
  }

  const DeviceIcon = scannedDevice ? getDeviceIcon(scannedDevice.type) : Package

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 z-10 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <ScanBarcode className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Barcode Scanner</h2>
                <p className="text-green-100 text-sm">Track incoming and outgoing devices</p>
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

        {/* Notification */}
        {notification && (
          <div className={`mx-6 mt-4 p-4 rounded-lg border-2 flex items-center gap-3 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Scanner Section */}
          {!scannedDevice ? (
            <>
              {/* Quick Info Banner */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How to use:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Scan barcode using camera or enter code manually</li>
                      <li>Choose action: Deploy to client or Add to warehouse</li>
                      <li>Fill in required details and confirm</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Camera Scanner */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border-2 border-gray-200">
                <div className="text-center">
                  {!scannerActive ? (
                    <div className="space-y-4">
                      <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <Camera className="w-10 h-10 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Camera Scanner
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Use your device camera to scan barcodes quickly
                        </p>
                        <button
                          onClick={startCamera}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors inline-flex items-center gap-2 shadow-md hover:shadow-lg"
                        >
                          <Camera className="w-5 h-5" />
                          Start Camera
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full max-w-md mx-auto rounded-lg border-4 border-green-500 shadow-lg"
                      />
                      <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                        <Zap className="w-4 h-4 animate-pulse" />
                        <span className="font-medium">Ready to scan</span>
                      </div>
                      <button
                        onClick={stopCamera}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-md"
                      >
                        Stop Camera
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Entry */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Manual Entry</h3>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter device code (e.g., ATV-001, TAB-003, ITV-002)"
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg"
                  />
                  <button
                    onClick={handleManualEntry}
                    disabled={!manualCode.trim()}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Tip: Press Enter to scan quickly
                </p>
              </div>

              {/* Scan History */}
              {scanHistory.length > 0 && (
                <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    Recent Scans
                  </h3>
                  <div className="space-y-2">
                    {scanHistory.slice(0, 5).map((scan, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                          scan.found 
                            ? 'bg-green-50 border border-green-200 hover:shadow-md' 
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {scan.found ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-red-600" />
                          )}
                          <span className="font-mono font-semibold text-gray-900">{scan.code}</span>
                          {scan.deviceType && (
                            <span className="text-sm px-2 py-1 bg-white rounded text-gray-600 border">
                              {scan.deviceType}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(scan.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Device Details & Action Selection */
            <>
              {/* Scanned Device Info */}
              <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border-2 border-green-300 p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Device Found</h3>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <DeviceIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-gray-900 font-mono mb-2">
                        {scannedDevice.code}
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium px-2 py-1 bg-blue-50 rounded text-blue-700">
                            {scannedDevice.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Brand:</span>
                          <span className="font-medium">{scannedDevice.brand || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Model:</span>
                          <span className="font-medium">{scannedDevice.model || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Size:</span>
                          <span className="font-medium">{scannedDevice.size || 'N/A'}</span>
                        </div>
                      </div>
                      
                      {/* Current Status */}
                      <div className="p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600 mb-2 font-medium">CURRENT STATUS</p>
                        <div className="flex items-center gap-2">
                          {scannedDevice.clientId ? (
                            <>
                              <User className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium">
                                Deployed to {getClientById(scannedDevice.clientId)?.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <Warehouse className="w-4 h-4 text-orange-600" />
                              <span className="text-sm font-medium">
                                In {scannedDevice.location || 'Warehouse'}
                              </span>
                            </>
                          )}
                        </div>
                        {scannedDevice.subscriptionEnd && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                            <Calendar className="w-3 h-3" />
                            <span>Subscription until: {scannedDevice.subscriptionEnd}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-green-600" />
                  Select Action
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Deploy Option */}
                  <button
                    onClick={() => setAction('deploy')}
                    className={`p-6 rounded-xl border-2 transition-all text-left group ${
                      action === 'deploy'
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-102'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg transition-colors ${action === 'deploy' ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-50'}`}>
                          <Truck className={`w-6 h-6 ${action === 'deploy' ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Deploy to Client</h4>
                          <p className="text-sm text-gray-600">Assign to client location</p>
                        </div>
                      </div>
                      {action === 'deploy' && (
                        <Check className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </button>

                  {/* Warehouse Option */}
                  <button
                    onClick={() => setAction('warehouse')}
                    className={`p-6 rounded-xl border-2 transition-all text-left group ${
                      action === 'warehouse'
                        ? 'border-orange-500 bg-orange-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-orange-300 hover:shadow-md hover:scale-102'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg transition-colors ${action === 'warehouse' ? 'bg-orange-100' : 'bg-gray-100 group-hover:bg-orange-50'}`}>
                          <Warehouse className={`w-6 h-6 ${action === 'warehouse' ? 'text-orange-600' : 'text-gray-600 group-hover:text-orange-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Add to Warehouse</h4>
                          <p className="text-sm text-gray-600">Return to storage</p>
                        </div>
                      </div>
                      {action === 'warehouse' && (
                        <Check className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Deploy Details */}
              {action === 'deploy' && (
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border-2 border-blue-200 p-6 space-y-4 shadow-md">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Deployment Details
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Client *
                    </label>
                    <select
                      value={selectedClient}
                      onChange={(e) => setSelectedClient(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">-- Select Client --</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.company ? `- ${client.company}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State *
                      </label>
                      <select
                        value={deploymentLocation.state}
                        onChange={(e) => setDeploymentLocation({...deploymentLocation, state: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Select State</option>
                        {indianStates.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        District
                      </label>
                      <input
                        type="text"
                        value={deploymentLocation.district}
                        onChange={(e) => setDeploymentLocation({...deploymentLocation, district: e.target.value})}
                        placeholder="e.g., Mumbai"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location *
                      </label>
                      <input
                        type="text"
                        value={deploymentLocation.location}
                        onChange={(e) => setDeploymentLocation({...deploymentLocation, location: e.target.value})}
                        placeholder="e.g., Store 101, Mall A"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-100 rounded-lg border border-blue-300">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Device will be marked as deployed and subscription will be set for 6 months from today.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warehouse Details */}
              {action === 'warehouse' && (
                <div className="bg-gradient-to-br from-orange-50 to-white rounded-xl border-2 border-orange-200 p-6 space-y-4 shadow-md">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-orange-600" />
                    Warehouse Details
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Warehouse *
                    </label>
                    <select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                    >
                      <option value="">-- Select Warehouse --</option>
                      {warehouses.map(wh => (
                        <option key={wh} value={wh}>{wh}</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 bg-orange-100 rounded-lg border border-orange-300">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-orange-800">
                        <strong>Note:</strong> Device will be unassigned from any client, subscription cleared, and marked as available in warehouse.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={resetScanner}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-center gap-2">
                    <ScanBarcode className="w-5 h-5" />
                    Scan Another
                  </div>
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed() || processing}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-medium transition-all disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Confirm & Update
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner
