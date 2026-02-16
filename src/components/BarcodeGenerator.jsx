import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Printer, Copy, Check, X } from 'lucide-react'

/**
 * BarcodeGenerator Component
 * Displays barcode as QR code with device information
 * Allows printing and downloading
 */
const BarcodeGenerator = ({ device, onClose }) => {
  const [copied, setCopied] = useState(false)

  const barcodeData = JSON.stringify({
    barcode: device.barcode,
    deviceCode: device.code,
    type: device.type,
    brand: device.brand,
    model: device.model,
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(device.barcode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    const svg = document.getElementById('barcode-qr')
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    canvas.width = 300
    canvas.height = 300

    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, 300, 300)
      
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `barcode_${device.code}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Device Barcode</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* QR Code Display */}
        <div className="p-8 space-y-6">
          {/* QR Code */}
          <div className="flex justify-center p-6 bg-gray-50 rounded-xl">
            <QRCodeSVG
              id="barcode-qr"
              value={barcodeData}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Device Info */}
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Device Code:</p>
                  <p className="font-bold text-gray-900">{device.code}</p>
                </div>
                <div>
                  <p className="text-gray-600">Type:</p>
                  <p className="font-bold text-gray-900 capitalize">{device.type}</p>
                </div>
                {device.brand && (
                  <div>
                    <p className="text-gray-600">Brand:</p>
                    <p className="font-bold text-gray-900">{device.brand}</p>
                  </div>
                )}
                {device.model && (
                  <div>
                    <p className="text-gray-600">Model:</p>
                    <p className="font-bold text-gray-900">{device.model}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Barcode String */}
            <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
              <p className="text-xs text-gray-600 mb-1">Barcode:</p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono text-gray-900">{device.barcode}</code>
                <button
                  onClick={handleCopy}
                  className="ml-2 p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Copy barcode"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              Download
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
          </div>

          {/* Print Instructions */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Tip:</strong> Print this barcode and attach it to the physical device for easy scanning.
            </p>
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #barcode-qr,
          #barcode-qr * {
            visibility: visible;
          }
          #barcode-qr {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  )
}

export default BarcodeGenerator
