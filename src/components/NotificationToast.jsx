/**
 * src/components/NotificationToast.jsx
 * ──────────────────────────────────────
 * Slide-in toast cards shown to managers/admins when a ground-team request
 * arrives via SSE. Stacks vertically from top-right.
 *
 * Handles two distinct request types:
 *
 *  1. LIFECYCLE requests  (toast.type is undefined / not 'inventory_request')
 *     Payload:  { id, toStep, deviceCode, setCode, deviceType,
 *                 requestedByName, note, createdAt, proofCount }
 *     Actions:  Approve inline · Reject inline · "View →" deep-links to
 *               /requests?tab=<step-tab>&highlight=<id>
 *
 *  2. INVENTORY requests  (toast.type === 'inventory_request')
 *     Payload:  { type, requestId, requestType, label,
 *                 requestedByName, note, createdAt }
 *     Actions:  "View Request →" only — deep-links to
 *               /requests?tab=inventory&highlight=<requestId>
 *
 * BUG FIXED: previously called lifecycleRequestApi.approve(toast.id) even for
 * inventory toasts where toast.id is undefined → Prisma crash.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, CheckCircle, XCircle, ExternalLink, Clock,
  User, Package, Undo2, PlusSquare, Layers,
} from 'lucide-react'
import { STEP_META } from '../api/lifecycleRequestApi'
import { lifecycleRequestApi } from '../api/lifecycleRequestApi'

const AUTO_DISMISS_MS        = 5 * 60 * 1000
const BULK_APPROVE_STAGGER_MS = 500
const UNDO_WINDOW_MS          = 2000

const triggerHaptic = () => { if (navigator.vibrate) navigator.vibrate(50) }

// ── Step colour map ────────────────────────────────────────────────────────────
const STEP_COLORS = {
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300'   },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300'  },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300'  },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-300'   },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300'   },
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300'  },
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300'    },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-300'   },
}

// ── Map inventory requestType → display meta ───────────────────────────────────
const INVENTORY_META = {
  add_device: { emoji: '📦', label: 'Add Device',  color: 'green'  },
  bulk_add:   { emoji: '📦', label: 'Bulk Add',    color: 'teal'   },
  make_set:   { emoji: '🗂️', label: 'Make Set',    color: 'indigo' },
  break_set:  { emoji: '🔧', label: 'Break Set',   color: 'amber'  },
}

// ── Which lifecycle tab does a toStep belong to? ────────────────────────────────
function tabForStep(toStep) {
  const deploySteps    = new Set(['deploying', 'assigning', 'active'])
  const returnSteps    = new Set(['return_initiated', 'returned'])
  const healthSteps    = new Set(['health_update', 'under_maintenance'])
  if (deploySteps.has(toStep))  return 'deployments'
  if (returnSteps.has(toStep))  return 'returns'
  if (healthSteps.has(toStep))  return 'health'
  return 'all'
}

// ── Relative time ──────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (s < 5)    return 'just now'
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE TOAST CARD
// ─────────────────────────────────────────────────────────────────────────────
function ToastCard({ toast, onDismiss, isBeingBulkApproved, onBulkApproveComplete }) {
  const navigate = useNavigate()

  const [progress,     setProgress]     = useState(100)
  const [phase,        setPhase]        = useState('enter')
  const [rejectMode,   setRejectMode]   = useState(false)
  const [rejectNote,   setRejectNote]   = useState('')
  const [actionState,  setActionState]  = useState('idle')
  const [errorMsg,     setErrorMsg]     = useState('')
  const intervalRef  = useRef(null)
  const pausedRef    = useRef(false)
  const remainingRef = useRef(AUTO_DISMISS_MS)
  const lastTickRef  = useRef(Date.now())

  // ── Classify the toast type ────────────────────────────────────────────────
  const isInventory   = toast.type === 'inventory_request'
  const isSubReminder = toast._type === 'subscription_reminder'
  const isLifecycle   = !isInventory && !isSubReminder

  // ── Resolve display meta ───────────────────────────────────────────────────
  const meta = (() => {
    if (isSubReminder) return {
      emoji: toast.reminderType === 'expired' ? '🚨' : toast.reminderType === '2day' ? '🔴' : '⚠️',
      label: toast.reminderType === 'expired' ? 'Subscription Expired'
           : toast.reminderType === '2day'    ? 'Expiring in 2 Days'
           :                                    'Expiring in 7 Days',
      color: toast.reminderType === 'expired' ? 'red' : toast.reminderType === '2day' ? 'orange' : 'amber',
    }
    if (isInventory) return INVENTORY_META[toast.requestType] ?? { emoji: '📋', label: toast.label ?? 'Inventory Request', color: 'slate' }
    return STEP_META[toast.toStep] ?? { emoji: '📋', label: toast.stepLabel ?? toast.toStep ?? 'Request', color: 'slate' }
  })()
  const colors = STEP_COLORS[meta.color] ?? STEP_COLORS.slate

  // ── Deep-link destination ─────────────────────────────────────────────────
  const deepLink = (() => {
    if (isInventory)   return `/requests?tab=inventory&highlight=${toast.requestId}`
    if (isSubReminder) return `/dashboard/return`
    const tab = tabForStep(toast.toStep)
    return `/requests?tab=${tab}&highlight=${toast.id}`
  })()

  // ── What to show in the subtitle line ─────────────────────────────────────
  const subjectLine = (() => {
    if (isInventory) return toast.label ?? toast.requestType ?? 'Inventory request'
    return toast.setCode ?? toast.deviceCode ?? (toast.id ? `#${toast.id}` : 'New request')
  })()

  // ── Countdown bar ──────────────────────────────────────────────────────────
  useEffect(() => {
    setPhase('enter')
    const enterTimer = setTimeout(() => setPhase('idle'), 350)
    intervalRef.current = setInterval(() => {
      if (pausedRef.current) { lastTickRef.current = Date.now(); return }
      const elapsed = Date.now() - lastTickRef.current
      lastTickRef.current = Date.now()
      remainingRef.current = Math.max(0, remainingRef.current - elapsed)
      setProgress((remainingRef.current / AUTO_DISMISS_MS) * 100)
      if (remainingRef.current <= 0) {
        clearInterval(intervalRef.current)
        setPhase('exit')
        setTimeout(() => onDismiss(toast._toastId), 300)
      }
    }, 50)
    return () => { clearTimeout(enterTimer); clearInterval(intervalRef.current) }
  }, []) // eslint-disable-line

  const pauseTimer  = () => { pausedRef.current = true }
  const resumeTimer = () => { pausedRef.current = false; lastTickRef.current = Date.now() }

  const handleDismiss = () => {
    clearInterval(intervalRef.current)
    setPhase('exit')
    setTimeout(() => onDismiss(toast._toastId), 300)
  }

  const handleNavigate = (e) => {
    e?.stopPropagation()
    clearInterval(intervalRef.current)
    navigate(deepLink)
    setTimeout(() => onDismiss(toast._toastId), 100)
  }

  // ── Lifecycle: approve ─────────────────────────────────────────────────────
  const handleApprove = async (e) => {
    e?.stopPropagation()
    pauseTimer()
    setActionState('loading')
    try {
      await lifecycleRequestApi.approve(toast.id)
      triggerHaptic()
      setActionState('approved')
      setTimeout(handleDismiss, 1500)
    } catch (err) {
      setActionState('error')
      setErrorMsg(err.message ?? 'Approval failed')
      resumeTimer()
    }
  }

  // ── Bulk approve trigger from parent ──────────────────────────────────────
  useEffect(() => {
    if (isBeingBulkApproved && actionState === 'idle' && isLifecycle) {
      ;(async () => {
        pauseTimer()
        setActionState('loading')
        try {
          await lifecycleRequestApi.approve(toast.id)
          triggerHaptic()
          setActionState('approved')
          setTimeout(() => {
            handleDismiss()
            onBulkApproveComplete?.(toast._toastId, true)
          }, 800)
        } catch (err) {
          setActionState('error')
          setErrorMsg(err.message ?? 'Approval failed')
          resumeTimer()
          onBulkApproveComplete?.(toast._toastId, false, err.message)
        }
      })()
    }
  }, [isBeingBulkApproved]) // eslint-disable-line

  // ── Lifecycle: reject ──────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectNote.trim()) return
    pauseTimer()
    setActionState('loading')
    try {
      await lifecycleRequestApi.reject(toast.id, rejectNote.trim())
      setActionState('rejected')
      setTimeout(handleDismiss, 1500)
    } catch (err) {
      setActionState('error')
      setErrorMsg(err.message ?? 'Rejection failed')
      resumeTimer()
    }
  }

  // ── Animation ──────────────────────────────────────────────────────────────
  const slideClass =
    phase === 'enter' ? '-translate-y-full opacity-0 scale-95' :
    phase === 'exit'  ? '-translate-y-full opacity-0 scale-95' :
    'translate-y-0 opacity-100 scale-100'

  return (
    <div
      onClick={handleNavigate}
      className={`w-full max-w-[480px] md:w-[480px] sm:w-[400px]
        bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden cursor-pointer
        transform transition-all duration-300 ease-out ${slideClass}
        hover:shadow-[0_20px_50px_rgba(0,0,0,0.18)] hover:scale-[1.02] hover:border-gray-300`}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      {/* ── Progress bar ── */}
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-none ${
            actionState === 'approved' ? 'bg-emerald-500' :
            actionState === 'rejected' ? 'bg-red-500' :
            isInventory ? 'bg-indigo-400' : 'bg-indigo-500'
          }`}
          style={{
            width: `${actionState !== 'idle' ? 100 : progress}%`,
            transition: pausedRef.current ? 'none' : 'width 0.05s linear',
          }}
        />
      </div>

      {/* ── Header ── */}
      <div className={`flex items-start gap-3 px-4 pt-3.5 pb-3 ${colors.bg}`}>
        <span className="text-xl mt-0.5 flex-shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">

          {/* Row 1: type badge + dismiss */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
              {meta.label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDismiss() }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Row 2: subject — what is being requested */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {isInventory
              ? <PlusSquare size={13} className={`flex-shrink-0 ${colors.text}`} />
              : toast.setCode
                ? <Layers size={13} className="text-gray-500 flex-shrink-0" />
                : <Package size={13} className="text-gray-500 flex-shrink-0" />
            }
            <span className="text-sm font-bold text-gray-800 truncate">{subjectLine}</span>
            {!isInventory && toast.deviceType && (
              <span className="text-xs text-gray-500 truncate">· {toast.deviceType}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-3 space-y-2">

        {/* Subscription reminder details */}
        {isSubReminder && (
          <div className="text-sm text-gray-500 space-y-1">
            <div className="flex items-center gap-1.5">
              <Package size={13} />
              <span className="font-medium text-gray-700">{toast.deviceCode ?? toast.setCode}</span>
              {toast.clientName && <span className="text-gray-400">· {toast.clientName}</span>}
            </div>
            {toast.subscriptionEndDate && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock size={13} />
                <span>Sub ends {new Date(toast.subscriptionEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        )}

        {/* Who requested + when */}
        {!isSubReminder && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User size={11} className="text-gray-500" />
              </div>
              <span className="text-xs font-semibold text-gray-700">
                {toast.requestedByName ?? 'Ground Team'}
              </span>
              <span className="text-xs text-gray-400">· Ground Team</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Clock size={11} />
              <span className="text-xs">{timeAgo(toast.createdAt)}</span>
            </div>
          </div>
        )}

        {/* Note — parse JSON for assigning requests, plain text for others */}
        {toast.note && (() => {
          // Assigning requests embed a JSON blob with client details
          if (toast.toStep === 'assigning') {
            try {
              const p = JSON.parse(toast.note)
              const location = [p.site, p.district, p.state].filter(Boolean).join(', ')
              const sub = p.subscriptionEnd
                ? new Date(p.subscriptionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : null
              const duration = p.returnDays
                ? `${p.returnDays}d`
                : p.returnMonths
                  ? `${p.returnMonths}mo`
                  : p.returnDate
                    ? new Date(p.returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : null
              return (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                  {p.clientName && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-blue-400">Client</span>
                      <span className="text-xs font-semibold text-blue-800">{p.clientName}</span>
                    </div>
                  )}
                  {location && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-blue-400">📍</span>
                      <span className="text-xs text-blue-700">{location}</span>
                    </div>
                  )}
                  {(duration || sub) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {duration && (
                        <span className="text-xs text-blue-400">
                          ⏱ <span className="text-blue-700 font-medium">{duration}</span>
                        </span>
                      )}
                      {sub && (
                        <span className="text-xs text-blue-400">
                          📅 Sub ends <span className="text-blue-700 font-medium">{sub}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            } catch (_) {
              // Fall through to plain text if JSON.parse fails
            }
          }
          // Plain text note for all other steps
          return (
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 line-clamp-2 italic">
              "{toast.note}"
            </p>
          )
        })()}

        {/* Proof attachments */}
        {toast.proofCount > 0 && (
          <p className="text-xs text-gray-400">
            📎 {toast.proofCount} proof file{toast.proofCount > 1 ? 's' : ''} attached
          </p>
        )}

        {/* Action feedback */}
        {actionState === 'approved' && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2.5">
            <CheckCircle size={16} />
            <span className="text-sm font-semibold">Approved successfully</span>
          </div>
        )}
        {actionState === 'rejected' && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
            <XCircle size={16} />
            <span className="text-sm font-semibold">Rejected</span>
          </div>
        )}
        {actionState === 'error' && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        {/* Reject textarea */}
        {rejectMode && actionState === 'idle' && (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              autoFocus
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Reason for rejection…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReject() } }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!rejectNote.trim()}
                className="flex-1 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => { setRejectMode(false); setRejectNote('') }}
                className="px-4 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}

      {/* INVENTORY: redirect only */}
      {isInventory && actionState === 'idle' && (
        <div className="px-4 pb-3.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleNavigate}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold
              bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200
              py-2.5 rounded-lg transition-colors"
          >
            <ExternalLink size={15} />
            View Request
          </button>
        </div>
      )}

      {/* LIFECYCLE: approve + reject + view */}
      {isLifecycle && actionState === 'idle' && !rejectMode && (
        <div className="px-4 pb-3.5 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleApprove}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold
              bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg transition-colors"
          >
            <CheckCircle size={15} />
            Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setRejectMode(true) }}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold
              bg-red-100 hover:bg-red-200 text-red-700 py-2.5 rounded-lg transition-colors"
          >
            <XCircle size={15} />
            Reject
          </button>
          <button
            onClick={handleNavigate}
            className="flex items-center justify-center gap-1 text-sm font-semibold
              bg-gray-100 hover:bg-gray-200 text-gray-600 px-3.5 py-2.5 rounded-lg transition-colors"
            title="View request"
          >
            <ExternalLink size={15} />
          </button>
        </div>
      )}

      {/* SUB REMINDER: view returns */}
      {isSubReminder && actionState === 'idle' && (
        <div className="px-4 pb-3.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleNavigate}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold
              bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200
              py-2.5 rounded-lg transition-colors"
          >
            <ExternalLink size={15} />
            View Returns Page
          </button>
        </div>
      )}

      {actionState === 'loading' && (
        <div className="px-4 pb-3.5" onClick={(e) => e.stopPropagation()}>
          <div className="w-full bg-gray-100 rounded-lg py-2.5 flex items-center justify-center gap-2.5 text-sm text-gray-500">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Processing…
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bulk Approve All Button (lifecycle-only toasts) ──────────────────────────
function BulkApproveButton({ approvableToasts, onBulkApprove }) {
  const [state, setState]               = useState('idle')
  const [progress, setProgress]         = useState({ current: 0, total: 0 })
  const [undoCountdown, setUndoCountdown] = useState(2)
  const [phase, setPhase]               = useState('enter')
  const undoTimerRef  = useRef(null)
  const cancelledRef  = useRef(false)
  const count = approvableToasts.length

  useEffect(() => {
    setPhase('enter')
    const t = setTimeout(() => setPhase('visible'), 200)
    return () => clearTimeout(t)
  }, [])

  const handleApproveAll = () => {
    setState('undo')
    setUndoCountdown(2)
    cancelledRef.current = false
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 0.1) {
          clearInterval(undoTimerRef.current)
          if (!cancelledRef.current) {
            setState('approving')
            setProgress({ current: 0, total: count })
            onBulkApprove()
          }
          return 0
        }
        return prev - 0.1
      })
    }, 100)
  }

  const handleUndo = () => {
    cancelledRef.current = true
    clearInterval(undoTimerRef.current)
    setState('idle')
    setUndoCountdown(2)
  }

  const slideClass =
    phase === 'enter' ? '-translate-y-full opacity-0' :
    phase === 'exit'  ? '-translate-y-full opacity-0' :
    'translate-y-0 opacity-100'

  if (count < 2) return null

  return (
    <div className={`transform transition-all duration-300 ease-out ${slideClass} pointer-events-auto`}>
      {state === 'idle' && (
        <button
          onClick={handleApproveAll}
          className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500
            hover:from-indigo-700 hover:to-indigo-600 text-white rounded-full shadow-lg
            hover:shadow-xl transition-all duration-200 font-semibold text-sm active:scale-95 hover:scale-105"
        >
          <CheckCircle size={18} />
          <span>Approve All ({count})</span>
        </button>
      )}
      {state === 'undo' && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500
            hover:from-amber-600 hover:to-orange-600 text-white rounded-full shadow-lg
            hover:shadow-xl transition-all duration-200 font-semibold text-sm active:scale-95"
        >
          <Undo2 size={18} />
          <span>Undo ({Math.ceil(undoCountdown)}s)</span>
        </button>
      )}
      {state === 'approving' && (
        <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500
          text-white rounded-full shadow-lg font-semibold text-sm">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span>Approving… ({progress.current}/{progress.total})</span>
        </div>
      )}
      {state === 'success' && (
        <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500
          text-white rounded-full shadow-lg font-semibold text-sm">
          <CheckCircle size={18} />
          <span>All Approved!</span>
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-red-600 to-red-500
          text-white rounded-full shadow-lg font-semibold text-sm">
          <XCircle size={18} />
          <span>Some failed — check below</span>
        </div>
      )}
    </div>
  )
}

// ── Toast container ───────────────────────────────────────────────────────────
export default function NotificationToast({ toasts, onDismiss }) {
  const [approvingToastIds, setApprovingToastIds] = useState(new Set())
  const [bulkProgress, setBulkProgress]           = useState({ current: 0, total: 0, failed: 0 })

  // Only lifecycle toasts can be bulk-approved (inventory ones redirect)
  const approvableToasts = toasts.filter(
    t => t._type !== 'subscription_reminder' && t.type !== 'inventory_request'
  )

  const handleBulkApprove = async () => {
    if (approvableToasts.length === 0) return
    const total = approvableToasts.length
    let current = 0

    for (const toast of approvableToasts) {
      setApprovingToastIds(prev => new Set([...prev, toast._toastId]))
      if (current > 0) await new Promise(r => setTimeout(r, BULK_APPROVE_STAGGER_MS))
      current++
      setBulkProgress({ current, total, failed: 0 })
    }

    setTimeout(() => {
      setApprovingToastIds(new Set())
      setBulkProgress({ current: 0, total: 0, failed: 0 })
    }, 1500)
  }

  const handleBulkApproveComplete = (toastId, success) => {
    setApprovingToastIds(prev => { const s = new Set(prev); s.delete(toastId); return s })
    if (!success) setBulkProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
  }

  if (!toasts?.length) return null

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none
      max-md:top-4 max-md:right-4 max-md:left-4">

      {approvableToasts.length >= 2 && (
        <div className="w-full flex justify-end max-md:justify-center mb-1">
          <BulkApproveButton
            approvableToasts={approvableToasts}
            onBulkApprove={handleBulkApprove}
          />
        </div>
      )}

      {toasts.map(toast => (
        <div key={toast._toastId} className="pointer-events-auto w-full flex justify-end max-md:justify-center">
          <ToastCard
            toast={toast}
            onDismiss={onDismiss}
            isBeingBulkApproved={approvingToastIds.has(toast._toastId)}
            onBulkApproveComplete={handleBulkApproveComplete}
          />
        </div>
      ))}
    </div>
  )
}