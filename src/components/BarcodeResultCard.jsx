import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Download, Printer, Copy, Check, X, MapPin, Activity,
  ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2,
  ArrowRight, RotateCcw, Truck, Package
} from 'lucide-react'
import { useInventory, LIFECYCLE, LIFECYCLE_LABELS, LIFECYCLE_COLORS, HEALTH_COLORS } from '../context/InventoryContext'

// ─────────────────────────────────────────────────────────────
// LIFECYCLE STATUS BADGE
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const colors = LIFECYCLE_COLORS[status] || LIFECYCLE_COLORS.warehouse
  const label  = LIFECYCLE_LABELS[status]  || status
  const isPending = status?.includes('_requested')

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${isPending ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// HEALTH BADGE (inline editable)
// ─────────────────────────────────────────────────────────────
const HealthBadge = ({ deviceId, current, onUpdated }) => {
  const { updateHealthStatus } = useInventory()
  const [open, setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const options = ['ok', 'repair', 'damage']
  const colors  = HEALTH_COLORS[current] || HEALTH_COLORS.ok

  const handleChange = async (val) => {
    if (val === current) { setOpen(false); return }
    setSaving(true)
    try {
      await updateHealthStatus(deviceId, val)
      onUpdated && onUpdated(val)
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-opacity ${colors.bg} ${colors.text} hover:opacity-80`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {saving ? 'Saving…' : colors.label}
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          {options.map(opt => {
            const c = HEALTH_COLORS[opt]
            return (
              <button
                key={opt}
                onClick={() => handleChange(opt)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 text-left ${opt === current ? 'bg-gray-50' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {c.label}
                {opt === current && <Check className="w-3 h-3 ml-auto text-gray-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CONTEXT-AWARE ACTION BUTTON
// ─────────────────────────────────────────────────────────────
const ActionButton = ({ device, onAction }) => {
  const { requestAssign, approveAssign, rejectAssign,
          requestDeploy, approveDeploy, rejectDeploy,
          requestReturn, approveReturn, rejectReturn,
          clients } = useInventory()

  const [busy, setBusy]         = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showDeploy, setShowDeploy] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [selectedClient, setSelectedClient] = useState('')
  const [rejectNote, setRejectNote]         = useState('')
  const [locationData, setLocationData]     = useState({ state: '', district: '', pinpoint: '' })

  const status = device.lifecycleStatus

  const run = async (fn) => {
    setBusy(true)
    try { await fn() }
    catch (e) { alert(e.message) }
    finally { setBusy(false); onAction && onAction() }
  }

  // Warehouse → request assignment
  if (status === LIFECYCLE.WAREHOUSE) {
    if (showAssign) {
      return (
        <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm font-semibold text-blue-800">Select client to assign:</p>
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
          >
            <option value="">-- Choose client --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => run(() => requestAssign(device.id, selectedClient))}
              disabled={!selectedClient || busy}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit Request'}
            </button>
            <button onClick={() => setShowAssign(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )
    }
    return (
      <button
        onClick={() => setShowAssign(true)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        Request Assignment to Client
      </button>
    )
  }

  // Pending assignment approval
  if (status === LIFECYCLE.ASSIGN_REQUESTED) {
    if (showReject) {
      return (
        <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm font-semibold text-red-800">Rejection reason:</p>
          <textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            rows={2}
            placeholder="Optional note…"
            className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => run(() => rejectAssign(device.id, rejectNote))} disabled={busy}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">
              {busy ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => setShowReject(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
              Back
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Clock className="w-4 h-4 inline mr-1" />
          Awaiting admin approval for assignment to <strong>{device.client?.name}</strong>
        </div>
        <div className="flex gap-2">
          <button onClick={() => run(() => approveAssign(device.id))} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" />
            {busy ? '…' : 'Approve'}
          </button>
          <button onClick={() => setShowReject(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200">
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>
    )
  }

  // Assigned → request deployment
  if (status === LIFECYCLE.ASSIGNED) {
    if (showDeploy) {
      return (
        <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm font-semibold text-blue-800">Confirm deployment location:</p>
          <input value={locationData.state} onChange={e => setLocationData(p => ({...p, state: e.target.value}))}
            placeholder="State" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm" />
          <input value={locationData.district} onChange={e => setLocationData(p => ({...p, district: e.target.value}))}
            placeholder="District" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm" />
          <input value={locationData.pinpoint} onChange={e => setLocationData(p => ({...p, pinpoint: e.target.value}))}
            placeholder="Pinpoint / Site name" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm" />
          <div className="flex gap-2">
            <button onClick={() => run(() => requestDeploy(device.id, locationData))} disabled={busy}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">
              {busy ? 'Submitting…' : 'Submit Deployment Request'}
            </button>
            <button onClick={() => setShowDeploy(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )
    }
    return (
      <button onClick={() => setShowDeploy(true)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700">
        <Truck className="w-4 h-4" />
        Request Deployment
      </button>
    )
  }

  // Pending deployment approval
  if (status === LIFECYCLE.DEPLOY_REQUESTED) {
    if (showReject) {
      return (
        <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm font-semibold text-red-800">Rejection reason:</p>
          <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}
            placeholder="Optional note…" className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={() => run(() => rejectDeploy(device.id, rejectNote))} disabled={busy}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">
              {busy ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => setShowReject(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Back</button>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Clock className="w-4 h-4 inline mr-1" />
          Awaiting admin approval for deployment
        </div>
        <div className="flex gap-2">
          <button onClick={() => run(() => approveDeploy(device.id))} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" />{busy ? '…' : 'Approve Deployment'}
          </button>
          <button onClick={() => setShowReject(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200">
            <X className="w-4 h-4" />Reject
          </button>
        </div>
      </div>
    )
  }

  // Deployed → request return
  if (status === LIFECYCLE.DEPLOYED) {
    if (showReturn) {
      return (
        <div className="space-y-2 p-3 bg-orange-50 rounded-xl border border-orange-200">
          <p className="text-sm font-semibold text-orange-800">Return reason / note:</p>
          <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}
            placeholder="Reason for return…" className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={() => run(() => requestReturn(device.id, rejectNote))} disabled={busy}
              className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold">
              {busy ? 'Submitting…' : 'Submit Return Request'}
            </button>
            <button onClick={() => setShowReturn(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )
    }
    return (
      <button onClick={() => setShowReturn(true)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600">
        <RotateCcw className="w-4 h-4" />
        Request Return to Warehouse
      </button>
    )
  }

  // Pending return approval
  if (status === LIFECYCLE.RETURN_REQUESTED) {
    if (showReject) {
      return (
        <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm font-semibold text-red-800">Rejection reason:</p>
          <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}
            placeholder="Optional note…" className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={() => run(() => rejectReturn(device.id, rejectNote))} disabled={busy}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">
              {busy ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => setShowReject(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Back</button>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Clock className="w-4 h-4 inline mr-1" />
          Awaiting admin approval for return to warehouse
        </div>
        <div className="flex gap-2">
          <button onClick={() => run(() => approveReturn(device.id))} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" />{busy ? '…' : 'Approve Return'}
          </button>
          <button onClick={() => setShowReject(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200">
            <X className="w-4 h-4" />Reject
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// DEVICE HISTORY
// ─────────────────────────────────────────────────────────────
const DeviceHistoryLog = ({ history }) => {
  const [open, setOpen] = useState(false)
  if (!history || history.length === 0) return null

  const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <div className="border-t border-gray-100 pt-3">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 w-full">
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        History ({history.length} events)
      </button>
      {open && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
          {history.map((h, i) => (
            <div key={h.id || i} className="flex items-start gap-2 text-xs text-gray-600">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
              <div>
                <span className="font-medium">{LIFECYCLE_LABELS[h.fromStatus] || h.fromStatus}</span>
                <ArrowRight className="w-3 h-3 inline mx-1 text-gray-400" />
                <span className="font-medium">{LIFECYCLE_LABELS[h.toStatus] || h.toStatus}</span>
                {h.note && <p className="text-gray-500 mt-0.5">{h.note}</p>}
                <p className="text-gray-400">{fmt(h.changedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const BarcodeResultCard = ({ device: initialDevice, onClose, onDeviceUpdated }) => {
  const [device, setDevice] = useState(initialDevice)
  const [copied, setCopied] = useState(false)

  // When parent gives us a freshly-scanned device, update local state
  const handleDeviceRefresh = (newDevice) => {
    setDevice(newDevice)
    onDeviceUpdated && onDeviceUpdated(newDevice)
  }

  const handleHealthUpdated = (newHealth) => {
    setDevice(d => ({ ...d, healthStatus: newHealth }))
  }

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

  const handleDownload = () => {
    const svg = document.getElementById('barcode-qr')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    canvas.width = 300; canvas.height = 300
    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 300, 300)
      ctx.drawImage(img, 0, 0, 300, 300)
      const a = document.createElement('a')
      a.download = `barcode_${device.code}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const locationStr = [device.state, device.district, device.pinpoint]
    .filter(Boolean).join(' / ') || device.location || 'Not specified'

  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">Device Barcode</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* QR Code */}
          <div className="flex justify-center p-5 bg-gray-50 rounded-xl">
            <QRCodeSVG id="barcode-qr" value={barcodeData} size={180} level="H" includeMargin />
          </div>

          {/* Device Identity */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div>
                <p className="text-gray-500 text-xs">Device Code</p>
                <p className="font-bold text-gray-900">{device.code}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Type</p>
                <p className="font-bold text-gray-900 capitalize">{device.type?.replace(/-/g, ' ')}</p>
              </div>
              {device.brand && (
                <div>
                  <p className="text-gray-500 text-xs">Brand</p>
                  <p className="font-semibold text-gray-800">{device.brand}</p>
                </div>
              )}
              {device.model && (
                <div>
                  <p className="text-gray-500 text-xs">Model</p>
                  <p className="font-semibold text-gray-800">{device.model}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-gray-700 flex-1 truncate">{device.barcode}</code>
              <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              </button>
            </div>
          </div>

          {/* STATUS SECTION — always visible */}
          <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />STATUS
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={device.lifecycleStatus} />
              <HealthBadge
                deviceId={device.id}
                current={device.healthStatus}
                onUpdated={handleHealthUpdated}
              />
            </div>
            {device.client && (
              <p className="text-sm text-gray-600">
                Client: <span className="font-semibold text-gray-900">{device.client.name}</span>
                {device.client.company && <span className="text-gray-400"> · {device.client.company}</span>}
              </p>
            )}
            {device.assignedAt && (
              <p className="text-xs text-gray-400">Assigned: {fmt(device.assignedAt)}</p>
            )}
            {device.deployedAt && (
              <p className="text-xs text-gray-400">Deployed: {fmt(device.deployedAt)}</p>
            )}
            {device.rejectionNote && (
              <div className="flex items-start gap-1.5 p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{device.rejectionNote}</p>
              </div>
            )}
          </div>

          {/* LOCATION SECTION — always visible */}
          <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />LOCATION
            </p>
            <p className="text-sm font-semibold text-gray-800">{locationStr}</p>
          </div>

          {/* ACTION BUTTON — context-aware */}
          <ActionButton device={device} onAction={() => onDeviceUpdated && onDeviceUpdated(device)} />

          {/* Download + Print */}
          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />Download
            </button>
            <button onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
              <Printer className="w-4 h-4" />Print
            </button>
          </div>

          {/* History */}
          {device.history && <DeviceHistoryLog history={device.history} />}

          <p className="text-xs text-gray-400 text-center">
            Tip: Print this barcode and attach it to the physical device for easy scanning.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #barcode-qr, #barcode-qr * { visibility: visible; }
          #barcode-qr { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  )
}

export default BarcodeResultCard