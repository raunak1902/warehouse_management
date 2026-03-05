/**
 * src/components/NotificationToast.jsx
 * ──────────────────────────────────────
 * Slide-in toast cards shown to managers/admins when a ground-team request
 * arrives via SSE. Stacks up to 3 toasts bottom-right.
 *
 * Each toast has:
 *  • Request type badge + device/set info
 *  • Who submitted + timestamp
 *  • Inline Approve / Reject buttons (reject opens a note input)
 *  • View button → navigates to /dashboard/requests
 *  • Auto-dismiss countdown bar (8 s)
 *  • Manual ✕ dismiss
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CheckCircle, XCircle, ExternalLink, Clock, User, Package } from 'lucide-react'
import { STEP_META } from '../api/lifecycleRequestApi'
import { lifecycleRequestApi } from '../api/lifecycleRequestApi'

const AUTO_DISMISS_MS = 5 * 60 * 1000 // 5 minutes — effectively "stays until addressed"

// Step colour → Tailwind classes
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

// Single toast card
function ToastCard({ toast, onDismiss }) {
  const navigate = useNavigate()
  const [progress, setProgress]       = useState(100)
  const [phase, setPhase]             = useState('enter')   // enter | idle | exit
  const [rejectMode, setRejectMode]   = useState(false)
  const [rejectNote, setRejectNote]   = useState('')
  const [actionState, setActionState] = useState('idle')    // idle | loading | approved | rejected | error
  const [errorMsg, setErrorMsg]       = useState('')
  const intervalRef                   = useRef(null)
  const pausedRef                     = useRef(false)
  const remainingRef                  = useRef(AUTO_DISMISS_MS)
  const lastTickRef                   = useRef(Date.now())

  const meta   = STEP_META[toast.toStep] ?? { label: toast.stepLabel ?? toast.toStep, emoji: '📋', color: 'slate' }
  const colors = STEP_COLORS[meta.color] ?? STEP_COLORS.slate

  // ── Countdown bar ──────────────────────────────────────────────────────────
  useEffect(() => {
    setPhase('enter')
    const enterTimer = setTimeout(() => setPhase('idle'), 350)

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) {
        lastTickRef.current = Date.now()
        return
      }
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

    return () => {
      clearTimeout(enterTimer)
      clearInterval(intervalRef.current)
    }
  }, []) // eslint-disable-line

  const pauseTimer  = () => { pausedRef.current = true }
  const resumeTimer = () => { pausedRef.current = false; lastTickRef.current = Date.now() }

  const handleDismiss = () => {
    clearInterval(intervalRef.current)
    setPhase('exit')
    setTimeout(() => onDismiss(toast._toastId), 300)
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    pauseTimer()
    setActionState('loading')
    try {
      await lifecycleRequestApi.approve(toast.id)
      setActionState('approved')
      setTimeout(handleDismiss, 1500)
    } catch (err) {
      setActionState('error')
      setErrorMsg(err.message ?? 'Approval failed')
      resumeTimer()
    }
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
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

  const targetCode = toast.setCode ?? toast.deviceCode ?? `#${toast.id}`
  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (s < 60)   return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  // ── Animation classes ──────────────────────────────────────────────────────
  const slideClass =
    phase === 'enter' ? 'translate-x-full opacity-0' :
    phase === 'exit'  ? 'translate-x-full opacity-0' :
    'translate-x-0 opacity-100'

  return (
    <div
      className={`w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden
        transform transition-all duration-300 ease-out ${slideClass}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      {/* ── Progress bar ── */}
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-none ${
            actionState === 'approved' ? 'bg-emerald-500' :
            actionState === 'rejected' ? 'bg-red-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${actionState !== 'idle' ? 100 : progress}%`,
                   transition: pausedRef.current ? 'none' : 'width 0.05s linear' }}
        />
      </div>

      {/* ── Header ── */}
      <div className={`flex items-start gap-3 px-4 pt-3 pb-2 ${colors.bg}`}>
        <span className="text-xl mt-0.5 flex-shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${colors.text}`}>
              New Request
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Package size={11} className="text-gray-500 flex-shrink-0" />
            <span className="text-xs font-bold text-gray-800 truncate">{targetCode}</span>
            {toast.deviceType && (
              <span className="text-[10px] text-gray-500 truncate">· {toast.deviceType}</span>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-2.5 space-y-2">
        {/* Who + when */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <User size={11} />
            <span className="font-medium text-gray-700">{toast.requestedByName}</span>
            <span className="text-gray-400">· Ground Team</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>{timeAgo(toast.createdAt)}</span>
          </div>
        </div>

        {/* Note */}
        {toast.note && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100 line-clamp-2">
            "{toast.note}"
          </p>
        )}

        {/* Proof count */}
        {toast.proofCount > 0 && (
          <p className="text-[10px] text-gray-400">
            📎 {toast.proofCount} proof file{toast.proofCount > 1 ? 's' : ''} attached
          </p>
        )}

        {/* ── Action feedback ── */}
        {actionState === 'approved' && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle size={15} />
            <span className="text-xs font-semibold">Approved successfully</span>
          </div>
        )}
        {actionState === 'rejected' && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <XCircle size={15} />
            <span className="text-xs font-semibold">Rejected</span>
          </div>
        )}
        {actionState === 'error' && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">{errorMsg}</p>
        )}

        {/* ── Reject note input ── */}
        {rejectMode && actionState === 'idle' && (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Reason for rejection..."
              rows={2}
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none
                focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReject() } }}
            />
            <div className="flex gap-1.5">
              <button onClick={handleReject} disabled={!rejectNote.trim()}
                className="flex-1 text-xs bg-red-500 hover:bg-red-600 disabled:opacity-40
                  text-white font-semibold py-1.5 rounded-lg transition-colors">
                Confirm Reject
              </button>
              <button onClick={() => { setRejectMode(false); setRejectNote('') }}
                className="px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      {actionState === 'idle' && !rejectMode && (
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={handleApprove}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold
              bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg transition-colors"
          >
            <CheckCircle size={13} />
            Approve
          </button>
          <button
            onClick={() => setRejectMode(true)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold
              bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg transition-colors"
          >
            <XCircle size={13} />
            Reject
          </button>
          <button
            onClick={() => { handleDismiss(); navigate('/dashboard/requests') }}
            className="flex items-center justify-center gap-1 text-xs font-semibold
              bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg transition-colors"
            title="View all requests"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      )}

      {actionState === 'loading' && (
        <div className="px-4 pb-3">
          <div className="w-full bg-gray-100 rounded-lg py-2 flex items-center justify-center gap-2 text-xs text-gray-500">
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Processing…
          </div>
        </div>
      )}
    </div>
  )
}

// ── Toast container — renders stack of toasts ──────────────────────────────────
export default function NotificationToast({ toasts, onDismiss }) {
  if (!toasts?.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast._toastId} className="pointer-events-auto">
          <ToastCard toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}