/**
 * src/components/LoginBriefing.jsx
 * ──────────────────────────────────
 * Modal shown once per login session when there are pending requests.
 * Shows a summary grouped by request type, expandable to full scrollable list.
 * Manager can approve/reject inline or navigate to the full requests page.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ChevronDown, ChevronUp, CheckCircle, XCircle,
  Clock, User, Package, ArrowRight, Inbox, AlertCircle,
} from 'lucide-react'
import { STEP_META } from '../api/lifecycleRequestApi'
import { lifecycleRequestApi } from '../api/lifecycleRequestApi'

const NOTIF_BASE = '/api/notifications'
const authJsonHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

// Colour map for step types
const STEP_COLORS = {
  blue:   { bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700 border-blue-200',   bar: 'bg-blue-400',   dot: 'bg-blue-400'   },
  teal:   { bg: 'bg-teal-50',   badge: 'bg-teal-100 text-teal-700 border-teal-200',   bar: 'bg-teal-400',   dot: 'bg-teal-400'   },
  amber:  { bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-400',  dot: 'bg-amber-400'  },
  purple: { bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700 border-purple-200', bar: 'bg-purple-400', dot: 'bg-purple-400' },
  indigo: { bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', bar: 'bg-indigo-400', dot: 'bg-indigo-400' },
  green:  { bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700 border-green-200',  bar: 'bg-green-400',  dot: 'bg-green-400'  },
  orange: { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700 border-orange-200', bar: 'bg-orange-400', dot: 'bg-orange-400' },
  rose:   { bg: 'bg-rose-50',   badge: 'bg-rose-100 text-rose-700 border-rose-200',   bar: 'bg-rose-400',   dot: 'bg-rose-400'   },
  pink:   { bg: 'bg-pink-50',   badge: 'bg-pink-100 text-pink-700 border-pink-200',   bar: 'bg-pink-400',   dot: 'bg-pink-400'   },
  slate:  { bg: 'bg-slate-50',  badge: 'bg-slate-100 text-slate-700 border-slate-200', bar: 'bg-slate-400',  dot: 'bg-slate-400'  },
  red:    { bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700 border-red-200',    bar: 'bg-red-400',    dot: 'bg-red-400'    },
  cyan:   { bg: 'bg-cyan-50',   badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',   bar: 'bg-cyan-400',   dot: 'bg-cyan-400'   },
}

const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Single request row inside the expanded list ───────────────────────────────
function RequestRow({ req, onActioned }) {
  const [state, setState]       = useState('idle')   // idle | loading | approved | rejected | error
  const [rejectMode, setReject] = useState(false)
  const [note, setNote]         = useState('')
  const [errMsg, setErrMsg]     = useState('')

  const meta   = STEP_META[req.toStep] ?? { label: req.toStep, emoji: '📋', color: 'slate' }
  const colors = STEP_COLORS[meta.color] ?? STEP_COLORS.slate
  const code   = req.setCode ?? req.deviceCode ?? `#${req.id}`

  const approve = async () => {
    setState('loading')
    try {
      await lifecycleRequestApi.approve(req.id)
      setState('approved')
      setTimeout(() => onActioned(req.id), 800)
    } catch (e) { setState('error'); setErrMsg(e.message) }
  }

  const reject = async () => {
    if (!note.trim()) return
    setState('loading')
    try {
      await lifecycleRequestApi.reject(req.id, note.trim())
      setState('rejected')
      setTimeout(() => onActioned(req.id), 800)
    } catch (e) { setState('error'); setErrMsg(e.message) }
  }

  return (
    <div className={`rounded-xl border border-gray-100 overflow-hidden transition-all ${
      state === 'approved' ? 'opacity-50' : state === 'rejected' ? 'opacity-50' : ''
    }`}>
      {/* Row header */}
      <div className={`flex items-start gap-3 px-4 py-3 ${colors.bg}`}>
        <span className="text-base mt-0.5 flex-shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${colors.badge}`}>
              {meta.label}
            </span>
            <span className="text-xs font-bold text-gray-800">{code}</span>
            {req.deviceType && <span className="text-xs text-gray-400">· {req.deviceType}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><User size={10} />{req.requestedByName}</span>
            <span className="flex items-center gap-1"><Clock size={10} />{timeAgo(req.createdAt)}</span>
          </div>
          {req.note && (
            <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">"{req.note}"</p>
          )}
        </div>

        {/* Action feedback */}
        {state === 'approved' && (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 flex-shrink-0">
            <CheckCircle size={13} /> Approved
          </span>
        )}
        {state === 'rejected' && (
          <span className="text-xs font-semibold text-red-500 flex items-center gap-1 flex-shrink-0">
            <XCircle size={13} /> Rejected
          </span>
        )}
        {state === 'error' && (
          <span className="text-xs text-red-500 flex-shrink-0">{errMsg}</span>
        )}
      </div>

      {/* Reject input */}
      {rejectMode && state === 'idle' && (
        <div className="px-4 py-2.5 bg-white border-t border-gray-100 flex gap-2 items-start">
          <textarea
            autoFocus rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Reason for rejection…"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none
              focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reject() } }}
          />
          <div className="flex flex-col gap-1.5">
            <button onClick={reject} disabled={!note.trim()}
              className="text-xs bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white
                font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              Confirm
            </button>
            <button onClick={() => { setReject(false); setNote('') }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Approve / Reject buttons */}
      {state === 'idle' && !rejectMode && (
        <div className="flex gap-2 px-4 py-2.5 bg-white border-t border-gray-100">
          <button onClick={approve}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold
              bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded-lg transition-colors">
            <CheckCircle size={12} /> Approve
          </button>
          <button onClick={() => setReject(true)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold
              bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-lg transition-colors border border-red-200">
            <XCircle size={12} /> Reject
          </button>
        </div>
      )}
      {state === 'loading' && (
        <div className="px-4 py-2.5 bg-white border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Processing…
        </div>
      )}
    </div>
  )
}

// ── Summary card for one step type ────────────────────────────────────────────
function StepSummaryCard({ stepKey, count, total, isExpanded, onToggle }) {
  const meta   = STEP_META[stepKey] ?? { label: stepKey, emoji: '📋', color: 'slate' }
  const colors = STEP_COLORS[meta.color] ?? STEP_COLORS.slate
  const pct    = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <button onClick={onToggle}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-left
        ${isExpanded
          ? `${colors.bg} border-current shadow-sm`
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
        }`}>
      <span className="text-xl flex-shrink-0">{meta.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-gray-800 truncate">{meta.label}</span>
          <span className={`text-sm font-bold ml-2 flex-shrink-0 ${colors.badge.split(' ')[1]}`}>
            {count}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${colors.bar} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex-shrink-0 text-gray-400">
        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </div>
    </button>
  )
}

// ── Main LoginBriefing modal ──────────────────────────────────────────────────
export default function LoginBriefing({ userName, onDismiss }) {
  const navigate = useNavigate()
  const [data, setData]             = useState(null)   // { total, byStep, requests }
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [expandedStep, setExpanded] = useState(null)   // which step section is open
  const [requests, setRequests]     = useState([])     // live copy, updated as actions happen
  const [visible, setVisible]       = useState(false)  // animation

  // Fetch briefing data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${NOTIF_BASE}/login-briefing`, { headers: authJsonHeaders() })
        if (!res.ok) throw new Error('Failed to load')
        const json = await res.json()
        if (json.total === 0) { onDismiss(); return }
        setData(json)
        setRequests(json.requests)
        // Open the first (most common) step automatically
        const topStep = Object.entries(json.byStep).sort((a, b) => b[1] - a[1])[0]?.[0]
        setExpanded(topStep ?? null)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
        setTimeout(() => setVisible(true), 50) // trigger entrance animation
      }
    }
    load()
  }, []) // eslint-disable-line

  // Remove actioned request from local list and recompute counts
  const handleActioned = (id) => {
    setRequests(prev => {
      const updated = prev.filter(r => r.id !== id)
      if (updated.length === 0) {
        // All done — close after a brief moment
        setTimeout(onDismiss, 600)
      }
      return updated
    })
  }

  // Recompute byStep from remaining requests
  const liveByStep = requests.reduce((acc, r) => {
    acc[r.toStep] = (acc[r.toStep] ?? 0) + 1
    return acc
  }, {})
  const liveTotal = requests.length

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  const handleReviewAll = () => {
    handleDismiss()
    navigate('/requests?status=pending')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return null  // silent until data arrives

  return (
    <div className={`fixed inset-0 z-[9998] flex items-center justify-center p-4
      transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Modal */}
      <div className={`relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col
        max-h-[90vh] transform transition-all duration-300
        ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">👋</span>
              <h2 className="text-lg font-bold text-gray-900">
                Welcome back{userName ? `, ${userName.split(' ')[0]}` : ''}
              </h2>
            </div>
            {error ? (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <AlertCircle size={14} /> Could not load requests
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                <span className="font-bold text-indigo-600">{liveTotal}</span>
                {' '}pending request{liveTotal !== 1 ? 's' : ''} need{liveTotal === 1 ? 's' : ''} your attention
              </p>
            )}
          </div>
          <button onClick={handleDismiss}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {error && (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              Failed to load pending requests
            </div>
          )}

          {!error && liveTotal === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
              <Inbox size={32} strokeWidth={1.5} />
              <p className="text-sm">All requests have been addressed!</p>
            </div>
          )}

          {!error && Object.entries(liveByStep)
            .sort((a, b) => b[1] - a[1])  // most requests first
            .map(([step, count]) => {
              const stepRequests = requests.filter(r => r.toStep === step)
              const isExpanded   = expandedStep === step

              return (
                <div key={step}>
                  <StepSummaryCard
                    stepKey={step}
                    count={count}
                    total={liveTotal}
                    isExpanded={isExpanded}
                    onToggle={() => setExpanded(isExpanded ? null : step)}
                  />

                  {/* Expandable request list */}
                  {isExpanded && (
                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100 ml-3">
                      {stepRequests.map(req => (
                        <RequestRow key={req.id} req={req} onActioned={handleActioned} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={handleReviewAll}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600
              hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            Review All Requests
            <ArrowRight size={15} />
          </button>
          <button onClick={handleDismiss}
            className="px-5 text-sm font-medium text-gray-500 hover:text-gray-700
              bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}