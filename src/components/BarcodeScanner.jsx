import { useState, useRef, useEffect } from 'react'
import { Camera, X, Search, Loader2, AlertCircle } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import BarcodeResultCard from './BarcodeResultCard'

/**
 * BarcodeScanner
 * ─────────────────────────────────────────────────────────────
 * Two modes:
 *  1. Camera mode — uses device camera via jsQR to scan QR codes
 *  2. Manual mode — type/paste barcode or device code directly
 *
 * On every scan, device data is fetched LIVE from the API
 * (never from local context cache) so status is always current.
 */
const BarcodeScanner = ({ onClose }) => {
  const { scanDevice } = useInventory()

  const [mode, setMode]       = useState('manual') // 'camera' | 'manual'
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [device, setDevice]   = useState(null)

  // Camera refs
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const rafRef     = useRef(null)

  // ── Camera lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (mode === 'camera') startCamera()
    return () => stopCamera()
  }, [mode])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        rafRef.current = requestAnimationFrame(scanFrame)
      }
    } catch (e) {
      setError('Camera access denied. Please allow camera access or use manual entry.')
      setMode('manual')
    }
  }

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }
    const ctx = canvas.getContext('2d')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Dynamically import jsQR only when camera is used
    try {
      const jsQR = (await import('jsqr')).default
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        stopCamera()
        await handleBarcodeDetected(code.data)
        return
      }
    } catch (e) {
      // jsQR not available — fall back to manual
      setError('QR scanning library not loaded. Please use manual entry.')
      setMode('manual')
      return
    }
    rafRef.current = requestAnimationFrame(scanFrame)
  }

  // ── Lookup ────────────────────────────────────────────────
  const handleBarcodeDetected = async (raw) => {
    setLoading(true)
    setError(null)
    try {
      // QR data might be a JSON payload {barcode, deviceCode, ...}
      let barcode = raw
      try {
        const parsed = JSON.parse(raw)
        barcode = parsed.barcode || parsed.deviceCode || raw
      } catch {}

      // ALWAYS fetch live from API — never read from context cache
      const result = await scanDevice(barcode)
      setDevice(result)
    } catch (e) {
      setError(e.message || 'Device not found')
      setDevice(null)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    handleBarcodeDetected(input.trim())
  }

  const handleDeviceUpdated = (updatedDevice) => {
    // When an action is taken inside BarcodeResultCard, update local state
    setDevice(updatedDevice)
  }

  // ── Render ────────────────────────────────────────────────
  if (device) {
    return (
      <BarcodeResultCard
        key={device.barcode || device.id}
        device={device}
        onClose={onClose}
        onDeviceUpdated={handleDeviceUpdated}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary-600" />
            Scan Device
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-3 border-b border-gray-100">
          {[
            { id: 'camera', label: '📷 Camera' },
            { id: 'manual', label: '⌨️ Manual' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setError(null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m.id ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* Camera view */}
          {mode === 'camera' && (
            <div className="relative">
              <video ref={videoRef} className="w-full rounded-xl bg-black" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/60 rounded-xl" />
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">Point camera at QR code</p>
            </div>
          )}

          {/* Manual input */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSearch} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barcode or Device Code
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="e.g. EDSG-TV-12345678-ABCD or TV-001"
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Looking up…</>
                  : <><Search className="w-4 h-4" />Find Device</>
                }
              </button>
            </form>
          )}

          {/* Loading (camera mode) */}
          {loading && mode === 'camera' && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Looking up device…
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner