/**
 * src/components/PendingDeletionsPanel.jsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Slide-over drawer for managers showing:
 *   - Scheduled (pending) deletions with live countdown + cancel
 *   - Full deletion history (executed + cancelled) — all records
 *
 * Usage:
 *   <DeletionsDrawerButton onRefreshDevices={refresh} />
 *   ↑ renders the trigger button + the drawer together
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Trash2, Clock, X, ChevronDown, ChevronUp, RefreshCw,
  Package, Layers, User, CheckCircle, XCircle, AlertTriangle, History,
} from 'lucide-react'
import { deletionRequestApi } from '../api/deletionRequestApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

function countdown(scheduledFor) {
  const diff = new Date(scheduledFor) - Date.now()
  if (diff <= 0) return 'Executing soon…'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (h > 0) return `${h}h ${m}m remaining`
  if (m > 0) return `${m}m ${s}s remaining`
  return `${s}s remaining`
}

function EntityIcon({ type }) {
  return type === 'set'
    ? <Layers size={14} className="text-indigo-500 flex-shrink-0" />
    : <Package size={14} className="text-primary-500 flex-shrink-0" />
}

// ── Pending card ──────────────────────────────────────────────────────────────

function PendingCard({ record, onCancel }) {
  const [cancelling, setCancelling] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const handleCancel = async () => {
    if (!confirm(`Cancel deletion of ${record.entityCode}?`)) return
    setCancelling(true)
    try {
      await onCancel(record.id)
    } catch (err) {
      alert(err?.response?.data?.error ?? err.message ?? 'Failed to cancel')
      setCancelling(false)
    }
  }

  const snap       = record.snapshot ?? {}
  const components = record.componentSnapshot ?? []
  const isPast     = new Date(record.scheduledFor) <= new Date()

  return (
    <div className={`border rounded-xl p-4 space-y-3 transition-all ${
      isPast ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50/40'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <EntityIcon type={record.entityType} />
          <span className="font-mono font-bold text-sm text-gray-800 truncate">{record.entityCode}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
            record.entityType === 'set' ? 'bg-indigo-100 text-indigo-700' : 'bg-primary-100 text-primary-700'
          }`}>
            {record.entityType === 'set' ? 'Set' : 'Device'}
          </span>
        </div>
        <button
          onClick={handleCancel}
          disabled={cancelling || isPast}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 bg-white
            hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-lg transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {cancelling ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
          Cancel
        </button>
      </div>

      <div className="space-y-1.5">
        {snap._clientName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <User size={11} className="text-gray-400" />
            Assigned to <span className="font-semibold">{snap._clientName}</span>
          </div>
        )}
        {components.length > 0 && (
          <p className="text-xs text-gray-500">
            {components.length} component{components.length !== 1 ? 's' : ''}: {
              components.slice(0, 3).map(c => c.code).join(', ')
            }{components.length > 3 ? ` +${components.length - 3} more` : ''}
          </p>
        )}
        <div className="text-xs text-gray-600 bg-white/70 rounded-lg px-2.5 py-1.5 border border-gray-200/60">
          <span className="text-gray-400">Reason: </span>{record.reason}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>By <span className="font-semibold">{record.requestedByName}</span></span>
          <div className={`flex items-center gap-1 font-semibold ${isPast ? 'text-orange-600' : 'text-red-600'}`}>
            <Clock size={11} />
            {countdown(record.scheduledFor)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── History card ──────────────────────────────────────────────────────────────

function HistoryCard({ record }) {
  const isExecuted  = record.status === 'executed'
  const snap        = record.snapshot ?? {}
  const components  = record.componentSnapshot ?? []

  return (
    <div className={`border rounded-xl p-3.5 space-y-1.5 ${
      isExecuted ? 'border-gray-200 bg-gray-50' : 'border-emerald-200 bg-emerald-50/30'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isExecuted
            ? <XCircle size={13} className="text-gray-400 flex-shrink-0" />
            : <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
          }
          <EntityIcon type={record.entityType} />
          <span className="font-mono font-semibold text-sm text-gray-700 truncate">{record.entityCode}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
            isExecuted ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isExecuted ? 'Deleted' : 'Cancelled'}
          </span>
        </div>
        {snap._clientName && (
          <span className="text-xs text-gray-400 truncate hidden sm:block">{snap._clientName}</span>
        )}
      </div>

      {components.length > 0 && (
        <p className="text-xs text-gray-400">
          {components.length} component{components.length !== 1 ? 's' : ''}: {
            components.slice(0, 3).map(c => c.code).join(', ')
          }{components.length > 3 ? ` +${components.length - 3} more` : ''}
        </p>
      )}

      <p className="text-xs text-gray-500">
        <span className="text-gray-400">Reason: </span>{record.reason}
      </p>

      {isExecuted && record.executedAt ? (
        <p className="text-xs text-gray-400">
          Deleted {new Date(record.executedAt).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
          {record.requestedByName && <> · by <span className="font-medium">{record.requestedByName}</span></>}
        </p>
      ) : (
        <p className="text-xs text-gray-400">
          Cancelled by <span className="font-medium">{record.cancelledByName}</span>
          {record.cancelledAt && <> · {new Date(record.cancelledAt).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}</>}
        </p>
      )}

      {record.executionNote && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">{record.executionNote}</p>
      )}
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function DeletionsDrawer({ open, onClose, onRefreshDevices }) {
  const [records,     setRecords]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [lastFetch,   setLastFetch]   = useState(null)

  const pending = records.filter(r => r.status === 'pending')
  const history = records
    .filter(r => r.status !== 'pending')
    .sort((a, b) =>
      new Date(b.executedAt ?? b.cancelledAt ?? b.createdAt) -
      new Date(a.executedAt ?? a.cancelledAt ?? a.createdAt)
    )

  const load = useCallback(async () => {
    try {
      const data = await deletionRequestApi.getAll()
      setRecords(data)
      setLastFetch(new Date())
    } catch (err) {
      console.error('[DeletionsDrawer] fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when drawer opens
  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Poll every 2 min while open
  useEffect(() => {
    if (!open) return
    const t = setInterval(load, 2 * 60 * 1000)
    return () => clearInterval(t)
  }, [open, load])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleCancel = async (id) => {
    await deletionRequestApi.cancel(id)
    await load()
    onRefreshDevices?.()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Trash2 size={16} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Scheduled Deletions</h2>
              <p className="text-xs text-gray-500">
                {loading ? 'Loading…' : pending.length > 0
                  ? `${pending.length} pending · auto-executes after 24h`
                  : 'No pending deletions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {pending.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                <AlertTriangle size={10} />
                {pending.length}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <RefreshCw size={22} className="animate-spin" />
              <span className="text-sm">Loading deletion queue…</span>
            </div>
          ) : pending.length > 0 ? (
            pending.map(r => (
              <PendingCard key={r.id} record={r} onCancel={handleCancel} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Trash2 size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No deletions scheduled</p>
              <p className="text-xs text-gray-300 text-center px-6">
                Devices scheduled for deletion will appear here with a live countdown.
              </p>
            </div>
          )}

          {/* Deletion History */}
          {!loading && (
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 group-hover:text-gray-800">
                  <History size={13} />
                  Deletion History
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full tabular-nums">
                    {history.length}
                  </span>
                </div>
                {showHistory
                  ? <ChevronUp size={14} className="text-gray-400" />
                  : <ChevronDown size={14} className="text-gray-400" />
                }
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  {history.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No deletion history yet.</p>
                  ) : (
                    history.map(r => <HistoryCard key={r.id} record={r} />)
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {lastFetch && (
          <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-300 text-right">
              Updated {lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Public export: trigger button + drawer together ───────────────────────────

export default function DeletionsDrawerButton({ onRefreshDevices, pendingCount = 0 }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors font-medium text-sm shadow-sm"
        title="Scheduled Deletions & History"
      >
        <Trash2 className="w-4 h-4 text-gray-500" />
        <span className="hidden sm:inline">Deletions</span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
            {pendingCount}
          </span>
        )}
      </button>

      <DeletionsDrawer
        open={open}
        onClose={() => setOpen(false)}
        onRefreshDevices={onRefreshDevices}
      />
    </>
  )
}