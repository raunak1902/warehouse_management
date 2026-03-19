import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ClipboardList, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, Search, X, User, Layers, Monitor,
  Building2, AlertTriangle, FileText, TrendingUp,
  ArrowRight, CheckCircle2, Truck,
  Hourglass, Plus, Send, Zap, Heart,
  Paperclip, ImageIcon, Film, Eye,
  MoreHorizontal, Clipboard, ClipboardCheck,
  Pencil, MapPin,
} from 'lucide-react'
import { normaliseRole, ROLES } from '../../App'
import { useInventory } from '../../context/InventoryContext'
import { lifecycleRequestApi, STEP_META, VALID_NEXT_STEPS, PROOF_CONFIG, HEALTH_REQUIRES_PROOF, MAX_PROOF_FILES } from '../../api/lifecycleRequestApi'
import LifecycleTimeline, { TimelineItem, ProofFilesPanel, ProofAttachmentButton } from '../../components/LifecycleTimeline'
import { ProofUploadPanel, useProofFiles } from '../../components/ProofUpload'
import InventoryRequestPanel from '../../components/InventoryRequestPanel'
import { inventoryRequestApi } from '../../api/inventoryRequestApi'
import WarehouseLocationSelector from '../../components/WarehouseLocationSelector'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

// ── Mobile Action Tray (bottom sheet for pending requests) ────────────────────
const MobileActionTray = ({ group, canApprove, onApprove, onClose }) => {
  const { pendingRequests } = group
  const latestPending = pendingRequests[0]
  const stepMeta = latestPending ? STEP_META[latestPending.toStep] : null
  const waiting  = latestPending ? waitingDuration(latestPending.createdAt) : null

  if (!latestPending || !stepMeta) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:hidden" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Amber header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 mx-4 mb-3 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <p className="text-xs font-extrabold text-white uppercase tracking-widest">Awaiting Approval</p>
            {pendingRequests.length > 1 && (
              <span className="ml-auto bg-white/30 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                +{pendingRequests.length - 1} more
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{stepMeta.emoji}</span>
            <span className="text-base font-extrabold text-white">{stepMeta.label}</span>
            <span className={`ml-auto text-sm font-extrabold px-2 py-0.5 rounded-full flex-shrink-0
              ${waiting?.urgent ? 'bg-red-500 text-white' : 'bg-white/25 text-white'}`}>
              {waiting?.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-6 h-6 rounded-full bg-white/30 border-2 border-white/50 text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
              {initials(latestPending.requestedByName)}
            </span>
            <span className="text-sm font-bold text-white truncate">{latestPending.requestedByName}</span>
          </div>
        </div>

        {/* Action buttons */}
        {canApprove ? (
          <div className="flex gap-3 px-4 pb-6 pt-1">
            <button
              onClick={() => { onApprove(latestPending, 'approve'); onClose() }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold transition-all shadow-md active:scale-95"
            >
              <CheckCircle size={15} /> Approve
            </button>
            <button
              onClick={() => { onApprove(latestPending, 'reject'); onClose() }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-extrabold transition-all active:scale-95"
            >
              <XCircle size={15} /> Reject
            </button>
          </div>
        ) : (
          <div className="px-4 pb-6 pt-1">
            <p className="text-xs text-text-muted text-center font-medium">This request is awaiting manager approval</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Journey steps (no "available" — page is about deployed devices) ──────────
const DEPLOY_STEPS  = ['assigning', 'ready_to_deploy', 'in_transit', 'received', 'installed', 'active']
const RETURN_STEPS  = ['return_initiated', 'return_transit', 'returned']

const HEALTH_STYLE = {
  ok:      { label: 'Healthy',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  repair:  { label: 'Needs Repair', cls: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500'   },
  damaged: { label: 'Damaged',      cls: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500'     },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const isReturnJourney = (status) =>
  ['return_initiated', 'return_transit', 'returned', 'under_maintenance'].includes(status)

const needsAttention = (status) => !['active', 'returned'].includes(status)

const isComplexRequest = (req) =>
  req.healthStatus !== 'ok' ||
  req.healthNote?.trim() ||
  (req.note?.trim() && req.note.length > 100)

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const waitingDuration = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 3600)  return { label: `${Math.floor(diff / 60)}m`,                                        urgent: false }
  if (diff < 86400) return { label: `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`,   urgent: false }
  const days = Math.floor(diff / 86400)
  return { label: `${days}d ${Math.floor((diff % 86400) / 3600)}h`, urgent: days >= 1 }
}

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

// ── Custom Select ─────────────────────────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, placeholder = 'All' }) => {
  const [open, setOpen] = useState(false)
  const ref = React.useRef(null)
  const selected = options.find(o => String(o.value) === String(value))

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative sm:w-44">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-xs font-medium transition-all bg-gray-50
          ${open ? 'border-primary-400 ring-2 ring-primary-100 bg-white' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 size={12} className="text-gray-400 flex-shrink-0" />
          <span className={`truncate ${selected ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <ChevronDown size={12} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors
              ${!value ? 'bg-primary-50 text-primary-700 font-bold' : 'text-text-secondary hover:bg-gray-50'}`}
          >
            {placeholder}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(String(opt.value)); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors border-t border-gray-50
                ${String(value) === String(opt.value) ? 'bg-primary-50 text-primary-700 font-bold' : 'text-text-secondary hover:bg-gray-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step Track ────────────────────────────────────────────────────────────────
const StepTrack = ({ currentStatus, pendingStep }) => {
  const isReturn   = isReturnJourney(currentStatus) || isReturnJourney(pendingStep)
  const steps      = isReturn ? RETURN_STEPS : DEPLOY_STEPS
  const stepIdx    = steps.indexOf(currentStatus)
  // Progress bar advances to pendingStep if one exists, otherwise currentStatus
  const progressAt = pendingStep ? steps.indexOf(pendingStep) : stepIdx
  const progress   = progressAt === -1 ? 0 : Math.round((progressAt / (steps.length - 1)) * 100)

  return (
    <div className="w-full space-y-2">
      {/* Progress bar */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex items-start w-full overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {steps.map((step, idx) => {
          const meta      = STEP_META[step]
          const isCurrent = step === currentStatus
          const isDone    = stepIdx > idx
          const isPending = pendingStep && step === pendingStep && step !== currentStatus
          const isNext    = !pendingStep && stepIdx !== -1 && idx === stepIdx + 1

          return (
            <div key={step} className="flex items-center flex-shrink-0 flex-1">
              <div className="flex flex-col items-center gap-1 w-full">
                <div className={`
                  flex items-center justify-center rounded-full border-2 transition-all
                  ${isCurrent
                    ? 'w-9 h-9 bg-primary-600 border-primary-600 text-white shadow-md ring-2 ring-primary-200'
                    : isDone
                    ? 'w-8 h-8 bg-primary-100 border-primary-300 text-primary-600'
                    : isPending
                    ? 'w-9 h-9 bg-amber-500 border-amber-400 text-white shadow-md ring-2 ring-amber-200 animate-pulse'
                    : isNext
                    ? 'w-7 h-7 bg-orange-50 border-orange-300 text-orange-400'
                    : 'w-6 h-6 bg-gray-100 border-gray-200 text-gray-300'
                  }
                `}>
                  {isDone ? <CheckCircle2 size={isCurrent ? 16 : 14} /> : <span style={{ fontSize: isCurrent ? 17 : 14 }}>{meta?.emoji}</span>}
                </div>
                <span className={`text-[9px] leading-tight text-center font-semibold max-w-[44px] truncate
                  ${isCurrent ? 'text-primary-700' : isDone ? 'text-primary-400' : isPending ? 'text-amber-600 font-bold' : isNext ? 'text-orange-400' : 'text-gray-300'}`}>
                  {meta?.label?.split(' ')[0]}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Stat Tile ─────────────────────────────────────────────────────────────────
const StatTile = ({ label, value, icon: Icon, accent, sub }) => (
  <div className={`bg-white rounded-xl border ${accent.border} p-3 flex items-center gap-3 shadow-sm`}>
    <div className={`w-9 h-9 rounded-lg ${accent.bg} flex items-center justify-center flex-shrink-0`}>
      <Icon size={16} className={accent.icon} />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-text-primary leading-none">{value}</p>
      <p className="text-[11px] text-text-secondary mt-0.5 font-medium">{label}</p>
      {sub && <p className={`text-[10px] font-semibold mt-0.5 ${accent.subText}`}>{sub}</p>}
    </div>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// ── HealthLogView ─────────────────────────────────────────────────────────────
// Compact log-style list for standalone health update requests.
// No progress bar, no journey card — just who reported what, on which device, when.
const HealthLogView = ({ groups, canApprove, onApprove }) => {
  // Flatten all health requests across groups, sorted newest-first
  const rows = []
  groups.forEach(g => {
    const allReqs = [...g.pendingRequests, ...g.approvedHistory]
    allReqs.forEach(req => {
      rows.push({ req, group: g })
    })
  })
  rows.sort((a, b) => new Date(b.req.createdAt) - new Date(a.req.createdAt))

  const HEALTH_ROW_STYLE = {
    ok:      { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Healthy'      },
    repair:  { badge: 'bg-amber-100  text-amber-700  border-amber-200',     dot: 'bg-amber-500',  label: 'Needs Repair'  },
    damaged: { badge: 'bg-red-100    text-red-700    border-red-200',       dot: 'bg-red-500',    label: 'Damaged'       },
    lost:    { badge: 'bg-gray-100   text-gray-600   border-gray-200',      dot: 'bg-gray-400',   label: 'Lost'          },
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 px-6 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center mx-auto mb-3">
          <Heart size={24} className="text-cyan-300" />
        </div>
        <p className="text-sm font-bold text-text-secondary">No health change requests</p>
        <p className="text-xs text-text-muted mt-1">Standalone health updates will appear here.</p>
      </div>
    )
  }

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-cyan-100">
          <Heart size={15} className="text-cyan-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-text-primary leading-none">Health Updates</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            {rows.length} report{rows.length !== 1 ? 's' : ''} · standalone device health changes
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        {rows.map(({ req, group }, i) => {
          const hs = HEALTH_ROW_STYLE[req.healthStatus] || HEALTH_ROW_STYLE.ok
          const isPending = req.status === 'pending'
          const waiting = isPending ? waitingDuration(req.createdAt) : null

          return (
            <div key={req.id ?? i} className={`flex items-center gap-3 px-4 py-3 ${isPending ? 'bg-amber-50/50' : ''}`}>
              {/* Health dot */}
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hs.dot}`} />

              {/* Device code */}
              <span className="font-mono text-xs font-bold text-gray-700 flex-shrink-0 min-w-[64px]">
                {group.code}
              </span>

              {/* Health badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${hs.badge}`}>
                {hs.label}
              </span>

              {/* Note (if any) */}
              {req.healthNote && (
                <span className="text-xs text-gray-500 truncate flex-1 min-w-0 hidden sm:block">
                  {req.healthNote}
                </span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Who · when */}
              <div className="flex items-center gap-2 flex-shrink-0 text-right">
                <div className="hidden sm:block">
                  <p className="text-[10px] font-semibold text-gray-600">{req.requestedByName || '—'}</p>
                  <p className="text-[10px] text-gray-400">{timeAgo(req.createdAt)}</p>
                </div>

                {isPending && canApprove ? (
                  <div className="flex items-center gap-1">
                    {waiting?.urgent && (
                      <span className="text-[9px] font-bold text-red-500 hidden sm:block">{waiting.label}</span>
                    )}
                    <button
                      onClick={() => onApprove(req, 'approve')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors"
                    >
                      <CheckCircle size={11} /> Approve
                    </button>
                    <button
                      onClick={() => onApprove(req, 'reject')}
                      className="flex items-center gap-1 px-2 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-bold transition-colors"
                    >
                      <XCircle size={11} />
                    </button>
                  </div>
                ) : isPending ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                    <Clock size={9} /> Pending
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border
                    ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {req.status === 'approved' ? <CheckCircle size={9} /> : <XCircle size={9} />}
                    {req.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}


// ─── DeviceEditRequestPanel ────────────────────────────────────────────────────
// Shows edit_device inventory requests — before/after diff, approve/reject
const fmtDT = (dt) => dt ? new Date(dt).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : null

const EditStatusBadge = ({ status }) => {
  const styles = {
    pending:  'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  }
  const labels = { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}

function DeviceEditRequestPanel({ requests, loading, userRole, canApprove, onRefresh }) {
  const [rejectingId,  setRejectingId]  = useState(null)
  const [rejectNote,   setRejectNote]   = useState('')
  const [actionBusy,   setActionBusy]   = useState(null)
  const [error,        setError]        = useState('')
  const norm = r => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')
  const isGroundTeam = norm(userRole) === 'groundteam'

  const filteredRequests = isGroundTeam
    ? requests  // ground team sees own (backend already filtered)
    : requests  // managers see all

  const handleApprove = async (id) => {
    setActionBusy(id); setError('')
    try {
      await inventoryRequestApi.approve(id)
      onRefresh()
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to approve')
    } finally { setActionBusy(null) }
  }

  const handleReject = async (id) => {
    if (!rejectNote.trim()) return
    setActionBusy(id); setError('')
    try {
      await inventoryRequestApi.reject(id, rejectNote)
      setRejectingId(null); setRejectNote('')
      onRefresh()
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to reject')
    } finally { setActionBusy(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
      <RefreshCw className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Pencil className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Device Edit Requests</h2>
            <p className="text-[11px] text-gray-400">
              Hardware attribute change requests
              {filteredRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 text-amber-600 font-semibold">
                  · {filteredRequests.filter(r => r.status === 'pending').length} pending
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={onRefresh} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Pencil className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No device edit requests</p>
        </div>
      ) : (
        filteredRequests.map(req => {
          const changes = req.proposedChanges || {}
          const changeFields = Object.keys(changes)
          const isPending = req.status === 'pending'
          const isRejecting = rejectingId === req.id

          return (
            <div
              key={req.id}
              className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${
                isPending ? 'border-amber-200' : 'border-gray-100'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-900">{req.targetDeviceCode || `Device #${req.targetDeviceId}`}</span>
                    <EditStatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Requested by <span className="font-medium text-gray-600">{req.requestedByName}</span>
                    {req.createdAt && <span> · {fmtDT(req.createdAt)}</span>}
                  </p>
                </div>
              </div>

              {/* Proposed changes diff */}
              {changeFields.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Proposed Changes</p>
                  {changeFields.map(field => (
                    <div key={field} className="flex items-center gap-2 text-xs">
                      <span className="capitalize text-gray-500 w-14 flex-shrink-0">{field}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                      <span className="font-semibold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded-lg border border-emerald-200">{changes[field]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Note */}
              {req.note && (
                <p className="text-xs text-gray-400 italic bg-gray-50 rounded-lg px-3 py-2">"{req.note}"</p>
              )}

              {/* Rejection note */}
              {req.rejectionNote && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection reason:</p>
                  <p className="text-xs text-red-600">{req.rejectionNote}</p>
                </div>
              )}

              {/* Actions — manager only, pending only */}
              {canApprove && isPending && (
                isRejecting ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      placeholder="Reason for rejection (required)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-red-200 rounded-xl focus:ring-2 focus:ring-red-400 outline-none resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setRejectingId(null); setRejectNote('') }}
                        className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                        Cancel
                      </button>
                      <button onClick={() => handleReject(req.id)} disabled={!rejectNote.trim() || actionBusy === req.id}
                        className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5 transition">
                        {actionBusy === req.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setRejectingId(req.id)}
                      className="flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition">
                      Reject
                    </button>
                    <button onClick={() => handleApprove(req.id)} disabled={actionBusy === req.id}
                      className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-1.5 transition">
                      {actionBusy === req.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve &amp; Apply
                    </button>
                  </div>
                )
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const Requests = ({ userRole }) => {
  const role         = normaliseRole(userRole)
  const isGroundTeam = role === ROLES.GROUNDTEAM
  const canApprove   = role === ROLES.SUPERADMIN || role === ROLES.MANAGER

  const { clients, devices, deviceSets, refresh: refreshContext } = useInventory()

  const [allRequests,      setAllRequests]      = useState([])
  const [summary,          setSummary]          = useState({ total: 0, byUser: {}, byStep: {} })
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [expandedCard,     setExpandedCard]     = useState(null)
  const [expandedTimeline, setExpandedTimeline] = useState(null)
  const [approveModal,     setApproveModal]     = useState(null)

  const [activeTab,        setActiveTab]        = useState('all')  // 'all' | 'deployments' | 'returns' | 'health' | 'completed'
  const [highlightId,      setHighlightId]      = useState(null)   // request id to scroll+highlight on load
  const location = useLocation()

  const [detailRequests,  setDetailRequests]  = useState([])
  const [detailReqLoading, setDetailReqLoading] = useState(false)

  // ── Deep-link: ?tab=inventory&highlight=42 ──────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    const hid = params.get('highlight')
    if (tab) setActiveTab(tab)
    if (hid) {
      setHighlightId(parseInt(hid))
      // After render, scroll the card into view and clear highlight after 3s
      setTimeout(() => {
        const el = document.getElementById(`req-${hid}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 600)
      setTimeout(() => setHighlightId(null), 3500)
    }
  }, [location.search]) // eslint-disable-line
  const [globalSearch,     setGlobalSearch]     = useState('')
  const [globalFilterClient, setGlobalFilterClient] = useState('')
  const [invRequests,        setInvRequests]        = useState([])
  const [invReqLoading,      setInvReqLoading]      = useState(false)

  const [groundUsers,  setGroundUsers]  = useState([])
  const fetchDetailRequests = useCallback(async () => {
    setDetailReqLoading(true)
    try {
      const data = await inventoryRequestApi.getAll({ requestType: 'edit_device' })
      setDetailRequests(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load detail requests:', e)
    } finally {
      setDetailReqLoading(false)
    }
  }, [])

  const fetchInvRequests = useCallback(async () => {
    try {
      setInvReqLoading(true)
      const data = await inventoryRequestApi.getAll()
      setInvRequests(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load inventory requests:', e)
    } finally {
      setInvReqLoading(false)
    }
  }, [])
  const deviceSetMapRef = useRef({})

  // Always fetch inv requests so pending tab count is accurate.
  // Also poll every 15s so the badge updates without needing SSE.
  useEffect(() => {
    fetchInvRequests()
    const id = setInterval(fetchInvRequests, 15_000)
    return () => clearInterval(id)
  }, [fetchInvRequests])

  useEffect(() => {
    if (activeTab === 'inventory') fetchInvRequests()
    if (activeTab === 'details') fetchDetailRequests()
  }, [activeTab, fetchInvRequests])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [data, sum] = await Promise.all([
        lifecycleRequestApi.getAll({}),
        canApprove ? lifecycleRequestApi.getSummary() : Promise.resolve(null),
      ])
      setAllRequests(data)
      if (sum) setSummary(sum)

      const map = {}
      for (const req of data) {
        const key = req.deviceId ? `device-${req.deviceId}` : `set-${req.setId}`
        if (!map[key]) {
          let clientIdFromNote = null
          if (req.toStep === 'assigning' && req.note) {
            try { const p = JSON.parse(req.note); if (p.clientId) clientIdFromNote = parseInt(p.clientId) } catch (_) {}
          }
          map[key] = { id: req.deviceId || req.setId, code: req.deviceCode || req.setCode, type: req.deviceType, isSet: !!req.setId, clientId: clientIdFromNote, clientName: null, currentStatus: null, healthStatus: 'ok' }
          if (clientIdFromNote && clients) {
            const c = clients.find(c => c.id === clientIdFromNote)
            if (c) map[key].clientName = c.name
          }
        }
      }
      // ── Seed map from devices/sets context ────────────────────────────────
      // Devices at in-progress statuses must appear on this page even if they
      // have no lifecycle request records (e.g. migrated from an older system,
      // or the request was created externally). Without this, devices like one
      // sitting at return_transit with an already-approved request but no pending
      // request are completely invisible to the Requests page.
      const IN_PROGRESS_STATUSES = new Set([
        'assigning', 'ready_to_deploy', 'in_transit', 'received', 'installed',
        'return_initiated', 'return_transit', 'under_maintenance',
      ])
      if (devices) {
        devices.forEach(d => {
          const key = `device-${d.id}`
          if (!map[key] && IN_PROGRESS_STATUSES.has(d.lifecycleStatus)) {
            // Device has no request records yet — seed it so it still appears
            const clientName = clients ? (clients.find(c => c.id === d.clientId)?.name ?? null) : null
            map[key] = {
              id: d.id, code: d.code, type: d.type, isSet: false,
              barcode: d.barcode ?? null,
              clientId: d.clientId ?? null, clientName,
              currentStatus: d.lifecycleStatus, healthStatus: d.healthStatus || 'ok',
            }
          }
          if (map[key]) {
            map[key].currentStatus = d.lifecycleStatus
            map[key].healthStatus  = d.healthStatus || 'ok'
            if (d.barcode) map[key].barcode = d.barcode
            if (d.clientId) {
              map[key].clientId = d.clientId
              if (clients) { const c = clients.find(c => c.id === d.clientId); if (c) map[key].clientName = c.name }
            }
          }
        })
      }
      if (deviceSets) {
        deviceSets.forEach(s => {
          const key = `set-${s.id}`
          if (!map[key] && IN_PROGRESS_STATUSES.has(s.lifecycleStatus)) {
            const clientName = clients ? (clients.find(c => c.id === s.clientId)?.name ?? null) : null
            map[key] = {
              id: s.id, code: s.code, type: s.setTypeName, isSet: true,
              barcode: s.barcode ?? null,
              clientId: s.clientId ?? null, clientName,
              currentStatus: s.lifecycleStatus, healthStatus: s.healthStatus || 'ok',
            }
          }
          if (map[key]) {
            map[key].currentStatus = s.lifecycleStatus
            map[key].healthStatus  = s.healthStatus || 'ok'
            if (s.clientId) {
              map[key].clientId = s.clientId
              if (clients) { const c = clients.find(c => c.id === s.clientId); if (c) map[key].clientName = c.name }
            }
          }
        })
      }
      deviceSetMapRef.current = map
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [canApprove, clients, devices, deviceSets])

  // ── refreshAll: syncs both local request records AND context devices/sets ──
  // This fixes the progress bar (which reads currentStatus from context devices)
  // not updating when only fetchRequests was called.
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchRequests(), refreshContext()])
  }, [fetchRequests, refreshContext])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    if (!canApprove) return
    fetch('/api/users', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const users = Array.isArray(data) ? data : []
        setGroundUsers(users.filter(u => u.role?.toLowerCase().replace(/\s/g, '') === 'groundteam'))
      })
      .catch(() => {})
  }, [canApprove])

  // ── Group ─────────────────────────────────────────────────────────────────
  const groupedRequests = useMemo(() => {
    const groups = {}

    // Build groups from request records first
    allRequests.forEach(req => {
      const key = req.deviceId ? `device-${req.deviceId}` : `set-${req.setId}`
      if (!groups[key]) {
        groups[key] = { key, deviceId: req.deviceId, setId: req.setId, code: req.deviceCode || req.setCode, type: req.deviceType, isSet: !!req.setId, info: deviceSetMapRef.current[key] || {}, pendingRequests: [], approvedHistory: [] }
      }
      if (req.status === 'pending')                          groups[key].pendingRequests.push(req)
      else groups[key].approvedHistory.push(req)  // approved, rejected, withdrawn
    })

    // Also create groups for devices/sets that are in-progress but have no
    // request records (seeded into deviceSetMap from the devices/sets context).
    Object.entries(deviceSetMapRef.current).forEach(([key, info]) => {
      if (!groups[key] && info.currentStatus) {
        const isSet = key.startsWith('set-')
        const entityId = parseInt(key.split('-')[1])
        groups[key] = {
          key,
          deviceId: isSet ? null : entityId,
          setId:    isSet ? entityId : null,
          code: info.code, type: info.type, isSet,
          info, pendingRequests: [], approvedHistory: [],
        }
      }
    })

    Object.values(groups).forEach(g => {
      // Always sync latest info from deviceSetMap (status may have changed)
      if (deviceSetMapRef.current[g.key]) g.info = deviceSetMapRef.current[g.key]
      g.pendingRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      g.approvedHistory.sort((a, b) => {
        const da = new Date(b.approvedAt || b.updatedAt || b.createdAt)
        const db = new Date(a.approvedAt || a.updatedAt || a.createdAt)
        return da - db
      })

      // ── Cycle trimming ────────────────────────────────────────────────────
      // One deploy→active→return sequence is one "cycle". When a device is
      // returned then re-assigned, a new cycle starts. We only keep the current
      // cycle in approvedHistory — old cycles are still visible in the device
      // timeline. Detection: walk oldest-first, find last "returned" then any
      // later "assigning" — that assigning marks the new cycle start.
      const sorted = [...g.approvedHistory].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      )
      let cycleStartIdx = 0
      let lastReturnedIdx = -1
      sorted.forEach((req, idx) => {
        if (req.toStep === 'returned') {
          lastReturnedIdx = idx
        } else if (req.toStep === 'assigning' && lastReturnedIdx !== -1 && idx > lastReturnedIdx) {
          cycleStartIdx = idx
          lastReturnedIdx = -1
        }
      })
      if (cycleStartIdx > 0) {
        g.approvedHistory = sorted.slice(cycleStartIdx).sort((a, b) => {
          const da = new Date(b.approvedAt || b.updatedAt || b.createdAt)
          const db = new Date(a.approvedAt || a.updatedAt || a.createdAt)
          return da - db
        })
      }
    })
    return Object.values(groups)
  // deviceSetMapRef is a ref (always current) — allRequests change is the trigger
  }, [allRequests])

  // Classification helpers
  const isDeployGroup  = (g) => {
    const s = g.info.currentStatus
    return DEPLOY_STEPS.includes(s) && s !== 'active'
  }
  const isReturnGroup  = (g) => {
    const s = g.info.currentStatus
    return RETURN_STEPS.includes(s) && s !== 'returned'
  }
  const isCompleted    = (g) => {
    const s = g.info.currentStatus
    return s === 'active' || s === 'returned'
  }
  // Journey classification — pending toStep always wins over currentStatus.
  // This ensures a pending return request on an "active" device shows in Returns.
  const journeyOf = (g) => {
    const pendingToStep = g.pendingRequests[0]?.toStep
    if (pendingToStep) {
      if (RETURN_STEPS.includes(pendingToStep)) return 'return'
      if (DEPLOY_STEPS.includes(pendingToStep)) return 'deploy'
    }
    if (!g.info.currentStatus) {
      const toStep = g.approvedHistory[0]?.toStep
      if (toStep && RETURN_STEPS.includes(toStep)) return 'return'
      return 'deploy'
    }
    if (isCompleted(g))   return 'completed'
    if (isReturnGroup(g)) return 'return'
    return 'deploy'
  }

  const sortByPendingThenDate = (a, b) => {
    const ap = a.pendingRequests.length > 0, bp = b.pendingRequests.length > 0
    if (ap !== bp) return ap ? -1 : 1
    const al = a.pendingRequests[0] || a.approvedHistory[0]
    const bl = b.pendingRequests[0] || b.approvedHistory[0]
    if (!al) return 1; if (!bl) return -1
    return new Date(bl.createdAt) - new Date(al.createdAt)
  }

  const deployGroups = useMemo(() =>
    groupedRequests.filter(g => journeyOf(g) === 'deploy').sort(sortByPendingThenDate),
    [groupedRequests]
  )
  const returnGroups = useMemo(() =>
    groupedRequests.filter(g => journeyOf(g) === 'return').sort(sortByPendingThenDate),
    [groupedRequests]
  )
  const completedGroups = useMemo(() =>
    groupedRequests
      .filter(g => journeyOf(g) === 'completed')
      .sort((a, b) => {
        const al = a.approvedHistory[0], bl = b.approvedHistory[0]
        if (!al) return 1; if (!bl) return -1
        return new Date(bl.approvedAt) - new Date(al.approvedAt)
      }),
    [groupedRequests]
  )

  // Health-only groups: devices/sets whose ONLY requests are health_update steps.
  // Lifecycle steps that happen to carry a healthStatus stay in deploy/return.
  const healthGroups = useMemo(() => {
    return groupedRequests
      .filter(g => {
        const allReqs = [...g.pendingRequests, ...g.approvedHistory]
        return allReqs.length > 0 && allReqs.every(r => r.toStep === 'health_update')
      })
      .sort(sortByPendingThenDate)
  }, [groupedRequests])

  // Filtered variants
  const applyFilter = (groups, search, clientFilter) =>
    groups.filter(g => {
      const q = search.toLowerCase()
      return (
        (!q || g.code?.toLowerCase().includes(q) || g.type?.toLowerCase().includes(q) || g.info.clientName?.toLowerCase().includes(q)) &&
        (!clientFilter || g.info.clientId === parseInt(clientFilter))
      )
    })

  const filteredDeployGroups    = useMemo(() => applyFilter(deployGroups,    globalSearch, globalFilterClient), [deployGroups,    globalSearch, globalFilterClient])
  const filteredReturnGroups    = useMemo(() => applyFilter(returnGroups,    globalSearch, globalFilterClient), [returnGroups,    globalSearch, globalFilterClient])
  const filteredHealthGroups    = useMemo(() => applyFilter(healthGroups,    globalSearch, globalFilterClient), [healthGroups,    globalSearch, globalFilterClient])
  const filteredCompletedGroups = useMemo(() => applyFilter(completedGroups, globalSearch, globalFilterClient), [completedGroups, globalSearch, globalFilterClient])

  // All groups that have at least one pending request — merged across deploy+return,
  // sorted most urgent first. Used by the "All" tab to surface pending items at the top.
  const allPendingGroups = useMemo(() => {
    const combined = [...filteredDeployGroups, ...filteredReturnGroups, ...filteredHealthGroups]
    return combined
      .filter(g => g.pendingRequests.length > 0)
      .sort(sortByPendingThenDate)
  }, [filteredDeployGroups, filteredReturnGroups, filteredHealthGroups])

  const counts = useMemo(() => ({
    pending:         allRequests.filter(r => r.status === 'pending').length,
    approved:        allRequests.filter(r => r.status === 'approved').length,
    rejected:        allRequests.filter(r => r.status === 'rejected').length,
    deployActive:    deployGroups.length,
    deployPending:   deployGroups.reduce((n, g) => n + g.pendingRequests.length, 0),
    returnActive:    returnGroups.length,
    returnPending:   returnGroups.reduce((n, g) => n + g.pendingRequests.length, 0),
    healthActive:    healthGroups.length,
    healthPending:   healthGroups.reduce((n, g) => n + g.pendingRequests.length, 0),
    completed:       completedGroups.length,
  }), [allRequests, deployGroups, returnGroups, healthGroups, completedGroups])

  // ── Tab definitions ────────────────────────────────────────────────────────
  const tabs = [
    {
      key: 'all',
      label: 'Pending',
      icon: <Hourglass size={13} />,
      pending: counts.deployPending + counts.returnPending + counts.healthPending + invRequests.filter(r => r.status === 'pending').length,
      accentActive: 'bg-amber-500 text-white border-amber-500',
      accentBadge: 'bg-white/25 text-white',
    },
    {
      key: 'deployments',
      label: 'Deployments',
      icon: <Truck size={13} />,
      pending: counts.deployPending,
      accentActive: 'bg-blue-600 text-white border-blue-600',
      accentBadge: 'bg-white/25 text-white',
    },
    {
      key: 'returns',
      label: 'Returns',
      icon: <ArrowRight size={13} className="rotate-180" />,
      pending: counts.returnPending,
      accentActive: 'bg-rose-600 text-white border-rose-600',
      accentBadge: 'bg-white/25 text-white',
    },
    {
      key: 'health',
      label: 'Health',
      icon: <Heart size={13} />,
      pending: counts.healthPending,
      accentActive: 'bg-cyan-600 text-white border-cyan-600',
      accentBadge: 'bg-white/25 text-white',
    },
    {
      key: 'completed',
      label: 'Completed',
      icon: <CheckCircle2 size={13} />,
      pending: 0,
      accentActive: 'bg-emerald-600 text-white border-emerald-600',
      accentBadge: 'bg-white/25 text-white',
    },
    {
      key: 'inventory',
      label: 'Inventory',
      icon: <Plus size={13} />,
      pending: invRequests.filter(r => r.status === 'pending').length,
      accentActive: 'bg-violet-600 text-white border-violet-600',
      accentBadge: 'bg-white/25 text-white',
    },
    {
      key: 'details',
      label: 'Details',
      icon: <Pencil size={13} />,
      pending: detailRequests.filter(r => r.status === 'pending').length,
      accentActive: 'bg-amber-500 text-white border-amber-500',
      accentBadge: 'bg-white/25 text-white',
    },
  ]

  // ── Section renderer (reusable) ─────────────────────────────────────────────
  const renderSection = ({ icon, title, subtitle, pendingCount, accentIcon, emptyIcon, emptyMsg, groups, hideNextStep = false }) => (
    <section>
      {/* Static section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accentIcon}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-bold text-text-primary leading-none">{title}</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            {subtitle}
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 font-bold px-2 py-0.5 rounded-full text-[11px]">
                <Clock size={10} className="flex-shrink-0" />
                {pendingCount} awaiting approval
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 px-6 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
              {emptyIcon}
            </div>
            <p className="text-sm font-bold text-text-secondary">{emptyMsg}</p>
            <p className="text-xs text-text-muted mt-1">Nothing here yet — check back later or try a different filter.</p>
          </div>
        ) : (
          groups.map(group => (
            <DeviceSetCard
              key={group.key}
              group={group}
              expanded={expandedCard === group.key}
              timelineExpanded={expandedTimeline === group.key}
              onToggle={() => setExpandedCard(expandedCard === group.key ? null : group.key)}
              onToggleTimeline={() => setExpandedTimeline(expandedTimeline === group.key ? null : group.key)}
              canApprove={canApprove}
              onApprove={(request, action) => setApproveModal({ request, action })}
              onRequestDone={refreshAll}
              hideNextStep={hideNextStep}
            />
          ))
        )}
      </div>
    </section>
  )

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            {isGroundTeam ? 'My Requests' : 'Request Management'}
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            {isGroundTeam
              ? 'Track your lifecycle change requests and their approval status'
              : 'Review, approve and track device lifecycle requests across your team'}
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-text-secondary hover:bg-gray-50 text-xs font-semibold transition-colors shadow-sm flex-shrink-0"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stats Bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Deployments tile — blue accent */}
        <div className="bg-white rounded-xl border border-blue-200 p-3 flex items-center gap-3 shadow-sm relative overflow-hidden" style={{ borderTop: '3px solid #60a5fa' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none rounded-xl" />
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 relative z-10">
            <Truck size={16} className="text-blue-600" />
          </div>
          <div className="min-w-0 relative z-10">
            <p className="text-xl font-bold text-text-primary leading-none">{counts.deployActive}</p>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">Deployments</p>
            {counts.deployPending > 0 && (
              <p className="text-[10px] font-bold text-amber-500 mt-0.5">{counts.deployPending} pending</p>
            )}
          </div>
        </div>
        {/* Returns tile — rose accent */}
        <div className="bg-white rounded-xl border border-rose-200 p-3 flex items-center gap-3 shadow-sm relative overflow-hidden" style={{ borderTop: '3px solid #fb7185' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent pointer-events-none rounded-xl" />
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0 relative z-10">
            <ArrowRight size={16} className="text-rose-500 rotate-180" />
          </div>
          <div className="min-w-0 relative z-10">
            <p className="text-xl font-bold text-text-primary leading-none">{counts.returnActive}</p>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">Returns</p>
            {counts.returnPending > 0 && (
              <p className="text-[10px] font-bold text-amber-500 mt-0.5">{counts.returnPending} pending</p>
            )}
          </div>
        </div>
        <StatTile label="Approved" value={counts.approved} icon={CheckCircle2} accent={{ bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', subText: 'text-emerald-500' }} />
        <StatTile label="Rejected" value={counts.rejected} icon={XCircle}     accent={{ bg: 'bg-red-50',     icon: 'text-red-500',     border: 'border-red-100',     subText: 'text-red-400'     }} />
        {/* Health tile — cyan accent */}
        <div className="bg-white rounded-xl border border-cyan-200 p-3 flex items-center gap-3 shadow-sm relative overflow-hidden col-span-2 sm:col-span-1" style={{ borderTop: '3px solid #22d3ee' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 to-transparent pointer-events-none rounded-xl" />
          <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0 relative z-10">
            <Heart size={16} className="text-cyan-600" />
          </div>
          <div className="min-w-0 relative z-10">
            <p className="text-xl font-bold text-text-primary leading-none">{counts.healthActive}</p>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">Health Changes</p>
            {counts.healthPending > 0 && (
              <p className="text-[10px] font-bold text-amber-500 mt-0.5">{counts.healthPending} pending</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Pending-by-user strip (managers only) ───────────────────────── */}
      {canApprove && counts.pending > 0 && summary.byUser && Object.keys(summary.byUser).length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Clock size={11} className="text-white" />
            </div>
            <span className="text-amber-900 text-xs font-extrabold tracking-tight">Awaiting Approval</span>
            <span className="bg-amber-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {counts.pending}
            </span>
          </div>
          <div className="w-px h-4 bg-amber-300 flex-shrink-0 hidden sm:block" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byUser).map(([name, count]) => (
              <span key={name} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs font-bold text-amber-900">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center flex-shrink-0">
                  {initials(name)}
                </span>
                {name}
                <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Error / Loading ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={refreshAll} className="ml-auto text-xs underline font-semibold">Retry</button>
        </div>
      )}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-muted font-medium">Loading requests…</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">

          {/* ── Tabs + Global Search ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Tab row — horizontal scroll on mobile */}
            <div className="flex overflow-x-auto border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
              {tabs.map(tab => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setGlobalSearch(''); setGlobalFilterClient('') }}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex-shrink-0
                      ${isActive
                        ? 'border-primary-600 text-primary-700 bg-primary-50'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-gray-50'
                      }`}
                  >
                    <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>{tab.icon}</span>
                    {tab.label}
                    {tab.pending > 0 && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
                        ${isActive
                          ? 'bg-amber-500 text-white'
                          : 'bg-amber-100 text-amber-700 border border-amber-300'
                        }`}>
                        <Hourglass size={9} />
                    {tab.pending > 9 ? '9+' : tab.pending}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Global search + filter row */}
            <div className="flex flex-col sm:flex-row gap-2 p-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === 'all' ? 'all requests' : activeTab}…`}
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-gray-50"
                />
                {globalSearch && (
                  <button onClick={() => setGlobalSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={12} />
                  </button>
                )}
              </div>
              <CustomSelect
                value={globalFilterClient}
                onChange={setGlobalFilterClient}
                placeholder="All Clients"
                options={clients?.map(c => ({ value: c.id, label: c.name })) || []}
              />
            </div>
          </div>

          {/* ── Tab Content ───────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* PENDING tab — only items awaiting approval */}
            {activeTab === 'all' && (
              <>
                {/* Pending inventory requests (add device / bulk add / make set) */}
                {invRequests.filter(r => r.status === 'pending').length > 0 && (
                  <div className="bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden mb-4">
                    <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                      <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">
                        📦 Pending Inventory Requests ({invRequests.filter(r => r.status === 'pending').length})
                      </span>
                    </div>
                    <InventoryRequestPanel
                      requests={invRequests.filter(r => r.status === 'pending')}
                      userRole="MANAGER"
                      onRefresh={fetchInvRequests}
                      compact
                    />
                  </div>
                )}
                {allPendingGroups.length === 0 && invRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 py-16 px-6 text-center shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 size={24} className="text-emerald-400" />
                    </div>
                    <p className="text-sm font-bold text-text-secondary">All clear!</p>
                    <p className="text-xs text-text-muted mt-1">No requests are waiting for approval right now.</p>
                  </div>
                ) : allPendingGroups.length > 0 ? (
                  renderSection({
                    icon: <Hourglass size={15} className="text-amber-600" />,
                    title: 'Awaiting Approval',
                    subtitle: `${allPendingGroups.reduce((n, g) => n + g.pendingRequests.length, 0)} request${allPendingGroups.reduce((n, g) => n + g.pendingRequests.length, 0) !== 1 ? 's' : ''} across all types`,
                    pendingCount: allPendingGroups.reduce((n, g) => n + g.pendingRequests.length, 0),
                    accentIcon: 'bg-amber-100',
                    emptyIcon: <Hourglass size={20} className="text-amber-300" />,
                    emptyMsg: '',
                    groups: allPendingGroups,
                  })
                ) : null}
              </>
            )}

            {/* DEPLOYMENTS tab */}
            {activeTab === 'deployments' && renderSection({
              icon: <Truck size={15} className="text-blue-600" />,
              title: 'Deployment Requests',
              subtitle: `${counts.deployActive} active`,
              pendingCount: counts.deployPending,
              accentIcon: 'bg-blue-100',
              emptyIcon: <Truck size={20} className="text-blue-300" />,
              emptyMsg: 'No active deployment requests',
              groups: filteredDeployGroups,
            })}

            {/* RETURNS tab */}
            {activeTab === 'returns' && renderSection({
              icon: <ArrowRight size={15} className="text-rose-500 rotate-180" />,
              title: 'Return Requests',
              subtitle: `${counts.returnActive} active`,
              pendingCount: counts.returnPending,
              accentIcon: 'bg-rose-100',
              emptyIcon: <ArrowRight size={20} className="text-rose-300 rotate-180" />,
              emptyMsg: 'No active return requests',
              groups: filteredReturnGroups,
            })}

            {/* HEALTH tab — compact log view */}
            {activeTab === 'health' && (
              <HealthLogView
                groups={filteredHealthGroups}
                canApprove={canApprove}
                onApprove={(request, action) => setApproveModal({ request, action })}
              />
            )}

            {/* COMPLETED tab */}
            {activeTab === 'completed' && renderSection({
              icon: <CheckCircle2 size={15} className="text-emerald-600" />,
              title: 'Completed',
              subtitle: `${counts.completed} devices · active or returned to warehouse`,
              pendingCount: 0,
              accentIcon: 'bg-emerald-100',
              emptyIcon: <CheckCircle2 size={20} className="text-emerald-300" />,
              emptyMsg: 'No completed requests found',
              groups: filteredCompletedGroups,
            })}


            {/* DETAILS (edit_device) REQUESTS tab */}
            {activeTab === 'details' && (
              <DeviceEditRequestPanel
                requests={detailRequests}
                loading={detailReqLoading}
                userRole={userRole}
                canApprove={canApprove}
                onRefresh={fetchDetailRequests}
              />
            )}

            {/* INVENTORY REQUESTS tab */}
            {activeTab === 'inventory' && (
              <InventoryRequestPanel
                requests={invRequests}
                loading={invReqLoading}
                userRole={userRole}
                canApprove={canApprove}
                onRefresh={fetchInvRequests}
                highlightId={highlightId}
              />
            )}

          </div>
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {approveModal && (
        <ApproveModal
          request={approveModal.request}
          action={approveModal.action}
          onClose={() => setApproveModal(null)}
          onDone={() => { setApproveModal(null); refreshAll() }}
        />
      )}

    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// NEXT STEP REQUEST PANEL
// Inline slide-down panel inside expanded card (no pending requests).
// Ground Team → creates pending request. Manager → auto-approved.
// ═══════════════════════════════════════════════════════════════════════════════
const HEALTH_OPTIONS_PANEL = [
  { value: 'ok',      label: 'Healthy',       dot: 'bg-emerald-500', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { value: 'repair',  label: 'Needs Repair',  dot: 'bg-amber-400',   cls: 'border-amber-200  bg-amber-50  text-amber-800'  },
  { value: 'damaged', label: 'Damaged',       dot: 'bg-red-500',     cls: 'border-red-200    bg-red-50    text-red-800'    },
]

// Steps that require a client picker (handled via barcode only — skip here)
const BARCODE_ONLY_STEPS = new Set(['assigning'])

// Steps that have multiple options to pick from
const MULTI_NEXT_STEPS = {
  active:            ['return_initiated', 'under_maintenance', 'lost'],
  under_maintenance: ['return_initiated', 'active', 'lost'],
}

const NextStepPanel = ({ group, canApprove, onDone, open, setOpen }) => {
  const { info, isSet, pendingRequests } = group
  const currentStatus = info.currentStatus || ''
  const deviceId      = group.deviceId
  const setId         = group.setId

  // Determine available next steps
  const validNextSteps = (VALID_NEXT_STEPS[currentStatus] || []).filter(s => !BARCODE_ONLY_STEPS.has(s) && s !== 'health_update')

  // Terminal / completed — no panel
  const isTerminal = ['returned', 'available', 'lost'].includes(currentStatus) || validNextSteps.length === 0

  const [chosenStep,  setChosenStep]  = useState(validNextSteps.length === 1 ? validNextSteps[0] : '')
  const [health,      setHealth]      = useState('ok')
  const [healthNote,  setHealthNote]  = useState('')
  const [note,        setNote]        = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // ── Warehouse location — mandatory when step is 'returned' ───────────────
  // Pre-fill from the device/set's last known warehouse location (from context)
  const { devices, deviceSets } = useInventory()
  const entityData = React.useMemo(() => {
    if (deviceId) return devices?.find(d => d.id === deviceId) || null
    if (setId)    return deviceSets?.find(s => s.id === setId) || null
    return null
  }, [deviceId, setId, devices, deviceSets])

  const [returnWarehouseId,       setReturnWarehouseId]       = useState(entityData?.warehouseId || null)
  const [returnWarehouseZone,     setReturnWarehouseZone]     = useState(entityData?.warehouseZone || '')
  const [returnWarehouseSpecific, setReturnWarehouseSpecific] = useState(entityData?.warehouseSpecificLocation || '')

  const isReturned             = chosenStep === 'returned'
  const returnWarehouseMissing = isReturned && !returnWarehouseId

  // Proof files managed by shared hook
  const proof = useProofFiles()

  // Reset panel when group changes
  const isMountedRef = React.useRef(false)
  React.useEffect(() => {
    if (!isMountedRef.current) { isMountedRef.current = true; return }
    setOpen(false)
    setChosenStep(validNextSteps.length === 1 ? validNextSteps[0] : '')
    setHealth('ok'); setHealthNote(''); setNote('')
    setSubmitting(false); setDone(false); setSubmitError(null)
    proof.reset()
    // Reset warehouse state to current entity data
    setReturnWarehouseId(entityData?.warehouseId || null)
    setReturnWarehouseZone(entityData?.warehouseZone || '')
    setReturnWarehouseSpecific(entityData?.warehouseSpecificLocation || '')
  }, [group.key]) // eslint-disable-line

  // Also reset proof files when step changes (different proof requirements)
  const handleStepChange = (step) => {
    setChosenStep(step)
    proof.reset()
    setSubmitError(null)
  }

  // Also reset proof when health changes (health may trigger different proof config)
  const handleHealthChange = (val) => {
    setHealth(val)
    if (val === 'ok') setHealthNote('')
    proof.reset()
    setSubmitError(null)
  }

  if (isTerminal) return null

  const isMulti  = validNextSteps.length > 1
  const stepMeta = chosenStep ? STEP_META[chosenStep] : null

  // ── Proof config logic (mirrors HealthConfirm in BarcodeResultCard) ──────────
  const stepProofCfg  = chosenStep ? PROOF_CONFIG[chosenStep] : null
  const healthTrigger = HEALTH_REQUIRES_PROOF.includes(health)
  const effectiveProof = stepProofCfg
    ? stepProofCfg
    : healthTrigger
    ? {
        required:   true,
        accept:     'image/*,video/*,application/pdf',
        allowVideo: true,
        allowPdf:   true,
        hint:       '🩺 Proof required when marking a device as damaged or in need of repair. Attach a photo or document.',
      }
    : null

  const proofRequired = !!effectiveProof?.required
  const proofMissing  = proofRequired && proof.files.length === 0
  const canSubmit     = chosenStep
    && (health === 'ok' || healthNote.trim())
    && !proofMissing
    && !returnWarehouseMissing

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (returnWarehouseMissing) { setSubmitError('Please select a warehouse location before confirming return.'); return }
      if (proofMissing) setSubmitError(`Proof is required for the '${stepMeta?.label ?? chosenStep}' step. Please attach at least one photo, video, or document.`)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      // For 'returned' step, encode warehouse location into note JSON (same format as LifecycleActionModal)
      let submitNote = note.trim() || undefined
      if (chosenStep === 'returned') {
        submitNote = JSON.stringify({
          warehouseId:               returnWarehouseId,
          warehouseZone:             returnWarehouseZone     || null,
          warehouseSpecificLocation: returnWarehouseSpecific || null,
          _note: note.trim() || undefined,
        })
      }
      await lifecycleRequestApi.create(
        {
          ...(deviceId ? { deviceId } : { setId }),
          toStep:       chosenStep,
          healthStatus: health,
          healthNote:   health !== 'ok' ? healthNote.trim() : undefined,
          note:         submitNote,
        },
        proof.files,
      )
      setDone(true)
      setTimeout(() => { setOpen(false); setDone(false); onDone() }, 1200)
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit request')
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 pb-4">
      {(() => { return (
        <div className="rounded-xl border-2 border-primary-200 bg-white overflow-hidden shadow-md">

          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-500">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Send size={12} className="text-white" />
            </div>
            <p className="text-xs font-extrabold text-white tracking-wide uppercase">Request Next Step</p>
            {canApprove && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-200 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
                <Zap size={9} /> Will auto-approve
              </span>
            )}
            <button
              onClick={() => setOpen(false)}
              className="ml-auto p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={14} className="text-white" />
            </button>
          </div>

          <div className="p-4 space-y-4">

            {/* Step picker (multi-option steps) */}
            {isMulti && (
              <div>
                <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest mb-2">Select Next Step</p>
                <div className="flex flex-col gap-2">
                  {validNextSteps.map(step => {
                    const meta     = STEP_META[step]
                    const selected = chosenStep === step
                    const needsProof = !!PROOF_CONFIG[step]?.required
                    return (
                      <button
                        key={step}
                        onClick={() => handleStepChange(step)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                          ${selected
                            ? `${meta.bgClass} ${meta.borderClass} ${meta.textClass} shadow-sm`
                            : 'border-gray-200 bg-gray-50 text-text-secondary hover:border-gray-300 hover:bg-gray-100'
                          }`}
                      >
                        <span className="text-lg flex-shrink-0">{meta.emoji}</span>
                        <span className="text-xs font-bold">{meta.label}</span>
                        {needsProof && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            <Paperclip size={9} /> Proof
                          </span>
                        )}
                        {selected && <CheckCircle2 size={14} className="ml-auto flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Single step confirmation */}
            {!isMulti && stepMeta && (
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${stepMeta.bgClass} ${stepMeta.borderClass}`}>
                <span className="text-xl">{stepMeta.emoji}</span>
                <div className="flex-1">
                  <p className={`text-xs font-extrabold ${stepMeta.textClass}`}>{stepMeta.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Requesting transition from <span className="font-bold">{STEP_META[currentStatus]?.label ?? currentStatus}</span>
                  </p>
                </div>
                {stepProofCfg?.required && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex-shrink-0">
                    <Paperclip size={9} /> Proof required
                  </span>
                )}
              </div>
            )}

            {/* Health status */}
            <div>
              <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Heart size={10} className="text-rose-400" />
                Device Health <span className="text-rose-500">*</span>
              </p>
              <div className="flex gap-2">
                {HEALTH_OPTIONS_PANEL.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleHealthChange(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border-2 text-[11px] font-bold transition-all
                      ${health === opt.value ? opt.cls + ' border-opacity-100 shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Health note (required if not ok) */}
            {health !== 'ok' && (
              <div>
                <label className="block text-[10px] font-extrabold text-text-muted uppercase tracking-widest mb-1.5">
                  Health Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={healthNote}
                  onChange={e => setHealthNote(e.target.value)}
                  rows={2}
                  placeholder="Describe the issue…"
                  maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
                />
              </div>
            )}

            {/* ── WAREHOUSE LOCATION — mandatory for 'returned' step ─────── */}
            {isReturned && (
              <div className="border-2 border-teal-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border-b border-teal-200">
                  <MapPin size={12} className="text-teal-600 flex-shrink-0" />
                  <p className="text-[10px] font-extrabold text-teal-800 uppercase tracking-widest">
                    Return Warehouse Location <span className="text-rose-500">*</span>
                  </p>
                  {returnWarehouseId && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-100 border border-teal-300 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 size={9} /> Set
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-teal-700">
                    {entityData?.warehouseId
                      ? 'Pre-filled with last known location — update if device is going somewhere different.'
                      : 'Confirm where this device/set will be stored on return.'}
                  </p>
                  <WarehouseLocationSelector
                    warehouseId={returnWarehouseId}
                    zone={returnWarehouseZone}
                    specificLocation={returnWarehouseSpecific}
                    onWarehouseChange={v => { setReturnWarehouseId(v); setReturnWarehouseZone('') }}
                    onZoneChange={setReturnWarehouseZone}
                    onSpecificLocationChange={setReturnWarehouseSpecific}
                    required={true}
                  />
                  {returnWarehouseMissing && submitError && (
                    <p className="text-[10px] text-rose-600 flex items-center gap-1">
                      <AlertTriangle size={10} /> Please select a warehouse.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── PROOF UPLOAD ────────────────────────────────────────── */}
            {effectiveProof && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                    <Paperclip size={10} className="text-indigo-500" />
                    Proof Attachment
                    <span className="text-rose-500">*</span>
                    {!stepProofCfg && healthTrigger && (
                      <span className="text-[9px] text-rose-500 font-normal normal-case ml-1">(required for this health status)</span>
                    )}
                  </p>
                  {proof.files.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 size={9} />
                      {proof.files.length}/{MAX_PROOF_FILES} ready
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <ProofUploadPanel
                    proofConfig={effectiveProof}
                    files={proof.files}
                    previews={proof.previews}
                    onAdd={proof.add}
                    onRemove={proof.remove}
                    compact={true}
                  />
                </div>
              </div>
            )}

            {/* No-proof steps: small reassurance message */}
            {!effectiveProof && chosenStep && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" />
                <p className="text-[10px] text-green-700 font-medium">No proof attachment required for this step.</p>
              </div>
            )}

            {/* Optional note */}
            <div>
              <label className="block text-[10px] font-extrabold text-text-muted uppercase tracking-widest mb-1.5">
                Note <span className="text-gray-400 font-medium normal-case">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Any additional context…"
                maxLength={300}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
              />
            </div>

            {/* Inline error (replaces browser alert) */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 flex-1">{submitError}</p>
                <button onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-200 text-text-secondary rounded-lg hover:bg-gray-50 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-extrabold transition-all shadow-sm
                  ${done
                    ? 'bg-emerald-600'
                    : canSubmit && !submitting
                    ? 'bg-primary-600 hover:bg-primary-700 active:scale-95'
                    : 'bg-gray-300 cursor-not-allowed'
                  }`}
              >
                {done ? (
                  <><CheckCircle2 size={13} /> Submitted!</>
                ) : submitting ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                ) : canApprove ? (
                  <><Zap size={13} /> Approve & Advance</>
                ) : (
                  <><Send size={13} /> Submit Request</>
                )}
              </button>
            </div>

          </div>
        </div>
      )})()}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE / SET CARD
// ═══════════════════════════════════════════════════════════════════════════════
// ── 3-DOT CARD MENU ──────────────────────────────────────────────────────────
const CardMenu = ({ barcode, deviceCode }) => {
  const [open,   setOpen]   = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const menuRef             = React.useRef(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleCopy = (e) => {
    e.stopPropagation()
    const text = barcode || deviceCode || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1500)
    })
  }

  return (
    <div className="relative flex-shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors
          ${open ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
        title="More options"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Device Info</p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Barcode</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-1.5">
              <code className="text-xs font-mono text-gray-700 flex-1 select-all break-all leading-snug">
                {barcode || deviceCode || '—'}
              </code>
              <button
                onClick={handleCopy}
                className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-all
                  ${copied ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                title="Copy barcode"
              >
                {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
              </button>
            </div>
            {copied && (
              <p className="text-[10px] text-emerald-600 font-semibold mt-1 text-center">✓ Copied to clipboard</p>
            )}
          </div>
          {deviceCode && barcode && deviceCode !== barcode && (
            <div className="px-3 pb-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Device Code</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-1.5">
                <code className="text-xs font-mono text-gray-700 flex-1">{deviceCode}</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const DeviceSetCard = ({
  group, expanded, timelineExpanded,
  onToggle, onToggleTimeline,
  canApprove, onApprove, onRequestDone,
  hideNextStep = false
}) => {
  const { code, type, isSet, info, pendingRequests, approvedHistory } = group
  const currentStatus = info.currentStatus || 'assigning'
  const health        = info.healthStatus  || 'ok'
  const clientName    = info.clientName
  const isReturn      = isReturnJourney(currentStatus)
  const hasPending    = pendingRequests.length > 0
  const healthInfo    = HEALTH_STYLE[health] || HEALTH_STYLE.ok
  const IconComponent = isSet ? Layers : Monitor
  const latestPending = pendingRequests[0]
  const stepMeta      = latestPending ? STEP_META[latestPending.toStep] : null
  const waiting       = latestPending ? waitingDuration(latestPending.createdAt) : null
  const [mobileTrayCopen, setMobileTrayCopen] = React.useState(false)
  const [nextStepOpen,    setNextStepOpen]    = React.useState(false)

  // Client color hash for avatar
  const clientColor = (() => {
    const colors = [
      'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500',
      'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-indigo-500'
    ]
    if (!clientName) return 'bg-gray-400'
    const idx = clientName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
    return colors[idx]
  })()

  return (
    <>
    <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden transition-all duration-200
      ${hasPending
        ? 'border-amber-300 shadow-amber-50'
        : expanded
        ? 'border-primary-200 shadow-md'
        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
    >
      {/* Urgency bar */}
      {hasPending && (
        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300" />
      )}

      {/* ── Desktop: Two-panel layout | Mobile: stacked ──────────────────── */}
      <div className="lg:flex lg:items-stretch lg:divide-x lg:divide-gray-100">

        {/* ── LEFT / MAIN PANEL ── always visible, clickable ──────────────── */}
        <div className="flex-1 p-4 cursor-pointer select-none min-w-0" onClick={onToggle}>
          <div className="flex items-start gap-3">

            {/* Client avatar (primary) */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-sm ${clientColor}`}>
              {clientName ? initials(clientName) : <Building2 size={18} />}
            </div>

            <div className="flex-1 min-w-0">
              {/* PRIMARY: Client name */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-text-primary text-base leading-tight">
                  {clientName || 'Unassigned'}
                </span>
                {hasPending && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    <Clock size={8} /> {pendingRequests.length} pending
                  </span>
                )}
                {health !== 'ok' && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${healthInfo.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${healthInfo.dot}`} />
                    {healthInfo.label}
                  </span>
                )}
              </div>

              {/* SECONDARY: device code · type · status */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                  ${isSet ? 'bg-violet-100' : 'bg-blue-100'}`}>
                  <IconComponent size={10} className={isSet ? 'text-violet-600' : 'text-blue-600'} />
                </div>
                <span className="text-xs font-semibold text-text-secondary">{code}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-[11px] text-text-muted bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                  {type}
                </span>
                {(() => {
                  const sm = STEP_META[currentStatus]
                  return sm ? (
                    <>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${sm.bgClass} ${sm.textClass} ${sm.borderClass}`}>
                        {sm.emoji} {sm.label}
                      </span>
                    </>
                  ) : null
                })()}
              </div>

              {/* Pending preview (mobile only — desktop shows in right panel) */}
              {latestPending && stepMeta && (
                <button
                  className="mt-2 lg:hidden flex items-center gap-2 flex-wrap w-full text-left"
                  onClick={e => { e.stopPropagation(); setMobileTrayCopen(true) }}
                >
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${stepMeta.bgClass} ${stepMeta.textClass} ${stepMeta.borderClass}`}>
                    <ArrowRight size={9} /> {stepMeta.emoji} {stepMeta.label}
                  </div>
                  <span className={`text-[10px] font-bold ${waiting?.urgent ? 'text-red-500' : 'text-amber-600'}`}>
                    waiting {waiting?.label}
                  </span>
                  <span className="ml-auto text-[10px] font-bold text-primary-600 underline underline-offset-2">Tap to review →</span>
                </button>
              )}
            </div>

            {/* Top-right: Health Report + Next Step button + 3-dot menu + Chevron */}
            <div className="flex items-center gap-2 flex-shrink-0 mt-1" onClick={e => e.stopPropagation()}>
              <CardMenu barcode={info.barcode} deviceCode={code} />

              {!hasPending && !hideNextStep && (() => {
                const validSteps = (VALID_NEXT_STEPS[currentStatus] || []).filter(s => s !== 'assigning' && s !== 'health_update')
                const isTerminal = ['returned', 'available', 'lost'].includes(currentStatus) || validSteps.length === 0
                if (isTerminal) return null
                const nextStep   = validSteps.length === 1 ? validSteps[0] : null
                const meta       = nextStep ? STEP_META[nextStep] : null
                return (
                  <button
                    onClick={() => {
                      setNextStepOpen(o => !o)
                      if (!expanded) onToggle()
                    }}
                    className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all
                      ${nextStepOpen
                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                        : 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100 hover:border-primary-300'
                      }`}
                  >
                    <Plus size={11} />
                    {meta ? <>{meta.emoji} {meta.label}</> : 'Next Step'}
                  </button>
                )
              })()}
              <div className="text-gray-400">
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>

          {/* Step track */}
          <div className="mt-3">
            <StepTrack currentStatus={currentStatus} pendingStep={latestPending?.toStep} />
          </div>
        </div>

        {/* ── RIGHT PANEL (desktop only): pending request quick view ──────── */}
        {hasPending && latestPending && stepMeta && (
          <div className="hidden lg:flex flex-col justify-between gap-3 px-5 py-4 min-w-[260px] max-w-[300px] bg-gradient-to-br from-amber-400 to-orange-400 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Decorative background circle */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-2 relative z-10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="text-xs font-extrabold text-white uppercase tracking-widest">Awaiting Approval</p>
              </div>
              {pendingRequests.length > 1 && (
                <span className="ml-auto bg-white/30 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0">
                  +{pendingRequests.length - 1} more
                </span>
              )}
            </div>

            {/* Step badge */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 border border-white/30 backdrop-blur-sm w-full">
                <span className="text-lg">{stepMeta.emoji}</span>
                <span className="text-sm font-extrabold text-white truncate">{stepMeta.label}</span>
              </div>
            </div>

            {/* Requester + waiting */}
            <div className="flex items-center gap-2 relative z-10">
              <span className="w-7 h-7 rounded-full bg-white/30 border-2 border-white/50 text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 shadow-sm">
                {initials(latestPending.requestedByName)}
              </span>
              <span className="text-sm font-bold text-white truncate">{latestPending.requestedByName}</span>
              <span className={`ml-auto text-sm font-extrabold flex-shrink-0 px-2 py-0.5 rounded-full
                ${waiting?.urgent ? 'bg-red-500 text-white' : 'bg-white/25 text-white'}`}>
                {waiting?.label}
              </span>
            </div>

            {/* Action buttons */}
            {canApprove && (
              <div className="flex gap-2 relative z-10">
                <button
                  onClick={() => onApprove(latestPending, 'approve')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-extrabold transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <CheckCircle size={13} /> Approve
                </button>
                <button
                  onClick={() => onApprove(latestPending, 'reject')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/20 hover:bg-white/30 border border-white/40 text-white rounded-xl text-xs font-extrabold transition-all active:scale-95"
                >
                  <XCircle size={13} /> Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Expanded body ────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-100 bg-background-secondary">

          {/* Pending requests section */}
          {pendingRequests.length > 0 && (
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={11} className="text-amber-500" />
                Pending Approval · {pendingRequests.length}
              </p>
              {pendingRequests.map((req, idx) => (
                <PendingRequestItem
                  key={req.id}
                  request={req}
                  index={idx}
                  total={pendingRequests.length}
                  canApprove={canApprove}
                  onApprove={onApprove}
                />
              ))}
            </div>
          )}

          {/* All caught up + Next Step panel */}
          {pendingRequests.length === 0 && !hideNextStep && (
            <>
              <div className="px-4 py-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 border-b border-gray-100">
                <CheckCircle2 size={14} className="text-emerald-500" />
                No pending requests — all caught up
              </div>
              {nextStepOpen && (
                <div className="pt-3">
                  <NextStepPanel
                    group={group}
                    canApprove={canApprove}
                    onDone={onRequestDone}
                    open={nextStepOpen}
                    setOpen={setNextStepOpen}
                  />
                </div>
              )}
            </>
          )}

          {/* Unified history — fetches all statuses (approved/rejected/withdrawn) */}
          <div className="px-4 pb-4">
            <LifecycleTimeline
              deviceId={isSet ? null : group.deviceId}
              setId={isSet ? group.setId : null}
            />
          </div>
        </div>
      )}
    </div>

    {/* Mobile action tray */}
    {mobileTrayCopen && hasPending && (
      <MobileActionTray
        group={group}
        canApprove={canApprove}
        onApprove={onApprove}
        onClose={() => setMobileTrayCopen(false)}
      />
    )}
    </>
  )
}
// ═══════════════════════════════════════════════════════════════════════════════
const PendingRequestItem = ({ request: req, index, total, canApprove, onApprove }) => {
  const meta       = STEP_META[req.toStep] || { label: req.toStep, emoji: '📋', bgClass: 'bg-gray-100', textClass: 'text-gray-700', borderClass: 'border-gray-200' }
  const isComplex  = isComplexRequest(req)
  const waiting    = waitingDuration(req.createdAt)
  const healthInfo = HEALTH_STYLE[req.healthStatus] || HEALTH_STYLE.ok

  return (
    <div className={`rounded-xl border overflow-hidden
      ${isComplex ? 'border-amber-300' : 'border-gray-200'}`}>

      {/* Item header */}
      <div className={`px-3 py-2 flex items-center justify-between gap-2 border-b
        ${isComplex ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
            {initials(req.requestedByName)}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary">{req.requestedByName}</span>
            <span className="text-[10px] text-text-muted ml-1.5">{timeAgo(req.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border
            ${waiting.urgent ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
            <Hourglass size={9} /> {waiting.label}
          </span>
          {isComplex && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full border border-amber-300">
              <AlertTriangle size={9} /> Attention
            </span>
          )}
          {total > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">
              {index + 1}/{total}
            </span>
          )}
        </div>
      </div>

      {/* Item body */}
      <div className="p-3 bg-white space-y-2.5">

        {/* Requested step */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide">Requesting</span>
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}>
            {meta.emoji} {meta.label}
          </span>
        </div>

        {/* Health */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide">Health</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${healthInfo.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${healthInfo.dot}`} />
            {healthInfo.label}
          </span>
        </div>

        {/* Health note */}
        {req.healthNote && (
          <div className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-0.5">Health Report</p>
              <p className="text-xs text-red-800">{req.healthNote}</p>
            </div>
          </div>
        )}

        {/* Note */}
        {req.note && req.note.length > 0 && !req.note.startsWith('{') && (
          <div className="flex gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <FileText size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">{req.note}</p>
          </div>
        )}

        {/* Actions */}
        {canApprove && (
          <div className="flex items-center gap-1.5 pt-0.5 justify-end">
            <button
              onClick={() => onApprove(req, 'approve')}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm"
            >
              <CheckCircle size={11} /> Approve
            </button>
            <button
              onClick={() => onApprove(req, 'reject')}
              className="flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-[11px] font-bold transition-all"
            >
              <XCircle size={11} /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE / REJECT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const ApproveModal = ({ request: req, action, onClose, onDone }) => {
  const [rejectionNote, setRejectionNote] = useState('')
  const [loading,       setLoading]       = useState(false)
  const [submitError,   setSubmitError]   = useState(null)
  const meta       = STEP_META[req.toStep] || { label: req.toStep, emoji: '📋', bgClass: 'bg-gray-100', textClass: 'text-gray-700' }
  const waiting    = waitingDuration(req.createdAt)
  const healthInfo = HEALTH_STYLE[req.healthStatus] || HEALTH_STYLE.ok
  const isApprove  = action === 'approve'

  const handleSubmit = async () => {
    if (!isApprove && !rejectionNote.trim()) { setSubmitError('Please provide a rejection reason'); return }
    setLoading(true)
    setSubmitError(null)
    try {
      if (isApprove) await lifecycleRequestApi.approve(req.id)
      else await lifecycleRequestApi.reject(req.id, rejectionNote)
      onDone()
    } catch (err) {
      setSubmitError(`Failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Colour top bar */}
        <div className={`h-1.5 rounded-t-2xl ${isApprove ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} />

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${meta.bgClass}`}>
              {meta.emoji}
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-sm">{isApprove ? 'Approve Request' : 'Reject Request'}</h3>
              <p className={`text-xs font-semibold ${meta.textClass}`}>{meta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 space-y-4">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Device / Set</p>
              <p className="text-sm font-bold text-text-primary">{req.deviceCode || req.setCode}</p>
              {req.deviceType && <p className="text-[10px] text-text-muted mt-0.5">{req.deviceType}</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Requested By</p>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                  {initials(req.requestedByName)}
                </div>
                <p className="text-xs font-bold text-text-primary truncate">{req.requestedByName}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Health</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${healthInfo.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${healthInfo.dot}`} />
                {healthInfo.label}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Waiting</p>
              <p className={`text-sm font-bold ${waiting.urgent ? 'text-red-600' : 'text-amber-600'}`}>{waiting.label}</p>
              <p className="text-[10px] text-text-muted">{timeAgo(req.createdAt)}</p>
            </div>
          </div>

          {/* Health note */}
          {req.healthNote && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Health Note</p>
                <p className="text-xs text-amber-800">{req.healthNote}</p>
              </div>
            </div>
          )}

          {/* ── Proof attachments ──────────────────────────────────── */}
          {req.proofFiles && req.proofFiles.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Paperclip size={10} />
                  Proof Attachments
                </p>
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                  {req.proofFiles.length} file{req.proofFiles.length > 1 ? 's' : ''}
                </span>
              </div>
              {/* Thumbnails */}
              <div className="p-3">
                <ProofFilesPanel proofFiles={req.proofFiles} />
              </div>
            </div>
          )}

          {/* Note */}
          {req.note && !req.note.startsWith('{') && (
            <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <FileText size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-0.5">Note</p>
                <p className="text-xs text-blue-800">{req.note}</p>
              </div>
            </div>
          )}

          {/* Rejection textarea */}
          {!isApprove && (
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                rows={3}
                placeholder="Explain why this request is being rejected…"
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none"
              />
              <p className="text-[10px] text-text-muted text-right mt-1">{rejectionNote.length}/500</p>
            </div>
          )}

          {/* Inline error */}
          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 flex-1">{submitError}</p>
              <button onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Confirm message */}
          <p className={`text-xs font-semibold text-center rounded-xl p-2.5 border
            ${isApprove ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
            {isApprove
              ? `This will advance the device to "${meta.label}"`
              : 'This will reject and notify the ground team member'}
          </p>

          {/* Buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-text-secondary rounded-xl hover:bg-gray-50 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm
                ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
                ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
                : isApprove
                ? <><CheckCircle size={13} /> Confirm Approval</>
                : <><XCircle size={13} /> Confirm Rejection</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


export default Requests