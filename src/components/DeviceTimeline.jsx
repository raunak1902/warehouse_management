/**
 * src/components/DeviceTimeline.jsx
 */

import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2, XCircle, Clock, User, Shield, AlertTriangle,
  Wrench, Truck, Package, Zap, RotateCcw, ChevronRight,
  Loader2, RefreshCw, Heart, Layers, Link, Unlink, Activity,
  MapPin, ArrowRight,
} from 'lucide-react'
import { lifecycleRequestApi, STEP_META } from '../api/lifecycleRequestApi'

const HEALTH_STYLE = {
  ok:     { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: '✓ OK' },
  repair: { cls: 'bg-amber-100  text-amber-700  border-amber-200',     label: '🔧 Repair' },
  damage: { cls: 'bg-red-100    text-red-700    border-red-200',       label: '⚠ Damaged' },
  lost:   { cls: 'bg-red-200    text-red-900    border-red-300',       label: '❌ Lost' },
}

const STEP_ICONS = {
  assigning:         ChevronRight,
  ready_to_deploy:   CheckCircle2,
  in_transit:        Truck,
  received:          Package,
  installed:         Wrench,
  active:            Zap,
  under_maintenance: Wrench,
  return_initiated:  RotateCcw,
  return_transit:    Truck,
  returned:          Package,
  lost:              AlertTriangle,
  health_update:     Heart,
}

const STEP_DOT_COLOR = {
  assigning:         'bg-blue-500',
  ready_to_deploy:   'bg-teal-500',
  in_transit:        'bg-amber-500',
  received:          'bg-purple-500',
  installed:         'bg-indigo-500',
  active:            'bg-green-500',
  under_maintenance: 'bg-orange-500',
  return_initiated:  'bg-rose-500',
  return_transit:    'bg-pink-500',
  returned:          'bg-slate-400',
  lost:              'bg-red-600',
  health_update:     'bg-cyan-500',
}

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—'

// Parse JSON blob stored in note for the 'assigning' step into readable rows
function parseAssigningNote(note) {
  if (!note) return null
  try {
    const m = JSON.parse(note)
    if (typeof m !== 'object' || Array.isArray(m)) return null
    const rows = []
    if (m.returnType === 'days' && m.returnDays)
      rows.push({ label: 'Return Period', value: `${m.returnDays} days` })
    else if (m.returnType === 'months' && m.returnMonths)
      rows.push({ label: 'Return Period', value: `${m.returnMonths} months` })
    else if (m.returnType === 'date' && m.returnDate)
      rows.push({ label: 'Return Date', value: new Date(m.returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) })
    if (m.subscriptionEnd)
      rows.push({ label: 'Subscription End', value: new Date(m.subscriptionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) })
    if (m.state)    rows.push({ label: 'State',    value: m.state })
    if (m.district) rows.push({ label: 'District', value: m.district })
    if (m.site || m.location) rows.push({ label: 'Site', value: m.site || m.location })
    return rows.length ? rows : null
  } catch {
    return null
  }
}

function parseSetContext(note) {
  if (!note) return null
  const tag = note.match(/^\[(\w+)\]/)
  if (!tag) return null
  const type = tag[1]
  if (!['SET_JOIN', 'SET_LEAVE', 'SET_MOVE', 'SET_HEALTH'].includes(type)) return null
  return { type, text: note.replace(/^\[\w+\]\s*/, '') }
}

