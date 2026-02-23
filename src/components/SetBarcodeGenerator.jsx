import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Printer, Copy, Check, X, Layers, Package, UserPlus } from 'lucide-react'
import AssignToClientModal from './AssignToClientModal'

const SetBarcodeGenerator = ({ set, onClose }) => {
  const [copied, setCopied] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)

  const qrData = JSON.stringify({
    barcode:     set.barcode,
    setCode:     set.code,
    setType:     set.setType,
    setTypeName: set.setTypeName,
    name:        set.name || null,
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(set.barcode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => window.print()

  const handleDownload = () => {
    const svg = document.getElementById('set-barcode-qr')
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
      const link = document.createElement('a')
      link.download = `set_barcode_${set.code}.png`
      link.href = pngFile
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  // Normalise set to look like a device for AssignToClientModal
  const setAsDevice = {
    ...set,
    _isSet: true,
    type: set.setTypeName || set.setType,
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >

          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white rounded-t-xl">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-600" />
              <h3 className="text-xl font-bold text-gray-900">Set Barcode</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Close">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">

            {/* QR Code */}
            <div className="flex justify-center p-6 bg-gray-50 rounded-xl">
              <QRCodeSVG
                id="set-barcode-qr"
                value={qrData}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Set Info */}
            <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Set Code</p>
                  <p className="font-bold text-gray-900">{set.code}</p>
                </div>
                <div>
                  <p className="text-gray-500">Type</p>
                  <p className="font-bold text-gray-900">{set.setTypeName}</p>
                </div>
                {set.name && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Name</p>
                    <p className="font-bold text-gray-900">{set.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Components</p>
                  <p className="font-bold text-gray-900">{set.components?.length ?? 0} items</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-bold text-gray-900 capitalize">{set.lifecycleStatus}</p>
                </div>
              </div>
            </div>

            {/* Barcode string */}
            <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
              <p className="text-xs text-gray-500 mb-1">Barcode</p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono text-gray-900 break-all">{set.barcode}</code>
                <button
                  onClick={handleCopy}
                  className="ml-2 p-2 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                  title="Copy barcode"
                >
                  {copied
                    ? <Check className="w-4 h-4 text-green-600" />
                    : <Copy className="w-4 h-4 text-gray-600" />
                  }
                </button>
              </div>
            </div>

            {/* Component list */}
            {set.components?.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Components
                </p>
                <div className="space-y-1">
                  {set.components.map(c => (
                    <p key={c.id} className="text-xs font-mono text-gray-700">
                      {c.code} <span className="text-gray-400">· {c.brand} {c.model} {c.size}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Assign to Client */}
            <button
              onClick={() => setShowAssignModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Assign to Client
            </button>

            {/* Actions */}
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

            <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <strong>Tip:</strong> Print and attach this QR code to the physical set packaging for easy scanning during deployment.
            </p>
          </div>
        </div>

        {/* Print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #set-barcode-qr, #set-barcode-qr * { visibility: visible; }
            #set-barcode-qr {
              position: absolute; left: 50%; top: 50%;
              transform: translate(-50%, -50%);
            }
          }
        `}</style>
      </div>

      {/* Assign to Client Modal */}
      {showAssignModal && (
        <AssignToClientModal
          device={setAsDevice}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false)
            onClose()
          }}
        />
      )}
    </>
  )
}

export default SetBarcodeGenerator