import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Printer, X, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * BulkBarcodeGenerator
 * Shown after a bulk-add operation completes.
 * Displays all N barcodes in a scrollable grid.
 * Print All: browser print (only QR grid visible).
 * Download All: downloads each QR as a PNG one by one — no external packages needed.
 */
const BulkBarcodeGenerator = ({ devices, onClose }) => {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  const handlePrintAll = () => {
    window.print()
  }

  // Convert a rendered SVG element to a PNG blob using canvas
  const svgToPngBlob = (svgEl) =>
    new Promise((resolve) => {
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const canvas = document.createElement('canvas')
      canvas.width = 300
      canvas.height = 300
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 300, 300)
        ctx.drawImage(img, 0, 0, 300, 300)
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      }
      img.onerror = () => resolve(null)
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
    })

  const handleDownloadAll = async () => {
    setDownloading(true)
    setDownloadProgress(0)
    try {
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i]
        const svgEl = document.getElementById(`bulk-qr-${i}`)
        if (!svgEl) continue

        const blob = await svgToPngBlob(svgEl)
        if (!blob) continue

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `barcode_${device.code}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        setDownloadProgress(i + 1)
        // Small delay so browser doesn't block multiple downloads
        await new Promise((r) => setTimeout(r, 120))
      }
    } catch (err) {
      console.error('Download failed:', err)
      alert('Some downloads may have failed. Try printing instead.')
    } finally {
      setDownloading(false)
      setDownloadProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {devices.length} Device{devices.length !== 1 ? 's' : ''} Added Successfully
              </h3>
              <p className="text-sm text-gray-500">
                All barcodes generated. Print or download them below.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 shrink-0 flex flex-wrap items-center gap-6 text-sm">
          <span className="text-gray-600">
            Type: <span className="font-semibold text-gray-900 capitalize">{devices[0]?.type}</span>
          </span>
          {devices[0]?.brand && (
            <span className="text-gray-600">
              Brand: <span className="font-semibold text-gray-900">{devices[0].brand}</span>
            </span>
          )}
          {devices[0]?.model && (
            <span className="text-gray-600">
              Model: <span className="font-semibold text-gray-900">{devices[0].model}</span>
            </span>
          )}
          <span className="text-gray-600">
            Codes:{' '}
            <span className="font-mono font-semibold text-gray-900">
              {devices[0]?.code} → {devices[devices.length - 1]?.code}
            </span>
          </span>
        </div>

        {/* Barcode grid — scrollable */}
        <div id="bulk-barcode-print-area" className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {devices.map((device, i) => {
              const barcodeData = JSON.stringify({
                barcode: device.barcode,
                deviceCode: device.code,
                type: device.type,
                brand: device.brand,
                model: device.model,
              })
              const isExpanded = expandedIndex === i

              return (
                <div
                  key={device.id}
                  className="border border-gray-200 rounded-lg p-3 flex flex-col items-center gap-2 hover:border-primary-300 hover:shadow-sm transition-all bulk-barcode-card"
                >
                  <QRCodeSVG
                    id={`bulk-qr-${i}`}
                    value={barcodeData}
                    size={120}
                    level="H"
                    includeMargin={true}
                  />
                  <p className="font-mono font-bold text-gray-900 text-xs">{device.code}</p>
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    {isExpanded ? 'Hide' : 'Details'}
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    <div className="w-full text-xs bg-gray-50 rounded p-2 space-y-1 border border-gray-100">
                      <p className="font-mono text-gray-600 break-all">{device.barcode}</p>
                      {device.brand && <p className="text-gray-500">Brand: {device.brand}</p>}
                      {device.model && <p className="text-gray-500">Model: {device.model}</p>}
                      {device.color && <p className="text-gray-500">Color: {device.color}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-gray-200 shrink-0">
          {downloading && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Downloading barcodes...</span>
                <span>{downloadProgress} / {devices.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(downloadProgress / devices.length) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {downloading
                ? `Downloading ${downloadProgress}/${devices.length}...`
                : `Download All (${devices.length} PNGs)`}
            </button>
            <button
              onClick={handlePrintAll}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              <Printer className="w-5 h-5" />
              Print All
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bulk-barcode-print-area,
          #bulk-barcode-print-area * { visibility: visible; }
          #bulk-barcode-print-area {
            position: fixed;
            top: 0; left: 0;
            width: 100%;
            overflow: visible !important;
          }
          .bulk-barcode-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}

export default BulkBarcodeGenerator