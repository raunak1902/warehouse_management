/**
 * LifecycleTimeline.jsx
 * ─────────────────────
 * Shared lifecycle history timeline used in both:
 *   - BarcodeResultCard (barcode scan view)
 *   - Requests.jsx (expanded card history)
 *
 * Shows ALL request statuses: approved, rejected, pending, withdrawn
 * Includes proof file thumbnails + lightbox on each row.
 */

import React, { useState, useEffect } from 'react'
import {
  ChevronDown, ChevronUp, XCircle, FileText,
  Paperclip, ImageIcon, Film, Eye, X,
  CheckCircle, Clock, RotateCcw, AlertTriangle,
} from 'lucide-react'
import { STEP_META } from '../api/lifecycleRequestApi'

const API_BASE = '/api'
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

// ── Fetch all history for a device or set ─────────────────────────────────────
// Returns approved + rejected + withdrawn (pending excluded — still in flight)
export async function fetchFullHistory(deviceId, setId) {
  const url = deviceId
    ? `${API_BASE}/lifecycle-requests/device/${deviceId}/history`
    : `${API_BASE}/lifecycle-requests/set/${setId}/history`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load history')
  return res.json()
}

// ── Proof files panel ─────────────────────────────────────────────────────────
export const ProofFilesPanel = ({ proofFiles }) => {
  const [lightboxIdx, setLightboxIdx] = useState(null)

  const isImg = url => /\.(jpg|jpeg|png|gif|webp|avif|heic)($|\?)/i.test(url)
  const isVid = url => /\.(mp4|mov|webm|avi|mkv)($|\?)/i.test(url)
  const isPdf = url => /\.pdf($|\?)/i.test(url)

  if (!proofFiles || proofFiles.length === 0) return null

  const file = lightboxIdx !== null ? proofFiles[lightboxIdx] : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {proofFiles.map((pf, idx) => {
          const thumbUrl = pf.thumbUrl || pf.url
          const fullUrl  = pf.url
          return (
            <button
              key={idx}
              onClick={() => setLightboxIdx(idx)}
              title={pf.fileName || 'View proof'}
              className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100
                hover:border-blue-400 hover:ring-2 hover:ring-blue-100 transition-all group flex-shrink-0"
            >
              {isImg(fullUrl) ? (
                <>
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors
                    flex items-center justify-center">
                    <Eye size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : isVid(fullUrl) ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-purple-50 gap-0.5">
                  <Film size={16} className="text-purple-400" />
                  <span className="text-[8px] text-purple-500 font-semibold">Video</span>
                  <div className="absolute inset-0 group-hover:bg-black/10 transition-colors" />
                </div>
              ) : isPdf(fullUrl) ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 gap-0.5">
                  <FileText size={16} className="text-red-400" />
                  <span className="text-[8px] text-red-500 font-semibold">PDF</span>
                  <div className="absolute inset-0 group-hover:bg-black/10 transition-colors" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={16} className="text-gray-400" />
                </div>
              )}
              {pf.sizeKb && (
                <span className="absolute bottom-0.5 right-0.5 text-[7px] bg-black/50 text-white
                  px-1 py-px rounded font-medium leading-none">
                  {pf.sizeKb >= 1024 ? `${(pf.sizeKb/1024).toFixed(1)}M` : `${pf.sizeKb}K`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && file && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute -top-9 right-0 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="absolute -top-9 left-0 flex items-center gap-2">
              <span className="text-white/60 text-xs">{lightboxIdx + 1} / {proofFiles.length}</span>
              {file.fileName && (
                <span className="text-white/50 text-xs truncate max-w-48">{file.fileName}</span>
              )}
            </div>
            <div className="rounded-2xl overflow-hidden bg-gray-900 flex items-center justify-center min-h-40 max-h-[80vh]">
              {isImg(file.url) ? (
                <img src={file.url} alt="" className="max-h-[80vh] max-w-full object-contain" />
              ) : isVid(file.url) ? (
                <video src={file.url} controls autoPlay className="max-h-[80vh] max-w-full" />
              ) : isPdf(file.url) ? (
                <div className="flex flex-col items-center gap-4 p-10 text-white/60">
                  <FileText size={56} />
                  <p className="text-sm">{file.fileName || 'PDF Document'}</p>
                  <a href={file.url} target="_blank" rel="noreferrer"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors">
                    Open PDF ↗
                  </a>
                </div>
              ) : (
                <div className="p-10 text-white/40 text-sm">Preview unavailable</div>
              )}
            </div>
            {proofFiles.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIdx(i => (i - 1 + proofFiles.length) % proofFiles.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white text-lg"
                >‹</button>
                <button
                  onClick={() => setLightboxIdx(i => (i + 1) % proofFiles.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white text-lg"
                >›</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Proof attachment toggle button ────────────────────────────────────────────
export const ProofAttachmentButton = ({ proofFiles }) => {
  const [open, setOpen] = useState(false)
  if (!proofFiles || proofFiles.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all
          ${open
            ? 'bg-blue-100 border-blue-300 text-blue-700'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600'
          }`}
      >
        <Paperclip size={10} />
        {open ? 'Hide' : 'View'} Attachment{proofFiles.length > 1 ? 's' : ''} ({proofFiles.length})
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="mt-2">
          <ProofFilesPanel proofFiles={proofFiles} />
        </div>
      )}
    </div>
  )
}

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_BADGE = {
  approved:  { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-600 border-red-200'            },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200'       },
  withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-500 border-gray-200'          },
}

const dotIcon = (status, emoji) => {
  if (status === 'rejected')  return '❌'
  if (status === 'withdrawn') return '↩'
  if (status === 'pending')   return '⏳'
  return emoji
}

const dotBg = (status, metaBg) => {
  if (status === 'rejected')  return 'bg-red-100'
  if (status === 'withdrawn') return 'bg-gray-100'
  if (status === 'pending')   return 'bg-amber-100'
  return metaBg
}

// ── Single timeline row ───────────────────────────────────────────────────────
export const TimelineItem = ({ request: req, isLast }) => {
  const meta       = STEP_META[req.toStep] || { label: req.toStep, emoji: '📋', bgClass: 'bg-gray-100', textClass: 'text-gray-700', borderClass: 'border-gray-200' }
  const status     = req.status || 'approved'
  const badge      = STATUS_BADGE[status] || STATUS_BADGE.approved
  const isRejected = status === 'rejected'
  const isWithdrawn= status === 'withdrawn'
  const isPending  = status === 'pending'
  const hasProof   = req.proofFiles && req.proofFiles.length > 0

  const fmt = dt => dt
    ? new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const initials = name => name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="flex gap-3">
      {/* Spine + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center text-sm
          ${dotBg(status, meta.bgClass)}`}>
          {dotIcon(status, meta.emoji)}
        </div>
        {!isLast && <div className="w-px bg-gradient-to-b from-gray-300 to-transparent flex-1 mt-1 min-h-[14px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        {/* Step label + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-bold ${isRejected ? 'text-red-600' : isWithdrawn ? 'text-gray-400' : meta.textClass}`}>
            {meta.label}
          </p>
          <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {/* Requested by */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400 w-16 flex-shrink-0">Requested</span>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <div className="w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[8px] font-bold flex items-center justify-center flex-shrink-0">
              {initials(req.requestedByName)}
            </div>
            <span className="font-semibold text-gray-700">{req.requestedByName || '—'}</span>
            <span className="text-gray-300">·</span>
            <span>{fmt(req.createdAt) || '—'}</span>
          </div>
        </div>

        {/* Approved / Rejected / Withdrawn by */}
        {(req.approvedByName || req.rejectedByName) && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`text-[9px] font-extrabold uppercase tracking-wide w-16 flex-shrink-0
              ${isRejected ? 'text-red-400' : isWithdrawn ? 'text-gray-400' : 'text-emerald-500'}`}>
              {isRejected ? 'Rejected' : isWithdrawn ? 'Withdrew' : 'Approved'}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <div className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center flex-shrink-0
                ${isRejected ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {initials(req.approvedByName || req.rejectedByName)}
              </div>
              <span className="font-semibold text-gray-700">{req.approvedByName || req.rejectedByName}</span>
              {req.approvedAt && (
                <><span className="text-gray-300">·</span><span>{fmt(req.approvedAt)}</span></>
              )}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {isRejected && req.rejectionNote && (
          <div className="mt-1.5 flex gap-1.5 p-2 bg-red-50 border border-red-200 rounded-lg">
            <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-700 italic">{req.rejectionNote}</p>
          </div>
        )}

        {/* Health note */}
        {req.healthNote && (
          <div className="mt-1.5 flex gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800">{req.healthNote}</p>
          </div>
        )}

        {/* Step note */}
        {req.note && !req.note.startsWith('{') && (
          <p className="mt-1.5 text-[10px] text-gray-500 italic bg-gray-50 border-l-2 border-gray-300 pl-2 py-0.5 rounded-r">
            {req.note}
          </p>
        )}

        {/* Proof attachments */}
        {hasProof && <ProofAttachmentButton proofFiles={req.proofFiles} />}
      </div>
    </div>
  )
}

// ── Full timeline panel — fetches its own data ────────────────────────────────
// Usage: <LifecycleTimeline deviceId={123} /> or <LifecycleTimeline setId={5} />
const LifecycleTimeline = ({ deviceId, setId, initialHistory }) => {
  const [history, setHistory] = useState(initialHistory || null)
  const [loading, setLoading] = useState(!initialHistory)
  const [error,   setError]   = useState(null)
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    if (!open || history !== null) return
    setLoading(true)
    fetchFullHistory(deviceId, setId)
      .then(data => setHistory(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, deviceId, setId, history])

  const count = history?.length ?? 0

  return (
    <div className="border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary-700
          bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {open ? 'Hide' : 'Show'} History
        {count > 0 && (
          <span className="ml-auto bg-primary-200 text-primary-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {count} events
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-800">Request History</p>
            <span className="ml-auto text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Latest first
            </span>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Loading history…
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 text-center py-4">{error}</p>
          )}

          {!loading && !error && history?.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No history yet</p>
          )}

          {!loading && !error && history && history.length > 0 && (
            <div>
              {history.map((req, idx) => (
                <TimelineItem
                  key={req.id}
                  request={req}
                  isLast={idx === history.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LifecycleTimeline