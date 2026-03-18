/**
 * SetBarcodeGenerator.jsx — unified set detail + action view
 * ✨ FIXED: Added warehouse location validation for disassemble
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Download, Printer, Copy, Check, X, Layers, Package,
  Activity, MapPin, RotateCcw, MoreVertical, ChevronDown, ChevronUp,
  AlertTriangle, ArrowRight, Move, Wrench, Heart,
} from 'lucide-react'
import { useInventory, LIFECYCLE_LABELS, LIFECYCLE_COLORS } from '../context/InventoryContext'
import SetActionButton from './SetActionButton'
import LifecycleTimeline from './LifecycleTimeline'
import MoveSetModal from './MoveSetModal'
import WarehouseLocationSelector from './WarehouseLocationSelector'
import { setApi } from '../api/setApi'
import { inventoryRequestApi } from '../api/inventoryRequestApi'

const StatusBadge = ({ status }) => {
  const colors = LIFECYCLE_COLORS[status] || LIFECYCLE_COLORS.warehouse
  const label  = LIFECYCLE_LABELS[status]  || status
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${status?.includes('_requested') ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

const HEALTH_MAP = {
  ok:      { label: 'Healthy',      cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  repair:  { label: 'Needs Repair', cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  damage:  { label: 'Damaged',      cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  damaged: { label: 'Damaged',      cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  lost:    { label: 'Lost',         cls: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400'    },
}
const HealthBadge = ({ health }) => {
  const { label, cls, dot } = HEALTH_MAP[health] || HEALTH_MAP.ok
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
    </span>
  )
}

const compHealthMap = {
  ok:      { label: '✓ OK',      cls: 'bg-emerald-100 text-emerald-700' },
  repair:  { label: '🔧 Repair',  cls: 'bg-amber-100 text-amber-700'    },
  damage:  { label: '⚠ Damaged', cls: 'bg-red-100 text-red-700'        },
  damaged: { label: '⚠ Damaged', cls: 'bg-red-100 text-red-700'        },
}

const HEALTH_RANK = { ok: 1, repair: 2, damage: 3, damaged: 3, lost: 4 }
function worstHealth(components = []) {
  if (!components.length) return 'ok'
  return components.reduce((worst, c) => {
    const h = c.healthStatus || 'ok'
    return (HEALTH_RANK[h] || 1) > (HEALTH_RANK[worst] || 1) ? h : worst
  }, 'ok')
}

const SetBarcodeGenerator = ({ set: initialSet, onClose, onSetUpdated }) => {
  const { getSetByBarcode, refresh: refreshContext } = useInventory()
  const [set,           setSet]         = useState(initialSet)
  const [copied,        setCopied]      = useState(false)
  const [showMore,      setShowMore]    = useState(false)
  const [showHistory,   setShowHistory] = useState(false)
  const [showMoveSet,   setShowMoveSet] = useState(false)
  const [showDisassemble,      setShowDisassemble]      = useState(false)
  const [disassembleReason,    setDisassembleReason]    = useState('')
  const [disassembleReasonErr, setDisassembleReasonErr] = useState(false)
  const [disassembleLoading,   setDisassembleLoading]   = useState(false)
  const [shareLocation,        setShareLocation]        = useState(true)
  const [sharedWarehouseId,    setSharedWarehouseId]    = useState(null)
  const [sharedZone,           setSharedZone]           = useState('')
  const [sharedSpecific,       setSharedSpecific]       = useState('')
  const [componentLocations,   setComponentLocations]   = useState({})
  const moreRef = useRef(null)

  const currentUser   = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const currentUserId = currentUser.id ?? null
  const userRole      = (currentUser.role ?? '').toLowerCase().replace(/[\s_-]/g, '')
  const isManager     = ['manager', 'superadmin'].includes(userRole)
  const isGroundTeam  = userRole === 'groundteam'

  const computedHealth = useMemo(() => worstHealth(set.components), [set.components])

  useEffect(() => {
    if (!showMore) return
    const h = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMore])

  const handleActionDone = useCallback(async () => {
    try {
      const fresh = await getSetByBarcode(set.barcode)
      await refreshContext()
      if (fresh) { setSet(fresh); onSetUpdated && onSetUpdated(fresh) }
    } catch { /* ignore */ }
  }, [getSetByBarcode, refreshContext, set.barcode, onSetUpdated])

  const handleManualRefresh = async () => {
    try { const fresh = await getSetByBarcode(set.barcode); await refreshContext(); if (fresh) setSet(fresh) } catch { /* ignore */ }
  }

  const openDisassemble = () => {
    setDisassembleReason(''); setDisassembleReasonErr(false)
    setShareLocation(true)
    setSharedWarehouseId(set.warehouseId || null)
    setSharedZone(set.warehouseZone || '')
    setSharedSpecific(set.warehouseSpecificLocation || '')
    const perComp = {}
    ;(set.components || []).forEach(comp => {
      perComp[comp.id] = { warehouseId: comp.preSetWarehouseId || null, warehouseZone: comp.preSetWarehouseZone || '', warehouseSpecificLocation: comp.preSetWarehouseSpecificLocation || '' }
    })
    setComponentLocations(perComp)
    setShowMore(false); setShowDisassemble(true)
  }

  const handleDisassemble = async () => {
    if (!disassembleReason.trim()) { 
      setDisassembleReasonErr(true); 
      return 
    }
    
    // ✨ NEW: Validate warehouse location
    if (shareLocation && !sharedWarehouseId) {
      alert('Please select a warehouse location for the components.')
      return
    }
    
    if (!shareLocation) {
      const missingLocation = (set.components || []).find(comp => {
        const loc = componentLocations[comp.id] || {}
        return !loc.warehouseId && !comp.preSetWarehouseId && !set.warehouseId
      })
      if (missingLocation) {
        alert(`Component ${missingLocation.code} has no warehouse location. Please specify a location for all components or use the same location for all.`)
        return
      }
    }
    
    setDisassembleReasonErr(false); setDisassembleLoading(true)
    const compLocs = (set.components || []).map(comp => {
      if (shareLocation) return { deviceId: comp.id, warehouseId: sharedWarehouseId, warehouseZone: sharedZone || null, warehouseSpecificLocation: sharedSpecific || null }
      const loc = componentLocations[comp.id] || {}
      return { deviceId: comp.id, warehouseId: loc.warehouseId ?? null, warehouseZone: loc.warehouseZone ?? null, warehouseSpecificLocation: loc.warehouseSpecificLocation ?? null }
    })
    try {
      if (isGroundTeam) {
        await inventoryRequestApi.requestBreakSet(set.id, disassembleReason.trim(), compLocs)
        setShowDisassemble(false); alert('Break set request submitted! A manager will review it shortly.')
      } else {
        await setApi.disassemble(set.id, [], disassembleReason.trim(), compLocs)
        await refreshContext(); onSetUpdated && onSetUpdated(null); onClose()
      }
    } catch (err) { alert(err?.response?.data?.error || err?.message || 'Failed.') }
    finally { setDisassembleLoading(false) }
  }

  const qrData = JSON.stringify({ barcode: set.barcode, setCode: set.code, setType: set.setType, setTypeName: set.setTypeName, name: set.name || null })
  const handleCopy = () => { navigator.clipboard.writeText(set.barcode); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const handleDownload = () => {
    const svg = document.getElementById('set-barcode-qr'); if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image()
    canvas.width = 400; canvas.height = 500
    img.onload = () => {
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 400, 500)
      ctx.drawImage(img, 50, 20, 300, 300)
      ctx.fillStyle = '#000'; ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.fillText(set.code, 200, 370)
      ctx.strokeStyle = '#d1d5db'; ctx.beginPath(); ctx.moveTo(50, 390); ctx.lineTo(350, 390); ctx.stroke()
      ctx.fillStyle = '#374151'; ctx.font = '18px "Courier New"'; ctx.fillText(set.barcode, 200, 425)
      const a = document.createElement('a'); a.download = `set_barcode_${set.code}.png`; a.href = canvas.toDataURL('image/png'); a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const setAsDevice = { ...set, _isSet: true, type: set.setTypeName || set.setType }
  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : null
  const locationStr = [set.state, set.district, set.pinpoint].filter(Boolean).join(' / ') || set.location || null
  const whParts = [
    set.warehouse?.name || (set.warehouseId ? `Warehouse #${set.warehouseId}` : null),
    set.warehouseZone,
    set.warehouseSpecificLocation,
  ].filter(Boolean)
  const canDisassemble = ['available', 'warehouse', 'returned'].includes(set.lifecycleStatus)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg font-bold text-gray-900">Set Details</h3>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleManualRefresh} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><RotateCcw className="w-4 h-4" /></button>

              {/* ⋮ menu */}
              <div className="relative" ref={moreRef}>
                <button onClick={() => setShowMore(o => !o)} className={`p-2 rounded-lg transition-colors ${showMore ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMore && (
                  <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Options</p>
                    </div>
                    <button onClick={() => { handleDownload(); setShowMore(false) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Download className="w-4 h-4 text-blue-500" /> Download QR
                    </button>
                    <button onClick={() => { window.print(); setShowMore(false) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Printer className="w-4 h-4 text-green-500" /> Print QR
                    </button>
                    <div className="border-t border-gray-100">
                      {canDisassemble ? (
                        <button onClick={openDisassemble} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50">
                          <Wrench className="w-4 h-4 text-amber-500" />
                          {isGroundTeam ? 'Request Disassemble' : 'Disassemble Set'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                          title={set.lifecycleStatus === 'in_transit' ? 'In transit — cannot disassemble' : 'Must be in warehouse to disassemble'}>
                          <Wrench className="w-4 h-4" /> Disassemble
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="p-5 space-y-4">

            {/* QR Code */}
            <div className="print-label">
              <div className="flex justify-center p-5 bg-gray-50 rounded-xl">
                <QRCodeSVG id="set-barcode-qr" value={qrData} size={180} level="H" includeMargin />
              </div>
              <div className="mt-4 pt-4 border-t-2 border-gray-300">
                <p className="text-3xl font-bold text-gray-900 tracking-wide">{set.code}</p>
              </div>
              <div className="mt-3">
                <p className="text-base font-mono text-gray-700 tracking-wider">{set.barcode}</p>
              </div>
            </div>

            {/* Set Identity */}
            <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl">
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div><p className="text-gray-500 text-xs">Set Code</p><p className="font-bold text-gray-900">{set.code}</p></div>
                <div><p className="text-gray-500 text-xs">Type</p><p className="font-bold text-gray-900">{set.setTypeName || set.setType}</p></div>
                {set.name && <div className="col-span-2"><p className="text-gray-500 text-xs">Name</p><p className="font-bold text-gray-900">{set.name}</p></div>}
                {set.components?.length > 0 && <div><p className="text-gray-500 text-xs">Components</p><p className="font-semibold text-gray-800">{set.components.length} device{set.components.length !== 1 ? 's' : ''}</p></div>}
              </div>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-gray-700 flex-1 truncate">{set.barcode}</code>
                <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Component list */}
            {set.components?.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5" /> Components
                </p>
                <div className="space-y-1.5">
                  {set.components.map(c => {
                    const badge = compHealthMap[c.healthStatus || 'ok'] || compHealthMap.ok
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono text-gray-700 truncate">
                          {c.code}<span className="text-gray-400"> · {[c.brand, c.model, c.size].filter(Boolean).join(' ') || 'N/A'}</span>
                        </p>
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Status + Health */}
            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> STATUS
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={set.lifecycleStatus} />
                <HealthBadge health={computedHealth} />
                {computedHealth !== 'ok' && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5" /> from components
                  </span>
                )}
              </div>
              {set.client && (
                <p className="text-sm text-gray-600">Client: <span className="font-semibold text-gray-900">{set.client.name}</span>
                  {set.client.company && <span className="text-gray-400"> · {set.client.company}</span>}
                </p>
              )}
              {set.assignedAt && <p className="text-xs text-gray-400">Assigned: {fmt(set.assignedAt)}</p>}
              {set.deployedAt && <p className="text-xs text-gray-400">Deployed: {fmt(set.deployedAt)}</p>}
              {set.rejectionNote && (
                <div className="flex items-start gap-1.5 p-2 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{set.rejectionNote}</p>
                </div>
              )}
            </div>

            {/* Warehouse location + Move */}
            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> WAREHOUSE LOCATION
                </p>
                {set.lifecycleStatus === 'in_transit' ? (
                  <span title="Cannot move — set is in transit" className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">Move</span>
                ) : (
                  <button onClick={() => setShowMoveSet(true)} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 flex items-center gap-1">
                    <Move className="w-2.5 h-2.5" /> Move
                  </button>
                )}
              </div>
              {whParts.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {whParts.map((p, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                      <span className="px-2 py-0.5 bg-gray-50 border border-gray-200 text-gray-700 rounded text-xs font-medium">{p}</span>
                    </span>
                  ))}
                </div>
              ) : locationStr ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{locationStr}</p>
                  <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Use Move to update</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No location set — use Move to assign one</p>
              )}
            </div>

            {/* Lifecycle action */}
            <SetActionButton device={setAsDevice} currentUserId={currentUserId} isManager={isManager} onAction={handleActionDone} />

            {/* History */}
            <button onClick={() => setShowHistory(h => !h)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-gray-400" /> Show History</span>
              {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showHistory && <LifecycleTimeline deviceId={null} setId={set.id} />}

            <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <strong>Tip:</strong> Print and attach this QR code to the physical set packaging for easy scanning during deployment.
            </p>
          </div>
        </div>
        <style>{`@media print { body * { visibility: hidden; } .print-label, .print-label * { visibility: visible; } .print-label { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; } }`}</style>
      </div>

      {/* Move Set Modal */}
      {showMoveSet && (
        <MoveSetModal set={set}
          onSuccess={(updatedSet) => { setSet(prev => ({ ...prev, ...updatedSet })); onSetUpdated && onSetUpdated(updatedSet) }}
          onClose={() => setShowMoveSet(false)} />
      )}

      {/* Disassemble Modal */}
      {showDisassemble && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 p-5 border-b border-gray-100">
              <div className="p-2.5 bg-amber-100 rounded-xl"><Wrench className="w-6 h-6 text-amber-600" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Disassemble Set</h3>
                <p className="text-sm text-gray-500">{set.code} · {set.components?.length || 0} components</p>
              </div>
              <button onClick={() => setShowDisassemble(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <p className="text-sm text-gray-600">All <strong>{set.components?.length || 0} components</strong> will be returned to warehouse individually. This cannot be undone.</p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
                <textarea rows={2} placeholder="e.g. Client returned set, upgrading components…"
                  value={disassembleReason}
                  onChange={e => { setDisassembleReason(e.target.value); if (e.target.value.trim()) setDisassembleReasonErr(false) }}
                  className={`w-full text-sm rounded-lg border px-3 py-2 resize-none focus:outline-none focus:ring-2 transition-colors ${disassembleReasonErr ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:ring-amber-200 focus:border-amber-400'}`}
                />
                {disassembleReasonErr && <p className="text-xs text-red-600 mt-1">A reason is required.</p>}
              </div>

              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">Component Return Locations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-700">Individual</span>
                    <button type="button" onClick={() => setShareLocation(v => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${shareLocation ? 'bg-amber-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${shareLocation ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-amber-700">All same</span>
                  </div>
                </div>

                <div className="p-4">
                  {shareLocation ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">All components go to same location. Pre-filled with set's current location.</p>
                      <WarehouseLocationSelector
                        warehouseId={sharedWarehouseId} zone={sharedZone} specificLocation={sharedSpecific}
                        onWarehouseChange={v => { setSharedWarehouseId(v); setSharedZone('') }}
                        onZoneChange={setSharedZone} onSpecificLocationChange={setSharedSpecific}
                        required={false}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">Each component pre-filled with its location before the set was created.</p>
                      {(set.components || []).map(comp => {
                        const loc = componentLocations[comp.id] || {}
                        return (
                          <div key={comp.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-gray-500" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 font-mono">{comp.code}</p>
                                <p className="text-xs text-gray-400">{comp.brand} {comp.model}</p>
                              </div>
                              {comp.preSetWarehouseId && (
                                <span className="ml-auto text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Pre-set loaded</span>
                              )}
                            </div>
                            <WarehouseLocationSelector
                              warehouseId={loc.warehouseId ?? null} zone={loc.warehouseZone ?? ''} specificLocation={loc.warehouseSpecificLocation ?? ''}
                              onWarehouseChange={val => setComponentLocations(prev => ({ ...prev, [comp.id]: { ...prev[comp.id], warehouseId: val, warehouseZone: '' } }))}
                              onZoneChange={val => setComponentLocations(prev => ({ ...prev, [comp.id]: { ...prev[comp.id], warehouseZone: val } }))}
                              onSpecificLocationChange={val => setComponentLocations(prev => ({ ...prev, [comp.id]: { ...prev[comp.id], warehouseSpecificLocation: val } }))}
                              required={false}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowDisassemble(false)} disabled={disassembleLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 text-sm">Cancel</button>
              <button onClick={handleDisassemble} disabled={disassembleLoading} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {disassembleLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Wrench className="w-4 h-4" /> {isGroundTeam ? 'Submit Request' : 'Disassemble'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SetBarcodeGenerator