function cleanNote(note) {
  if (!note) return null
  return note.replace(/^\[LR#\d+\]\s*/, '').trim() || null
}

const SET_CTX_STYLE = {
  SET_JOIN:   { dotCls: 'bg-violet-500', Icon: Link,   label: 'Added to Set',     cardCls: 'border-violet-200 bg-violet-50' },
  SET_LEAVE:  { dotCls: 'bg-slate-400',  Icon: Unlink, label: 'Removed from Set', cardCls: 'border-slate-200 bg-slate-50'   },
  SET_MOVE:   { dotCls: 'bg-indigo-400', Icon: Layers, label: 'Moved via Set',    cardCls: 'border-indigo-100 bg-indigo-50' },
  SET_HEALTH: { dotCls: 'bg-amber-400',  Icon: Heart,  label: 'Health via Set',   cardCls: 'border-amber-100 bg-amber-50'   },
}

function parseSetContextRows(type, text) {
  const rows = []
  const setMatch = text.match(/set\s+([A-Z0-9-]+)\s*\(([^)]+)\)/i)
  if (setMatch) rows.push({ label: 'Set', value: `${setMatch[1]} — ${setMatch[2]}` })

  if (type === 'SET_JOIN') {
    const m = text.match(/Members:\s*(.+)$/i)
    if (m) rows.push({ label: 'Members', value: m[1].trim() })
  }

  if (type === 'SET_MOVE') {
    const step = text.match(/→\s*([^|]+)/)
    if (step) rows.push({ label: 'Step', value: step[1].trim() })

    // Parse each | segment by known prefix — ignore raw JSON blobs
    const segments = text.split('|').slice(1).map(s => s.trim()).filter(Boolean)
    let noteIdx = 0
    segments.forEach(seg => {
      if (/^Health:\s*(\w+)/i.test(seg)) {
        const h = seg.match(/^Health:\s*(\w+)/i)
        if (h && h[1].toLowerCase() !== 'ok') rows.push({ label: 'Health', value: h[1] })
      } else if (/^Note:\s*/i.test(seg)) {
        rows.push({ label: `Note`, value: seg.replace(/^Note:\s*/i, '').trim(), _key: `note-${noteIdx++}` })
      } else if (/^Client:\s*/i.test(seg)) {
        rows.push({ label: 'Client', value: seg.replace(/^Client:\s*/i, '').trim() })
      } else if (/^Client ID:\s*/i.test(seg)) {
        rows.push({ label: 'Client ID', value: seg.replace(/^Client ID:\s*/i, '').trim() })
      } else if (/^Return:\s*/i.test(seg)) {
        rows.push({ label: 'Return', value: seg.replace(/^Return:\s*/i, '').trim() })
      } else if (/^Return by:\s*/i.test(seg)) {
        rows.push({ label: 'Return by', value: seg.replace(/^Return by:\s*/i, '').trim() })
      } else if (/^Sub end:\s*/i.test(seg)) {
        rows.push({ label: 'Sub end', value: seg.replace(/^Sub end:\s*/i, '').trim() })
      } else if (/^State:\s*/i.test(seg)) {
        rows.push({ label: 'State', value: seg.replace(/^State:\s*/i, '').trim() })
      } else if (/^District:\s*/i.test(seg)) {
        rows.push({ label: 'District', value: seg.replace(/^District:\s*/i, '').trim() })
      } else if (!seg.startsWith('{') && !seg.startsWith('[')) {
        // Plain text note — not a JSON blob
        rows.push({ label: 'Note', value: seg, _key: `note-${noteIdx++}` })
      }
      // JSON blobs are silently skipped — they were logged before backend fix
    })
  }

  if (type === 'SET_LEAVE') {
    const action = text.match(/—\s*([^|]+)\|/)
    if (action) rows.push({ label: 'Action', value: action[1].trim() })
    const reason = text.match(/Reason:\s*(.+)$/i)
    if (reason) rows.push({ label: 'Reason', value: reason[1].trim() })
  }
  if (type === 'SET_HEALTH') {
    const health = text.match(/Health updated to\s*(\w+)/i)
    if (health) rows.push({ label: 'New Health', value: health[1] })
    const note = text.match(/Note:\s*(.+)$/i)
    if (note) rows.push({ label: 'Note', value: note[1].trim() })
  }
  return rows
}

function InfoGrid({ rows }) {
  if (!rows || !rows.length) return null
  return (
    <div className="mt-2 rounded-lg bg-white/80 border border-black/5 divide-y divide-black/5 overflow-hidden">
      {rows.map((row, i) => (
        <div key={row._key || `${row.label}-${i}`} className="flex items-start justify-between gap-3 px-3 py-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex-shrink-0 mt-0.5">{row.label}</span>
          <span className="text-xs text-gray-700 font-medium text-right break-words min-w-0">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function SummaryStrip({ history }) {
  const stats = useMemo(() => {
    const sets = new Set()
    let activeMs = 0, maintenanceMs = 0
    const chrono = [...history].reverse()
    let activeStart = null, maintenanceStart = null
    for (const item of chrono) {
      const ctx = parseSetContext(item.note)
      if (ctx?.type === 'SET_JOIN') {
        const m = item.note?.match(/set\s+(\S+)/i)
        if (m) sets.add(m[1])
      }
      const ts = new Date(item.changedAt || item.approvedAt || item.createdAt).getTime()
      const status = item.toStatus || ''
      if (status === 'active' || status === 'installed') {
        if (maintenanceStart) { maintenanceMs += ts - maintenanceStart; maintenanceStart = null }
        activeStart = ts
      } else if (status === 'under_maintenance') {
        if (activeStart) { activeMs += ts - activeStart; activeStart = null }
        maintenanceStart = ts
      } else if (['returned', 'available', 'warehouse'].includes(status)) {
        if (activeStart) { activeMs += ts - activeStart; activeStart = null }
        if (maintenanceStart) { maintenanceMs += ts - maintenanceStart; maintenanceStart = null }
      }
    }
    const nowMs = Date.now()
    if (activeStart) activeMs += nowMs - activeStart
    if (maintenanceStart) maintenanceMs += nowMs - maintenanceStart
    const fmtDur = (ms) => {
      if (ms <= 0) return '—'
      const h = Math.floor(ms / 3600000)
      if (h < 24) return `${h}h`
      const d = Math.floor(h / 24)
      if (d < 30) return `${d}d`
      return `${Math.floor(d / 30)}mo`
    }
    return {
      setsCount: sets.size,
      activeTime: fmtDur(activeMs),
      maintenanceTime: fmtDur(maintenanceMs),
      totalMoves: history.filter(h => !parseSetContext(h.note)).length,
    }
  }, [history])

  return (
    <div className="grid grid-cols-4 gap-2 mb-5">
      {[
        { label: 'Sets Used',   value: stats.setsCount || '—', Icon: Layers,   cls: 'bg-violet-50 border-violet-200 text-violet-700' },
        { label: 'Active Time', value: stats.activeTime,        Icon: Zap,      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        { label: 'Maint.',      value: stats.maintenanceTime,   Icon: Wrench,   cls: 'bg-orange-50 border-orange-200 text-orange-700' },
        { label: 'Moves',       value: stats.totalMoves || '—', Icon: Activity, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
      ].map(({ label, value, Icon, cls }) => (
        <div key={label} className={`rounded-xl border px-2 py-2 flex flex-col items-center gap-0.5 ${cls}`}>
          <Icon className="w-3.5 h-3.5 opacity-60" />
          <span className="text-base font-bold leading-none mt-0.5">{value}</span>
          <span className="text-[9px] font-semibold opacity-60 text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  )
}

function SetContextCard({ item, ctx, isFirst }) {
  const style = SET_CTX_STYLE[ctx.type]
  const { Icon } = style
  const ts   = item.changedAt || item.approvedAt || item.createdAt
  const rows = parseSetContextRows(ctx.type, ctx.text)
  return (
    <div className="relative flex gap-3 pb-4">
      <div className="relative flex-shrink-0 z-10 mt-0.5">
        <div className={`w-8 h-8 rounded-full ${style.dotCls} flex items-center justify-center shadow-sm`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <div className={`flex-1 min-w-0 rounded-xl border p-3 ${style.cardCls} ${isFirst ? 'ring-1 ring-blue-200' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-700">{style.label}</span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{fmt(ts)}</span>
        </div>
        <InfoGrid rows={rows} />
      </div>
    </div>
  )
}

function LifecycleCard({ item, isFirst }) {
  const meta     = STEP_META[item.toStep] ?? { label: item.toStep, emoji: '📋' }
  const dotColor = STEP_DOT_COLOR[item.toStep] ?? 'bg-gray-400'
  const Icon     = STEP_ICONS[item.toStep] ?? ChevronRight
  const hs       = HEALTH_STYLE[item.healthStatus] ?? HEALTH_STYLE.ok
  const assigningRows = item.toStep === 'assigning' ? parseAssigningNote(item.note) : null
  const plainNote     = item.toStep !== 'assigning' ? cleanNote(item.note) : null
  const ctx           = parseSetContext(item.note)
  const isViaSet      = ctx?.type === 'SET_MOVE' || ctx?.type === 'SET_HEALTH'

  return (
    <div className="relative flex gap-3 pb-4">
      <div className="relative flex-shrink-0 z-10 mt-0.5">
        <div className={`w-8 h-8 rounded-full ${isViaSet ? 'bg-indigo-400' : dotColor} flex items-center justify-center shadow-sm`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <div className={`flex-1 min-w-0 bg-white rounded-xl border shadow-sm p-3 ${isFirst ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-bold text-gray-900 leading-snug">
              {meta.emoji} {meta.label}
            </span>
            {isFirst && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full">Current</span>}
            {isViaSet && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-semibold rounded-full">📦 via set</span>}
            {item.autoApproved && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-semibold rounded-full">Auto</span>}
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">{fmt(item.approvedAt || item.createdAt)}</span>
        </div>

        {/* Who */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <User className="w-2.5 h-2.5 flex-shrink-0" />{item.requestedByName}
          </span>
          {item.approvedByName && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Shield className="w-2.5 h-2.5 flex-shrink-0" />{item.approvedByName}
            </span>
          )}
        </div>

        {/* Health — only show if not OK */}
        {item.healthStatus && item.healthStatus !== 'ok' && (
          <div className="flex items-center gap-1.5 mb-2">
            <Heart className="w-3 h-3 text-gray-300 flex-shrink-0" />
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${hs.cls}`}>{hs.label}</span>
          </div>
        )}

        {/* Health note */}
        {item.healthNote && (
          <div className="mb-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-[10px] font-bold text-amber-700 block mb-0.5">⚠ Health Note</span>
            <span className="text-xs text-amber-800">{item.healthNote}</span>
          </div>
        )}

        {/* Assigning meta */}
        {assigningRows && <InfoGrid rows={assigningRows} />}

        {/* Plain note */}
        {plainNote && !isViaSet && (
          <div className="mt-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-xs text-gray-600">{plainNote}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DeviceTimeline({ deviceId, setId, deviceCode, onClose }) {
  const [lcHistory,  setLcHistory]  = useState([])
  const [rawHistory,      setRawHistory]      = useState([])
  const [locationHistory, setLocationHistory] = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      if (deviceId) {
        const [lcData, rawData, locData] = await Promise.all([
          lifecycleRequestApi.getDeviceHistory(deviceId),
          fetch(`/api/devices/${deviceId}/history`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`/api/devices/${deviceId}/location-history`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }).then(r => r.ok ? r.json() : []).catch(() => []),
        ])
        setLcHistory(lcData)
        setRawHistory(Array.isArray(rawData) ? rawData : [])
        setLocationHistory(Array.isArray(locData) ? locData : [])
      } else {
        const data = await lifecycleRequestApi.getSetHistory(setId)
        setLcHistory(data); setRawHistory([])
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [deviceId, setId])

  const merged = useMemo(() => {
    const lcItems  = lcHistory.map(h => ({ ...h, _source: 'lc',  _ts: new Date(h.approvedAt  || h.createdAt).getTime() }))
    const rawItems = rawHistory.filter(r => parseSetContext(r.note)).map(r => ({ ...r, _source: 'raw', _ts: new Date(r.changedAt).getTime() }))
    const locItems = locationHistory.map(h => ({ ...h, _source: 'location', _ts: new Date(h.timestamp).getTime() }))
    return [...lcItems, ...rawItems, ...locItems].sort((a, b) => b._ts - a._ts)
  }, [lcHistory, rawHistory, locationHistory])

  const summaryInput = rawHistory.length > 0
    ? rawHistory
    : lcHistory.map(h => ({ toStatus: h.toStep, changedAt: h.approvedAt || h.createdAt, note: h.note }))

  if (loading) return (
    <Shell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
      <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading history…</span>
      </div>
    </Shell>
  )

  if (error) return (
    <Shell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
        <XCircle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{error}</span>
        <button onClick={load} className="underline text-xs">Retry</button>
      </div>
    </Shell>
  )

  if (merged.length === 0) return (
    <Shell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
      <div className="flex flex-col items-center py-10 text-center gap-2">
        <Clock className="w-10 h-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">No history yet</p>
        <p className="text-xs text-gray-400">Steps will appear here as the device moves.</p>
      </div>
    </Shell>
  )

  return (
    <Shell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
      {deviceId && <SummaryStrip history={summaryInput} />}
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 z-0" />
        <div>
          {merged.map((item, idx) => {
            const isFirst = idx === 0
            if (item._source === 'raw') {
              const ctx = parseSetContext(item.note)
              return ctx ? <SetContextCard key={`raw-${item.id}`} item={item} ctx={ctx} isFirst={isFirst} /> : null
            }
            if (item._source === 'location') {
              return <LocationMoveCard key={`loc-${item.id}`} item={item} isFirst={isFirst} />
            }
            return <LifecycleCard key={item.id} item={item} isFirst={isFirst} />
          })}
        </div>
      </div>
    </Shell>
  )
}


// ── Location Move Card (teal) ─────────────────────────────────────────────────
function LocationMoveCard({ item, isFirst }) {
  const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—'

  const wh   = item.warehouse?.name || (item.warehouseId ? `Warehouse #${item.warehouseId}` : null)
  const zone = item.warehouseZone
  const spec = item.warehouseSpecificLocation
  const who  = item.changedBy?.name || 'System'
  const role = item.changedBy?.role?.name || ''

  const parts = [wh, zone, spec].filter(Boolean)

  return (
    <div className="relative flex gap-3 pb-4">
      {/* Dot */}
      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
        isFirst ? 'bg-teal-500 border-teal-500' : 'bg-teal-100 border-teal-300'
      }`}>
        <MapPin className={`w-3.5 h-3.5 ${isFirst ? 'text-white' : 'text-teal-600'}`} />
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 rounded-xl px-3 py-2.5 border ${
        isFirst ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs font-bold text-teal-700 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Device Moved
            </p>
            {/* Location breadcrumb */}
            {parts.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {parts.map((p, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-teal-300" />}
                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded text-[11px] font-medium">{p}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Location cleared</span>
            )}
            {item.notes && (
              <p className="text-[11px] text-gray-400 italic">"{item.notes}"</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-gray-400">{fmt(item.timestamp)}</p>
            <p className="text-[11px] font-medium text-gray-600">{who}</p>
            {role && <p className="text-[10px] text-gray-400">{role}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Shell({ deviceCode, onClose, onRefresh, children }) {
  return (
    <div className="bg-gray-50 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Device History</h3>
          {deviceCode && <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{deviceCode}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onRefresh} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}