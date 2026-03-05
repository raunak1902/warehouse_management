/**
 * src/components/DeviceTimeline.jsx
 * ───────────────────────────────────
 * Expandable lifecycle timeline panel for a device or set.
 * Shows every approved lifecycle step with health, submitter, approver, timestamps,
 * and proof media thumbnails (images, videos, PDFs).
 *
 * Props:
 *   deviceId   — number | null
 *   setId      — number | null
 *   deviceCode — string (for display)
 *   onClose    — callback to collapse
 */

import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, Clock, User, Shield, AlertTriangle,
  Wrench, Truck, Package, Zap, RotateCcw, ChevronRight,
  Loader2, RefreshCw, Heart, ImageIcon, Film, FileText,
  Paperclip, Eye, X, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { lifecycleRequestApi, STEP_META } from '../api/lifecycleRequestApi'

// ── Health badge styles ───────────────────────────────────────────────────────
const HEALTH_STYLE = {
  ok:      { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: '✓ OK' },
  repair:  { cls: 'bg-amber-100  text-amber-700  border-amber-200',     label: '🔧 Repair' },
  damaged: { cls: 'bg-red-100    text-red-700    border-red-200',       label: '⚠ Damaged' },
  lost:    { cls: 'bg-red-200    text-red-900    border-red-300',       label: '❌ Lost' },
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
  returned:          Package,
  lost:              AlertTriangle,
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
  returned:          'bg-slate-500',
  lost:              'bg-red-600',
}

const fmt = (dt) =>
  dt
    ? new Date(dt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

// ── Helpers ──────────────────────────────────────────────────────────────────
const isImageUrl = (url = '') =>
  /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url)

const isVideoUrl = (url = '') =>
  /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url)

