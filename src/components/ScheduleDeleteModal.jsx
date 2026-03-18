/**
 * src/components/ScheduleDeleteModal.jsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Confirmation modal for scheduling a deferred deletion (device or set).
 * Requires a typed reason before the button enables.
 * Shows what will be deleted, current status, client if assigned, components.
 *
 * Props:
 *   entity       — device or set object
 *   entityType   — 'device' | 'set'
 *   onConfirm    — async (reason) => void  — called with the typed reason
 *   onClose      — () => void
 */

import { useState } from 'react'
import { X, Trash2, Clock, AlertTriangle, Package, Layers, User, MapPin, ChevronDown, ChevronUp } from 'lucide-react'

const BLOCKED_STATUSES = new Set([
  'assigning', 'ready_to_deploy', 'in_transit', 'received',
  'installed', 'active', 'under_maintenance', 'return_initiated', 'return_transit',
])

const STATUS_LABEL = {
  available:        { label: 'Available',         color: 'text-slate-600  bg-slate-100' },
  warehouse:        { label: 'In Warehouse',       color: 'text-slate-600  bg-slate-100' },
  assigning:        { label: 'Assigning',          color: 'text-amber-700  bg-amber-100' },
  ready_to_deploy:  { label: 'Ready to Deploy',    color: 'text-teal-700   bg-teal-100'  },
  in_transit:       { label: 'In Transit',         color: 'text-amber-700  bg-amber-100' },
  received:         { label: 'Received',           color: 'text-purple-700 bg-purple-100'},
  installed:        { label: 'Installed',          color: 'text-indigo-700 bg-indigo-100'},
  active:           { label: 'Active / Live',      color: 'text-green-700  bg-green-100' },
  under_maintenance:{ label: 'Under Maintenance',  color: 'text-orange-700 bg-orange-100'},
  return_initiated: { label: 'Return Initiated',   color: 'text-rose-700   bg-rose-100'  },
  return_transit:   { label: 'Return in Transit',  color: 'text-pink-700   bg-pink-100'  },
  returned:         { label: 'Returned',           color: 'text-slate-700  bg-slate-100' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: 'text-gray-600 bg-gray-100' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>
      {s.label}
    </span>
  )
}

export default function ScheduleDeleteModal({ entity, entityType, onConfirm, onClose }) {
  const [reason,       setReason]       = useState('')
  const [submitting,   setSubmitting]   = useState('')  // '' | 'loading' | 'done' | 'error'
  const [errorMsg,     setErrorMsg]     = useState('')
  const [showComps,    setShowComps]    = useState(false)
  const [successData,  setSuccessData]  = useState(null)

  const isSet        = entityType === 'set'
  const isBlocked    = BLOCKED_STATUSES.has(entity.lifecycleStatus)
  const components   = entity.components ?? []
  const client       = entity.client ?? null
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const canSubmit    = reason.trim().length >= 5 && !isBlocked && submitting !== 'loading'

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting('loading')
    setErrorMsg('')
    try {
      const result = await onConfirm(reason.trim())
      setSuccessData(result)
      setSubmitting('done')
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.error ??
        err?.response?.data?.existing
          ? `Already scheduled for deletion.`
          : err.message ?? 'Failed to schedule deletion.'
      )
      setSubmitting('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Schedule Deletion</h2>
              <p className="text-xs text-gray-500">
                {isSet ? 'Set' : 'Device'} · <span className="font-mono font-semibold">{entity.code}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── Success state ── */}
          {submitting === 'done' && successData && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <Clock size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Deletion scheduled</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    <span className="font-mono font-bold">{entity.code}</span> will be permanently deleted on{' '}
                    <span className="font-semibold">
                      {new Date(successData.deletionRequest?.scheduledFor ?? scheduledFor).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>.
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Any manager can cancel it from the Devices page before then.
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">
                Close
              </button>
            </div>
          )}

          {submitting !== 'done' && (
            <>
              {/* ── Blocked warning ── */}
              {isBlocked && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
                  <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Cannot delete while active</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Status is <span className="font-semibold">{entity.lifecycleStatus}</span>.
                      Complete the return lifecycle first.
                    </p>
                  </div>
                </div>
              )}

              {/* ── 24h delay notice ── */}
              {!isBlocked && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">24-hour delay</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      This will execute at{' '}
                      <span className="font-semibold">
                        {scheduledFor.toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      . Any manager can cancel it before then.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Entity summary ── */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  {isSet
                    ? <Layers size={14} className="text-gray-500" />
                    : <Package size={14} className="text-gray-500" />
                  }
                  <span className="text-sm font-bold text-gray-800">{entity.code}</span>
                  <StatusBadge status={entity.lifecycleStatus} />
                </div>

                {entity.type && (
                  <p className="text-xs text-gray-500">{entity.type}{entity.brand ? ` · ${entity.brand}` : ''}</p>
                )}
                {entity.setTypeName && (
                  <p className="text-xs text-gray-500">Set type: {entity.setTypeName}</p>
                )}

                {client && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <User size={12} />
                    <span>Assigned to <span className="font-semibold">{client.name}</span></span>
                  </div>
                )}

                {entity.location && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin size={12} />
                    <span>{entity.location}</span>
                  </div>
                )}

                {/* Components (sets only) */}
                {isSet && components.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowComps(v => !v)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showComps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {components.length} component{components.length !== 1 ? 's' : ''} will be returned to warehouse
                    </button>
                    {showComps && (
                      <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-200">
                        {components.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-gray-700">{c.code}</span>
                            <span className="text-gray-400">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Reason field ── */}
              {!isBlocked && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Reason for deletion <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    autoFocus
                    value={reason}
                    onChange={e => { setReason(e.target.value); setErrorMsg('') }}
                    placeholder="e.g. Device is beyond repair, confirmed write-off by management…"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none
                      focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300
                      placeholder:text-gray-400"
                  />
                  <p className={`text-xs mt-1 ${reason.trim().length < 5 ? 'text-gray-400' : 'text-emerald-600'}`}>
                    {reason.trim().length < 5
                      ? `${5 - reason.trim().length} more character${5 - reason.trim().length !== 1 ? 's' : ''} required`
                      : '✓ Reason recorded'
                    }
                  </p>
                </div>
              )}

              {/* ── Error ── */}
              {submitting === 'error' && errorMsg && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              {/* ── Buttons ── */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={onClose}
                  disabled={submitting === 'loading'}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold
                    rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {!isBlocked && (
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5
                      bg-red-600 hover:bg-red-700 disabled:bg-red-200 disabled:cursor-not-allowed
                      text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {submitting === 'loading' ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Scheduling…
                      </>
                    ) : (
                      <>
                        <Clock size={15} />
                        Schedule Deletion
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}