const isPdfUrl = (url = '') =>
  /\.pdf(\?|$)/i.test(url)

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ files, startIdx, onClose }) {
  const [current, setCurrent] = useState(startIdx)
  const file = files[current]
  const total = files.length

  const prev = () => setCurrent(i => (i - 1 + total) % total)
  const next = () => setCurrent(i => (i + 1) % total)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Counter */}
        <div className="absolute -top-10 left-0 text-white/60 text-xs">
          {current + 1} / {total}
        </div>

        {/* Content */}
        <div className="rounded-2xl overflow-hidden bg-gray-900 flex items-center justify-center min-h-48 max-h-[80vh]">
          {isImageUrl(file) ? (
            <img src={file} alt="" className="max-h-[80vh] max-w-full object-contain" />
          ) : isVideoUrl(file) ? (
            <video src={file} controls className="max-h-[80vh] max-w-full" autoPlay />
          ) : isPdfUrl(file) ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-white/60">
              <FileText className="w-16 h-16" />
              <p className="text-sm">PDF document</p>
              <a
                href={file}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
              >
                Open PDF ↗
              </a>
            </div>
          ) : (
            <div className="p-10 text-white/40 text-sm">Preview unavailable</div>
          )}
        </div>

        {/* Prev / Next */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80
                rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80
                rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Proof thumbnails strip ────────────────────────────────────────────────────
// thumbUrls → small compressed images shown in the grid (fast to load)
// proofUrls → full-res originals opened in the lightbox
function ProofStrip({ proofUrls, thumbUrls }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)

  if (!proofUrls || proofUrls.length === 0) return null

  // Fall back to proofUrls if thumbUrls not provided (older records)
  const thumbs = (thumbUrls && thumbUrls.length === proofUrls.length) ? thumbUrls : proofUrls

  return (
    <>
      <div className="mt-2.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <Paperclip className="w-2.5 h-2.5" /> Proof Attachments
        </p>
        <div className="flex flex-wrap gap-2">
          {proofUrls.map((fullUrl, idx) => {
            const thumbUrl = thumbs[idx]
            return (
            <button
              key={idx}
              onClick={() => setLightboxIdx(idx)}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100
                hover:ring-2 hover:ring-blue-400 transition-all group flex-shrink-0"
              title="View proof"
            >
              {isImageUrl(fullUrl) ? (
                <>
                  {/* Use thumb for grid — tiny file, loads instantly */}
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : isVideoUrl(fullUrl) ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-purple-50 gap-1">
                  <Film className="w-5 h-5 text-purple-400" />
                  <span className="text-[8px] text-purple-500 font-medium">Video</span>
                  <div className="absolute inset-0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <Eye className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ) : isPdfUrl(fullUrl) ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 gap-1">
                  <FileText className="w-5 h-5 text-red-400" />
                  <span className="text-[8px] text-red-500 font-medium">PDF</span>
                  <div className="absolute inset-0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <Eye className="w-4 h-4 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </button>
            )
          })}
        </div>
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          files={proofUrls}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DeviceTimeline({ deviceId, setId, deviceCode, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = deviceId
        ? await lifecycleRequestApi.getDeviceHistory(deviceId)
        : await lifecycleRequestApi.getSetHistory(setId)
      setHistory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [deviceId, setId])

  if (loading) {
    return (
      <TimelineShell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-500">Loading history…</span>
        </div>
      </TimelineShell>
    )
  }

  if (error) {
    return (
      <TimelineShell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={load} className="ml-auto underline text-xs">Retry</button>
        </div>
      </TimelineShell>
    )
  }

  if (history.length === 0) {
    return (
      <TimelineShell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
        <div className="flex flex-col items-center py-10 text-center">
          <Clock className="w-10 h-10 text-gray-200 mb-2" />
          <p className="text-gray-500 text-sm font-medium">No lifecycle history yet</p>
          <p className="text-gray-400 text-xs mt-1">Steps will appear here as the device moves through its lifecycle.</p>
        </div>
      </TimelineShell>
    )
  }

  return (
    <TimelineShell deviceCode={deviceCode} onClose={onClose} onRefresh={load}>
      <div className="relative">
        <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gray-200" />

        <div className="space-y-0">
          {history.map((item, idx) => {
            const meta     = STEP_META[item.toStep] ?? { label: item.toStep, emoji: '📋' }
            const dotColor = STEP_DOT_COLOR[item.toStep] ?? 'bg-gray-400'
            const Icon     = STEP_ICONS[item.toStep] ?? ChevronRight
            const hs       = HEALTH_STYLE[item.healthStatus] ?? HEALTH_STYLE.ok
            const isLast   = idx === history.length - 1

            // proofUrls = full-res, thumbUrls = compressed 300x300 (for grid)
            const proofUrls  = Array.isArray(item.proofUrls)  ? item.proofUrls  : []
            const thumbUrls  = Array.isArray(item.thumbUrls)  ? item.thumbUrls  : []
            const proofCount = proofUrls.length

            return (
              <div key={item.id} className="relative flex gap-4 pb-5">
                {/* Dot */}
                <div className="relative flex-shrink-0 z-10">
                  <div className={`w-10 h-10 rounded-full ${dotColor} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Content card */}
                <div className={`flex-1 min-w-0 bg-white rounded-xl border shadow-sm p-3.5
                  ${isLast ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'}`}>

                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {meta.emoji} {meta.label}
                      </span>
                      {isLast && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full">
                          Current
                        </span>
                      )}
                      {item.autoApproved && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full">
                          Auto-approved
                        </span>
                      )}
                      {/* Proof count badge */}
                      {proofCount > 0 && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">
                          <Paperclip className="w-2.5 h-2.5" />
                          {proofCount} proof
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {fmt(item.approvedAt || item.createdAt)}
                    </span>
                  </div>

                  {/* People */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <User className="w-3 h-3" />
                      Submitted by <span className="font-medium text-gray-700 ml-0.5">{item.requestedByName}</span>
                    </span>
                    {item.approvedByName && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Shield className="w-3 h-3" />
                        Approved by <span className="font-medium text-gray-700 ml-0.5">{item.approvedByName}</span>
                      </span>
                    )}
                  </div>

                  {/* Health badge */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Heart className="w-3 h-3" /> Health:
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${hs.cls}`}>
                      {hs.label}
                    </span>
                  </div>

                  {/* Health note */}
                  {item.healthNote && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">⚠ Health Note</p>
                      <p className="text-xs text-amber-800">{item.healthNote}</p>
                    </div>
                  )}

                  {/* General note */}
                  {item.note && (
                    <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-600">{item.note}</p>
                    </div>
                  )}

                  {/* ── Proof thumbnails ── */}
                  <ProofStrip proofUrls={proofUrls} thumbUrls={thumbUrls} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </TimelineShell>
  )
}

// ── Shell wrapper ──────────────────────────────────────────────────────────────
function TimelineShell({ deviceCode, onClose, onRefresh, children }) {
  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Lifecycle History</h3>
          <p className="text-xs text-gray-400 mt-0.5">{deviceCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}