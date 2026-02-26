import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ClipboardList, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, Search, Filter, X, User, Layers, Monitor,
} from 'lucide-react'
import { normaliseRole, ROLES } from '../../App'
import { useInventory } from '../../context/InventoryContext'
import { lifecycleRequestApi, STEP_META } from '../../api/lifecycleRequestApi'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const STATUS_STYLE = {
  pending:  { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock size={12} /> },
  approved: { bg: 'bg-green-100 text-green-800 border-green-200',   icon: <CheckCircle size={12} /> },
  rejected: { bg: 'bg-red-100 text-red-800 border-red-200',         icon: <XCircle size={12} /> },
}

const HEALTH_STYLE = {
  ok:      'text-emerald-700 bg-emerald-50 border-emerald-200',
  repair:  'text-amber-700 bg-amber-50 border-amber-200',
  damaged: 'text-red-700 bg-red-50 border-red-200',
  lost:    'text-red-900 bg-red-100 border-red-300',
}

const Requests = ({ userRole }) => {
  const role         = normaliseRole(userRole)
  const isGroundTeam = role === ROLES.GROUNDTEAM
  const canApprove   = role === ROLES.SUPERADMIN || role === ROLES.MANAGER

  const { clients } = useInventory()

  const [requests,     setRequests]    = useState([])
  const [summary,      setSummary]     = useState({ total: 0, byUser: {}, byStep: {} })
  const [loading,      setLoading]     = useState(true)
  const [error,        setError]       = useState(null)
  const [expanded,     setExpanded]    = useState(null)
  const [approveModal, setApproveModal]= useState(null)
  const [showFilters,  setShowFilters] = useState(false)
  const [filterStatus,      setFilterStatus]      = useState('all')
  const [filterStep,        setFilterStep]        = useState('')
  const [filterClientId,    setFilterClientId]    = useState('')
  const [filterRequestedBy, setFilterRequestedBy] = useState('')
  const [searchQuery,       setSearchQuery]       = useState('')
  const [groundUsers,       setGroundUsers]       = useState([])

  const fetchRequests = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const filters = {
        ...(filterStatus && filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterStep        ? { toStep: filterStep }           : {}),
        ...(filterClientId    ? { clientId: filterClientId }     : {}),
        ...(filterRequestedBy ? { requestedById: filterRequestedBy } : {}),
      }
      const [data, sum] = await Promise.all([
        lifecycleRequestApi.getAll(filters),
        canApprove ? lifecycleRequestApi.getSummary() : Promise.resolve(null),
      ])
      setRequests(data)
      if (sum) setSummary(sum)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [filterStatus, filterStep, filterClientId, filterRequestedBy, canApprove])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    if (!canApprove) return
    fetch('/api/users', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const users = Array.isArray(data) ? data : []
        setGroundUsers(users.filter(u => u.role?.toLowerCase().replace(/\s/g,'') === 'groundteam'))
      })
      .catch(() => {})
  }, [canApprove])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return requests
    const q = searchQuery.toLowerCase()
    return requests.filter(r =>
      r.deviceCode?.toLowerCase().includes(q) ||
      r.setCode?.toLowerCase().includes(q) ||
      r.requestedByName?.toLowerCase().includes(q) ||
      r.stepLabel?.toLowerCase().includes(q)
    )
  }, [requests, searchQuery])

  const counts = useMemo(() => ({
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests])

  const hasActiveFilters = filterStep || filterClientId || filterRequestedBy || searchQuery
  const clearFilters = () => {
    setFilterStatus('all'); setFilterStep(''); setFilterClientId('')
    setFilterRequestedBy(''); setSearchQuery('')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isGroundTeam ? 'My Requests' : 'Request Management'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isGroundTeam
              ? 'Track your lifecycle change requests.'
              : 'Review and approve lifecycle requests from ground team.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRequests}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={18} />
          </button>
          {canApprove && (
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
                ${showFilters || hasActiveFilters
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Filter size={16} /> Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full" />}
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {canApprove && summary.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-amber-600" />
            <span className="font-semibold text-amber-800 text-sm">
              {summary.total} Pending Request{summary.total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byUser).map(([name, count]) => (
              <button key={name}
                onClick={() => { const u = groundUsers.find(u => u.name === name); if (u) setFilterRequestedBy(String(u.id)) }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 rounded-full text-xs font-medium text-amber-800 hover:bg-amber-100">
                <User size={11} /> {name}: <span className="font-bold">{count}</span>
              </button>
            ))}
            {Object.entries(summary.byStep).map(([step, count]) => {
              const meta = STEP_META[step]
              return (
                <button key={step} onClick={() => setFilterStep(step)}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-amber-200 rounded-full text-xs font-medium text-amber-800 hover:bg-amber-100">
                  {meta?.emoji} {meta?.label ?? step}: <span className="font-bold ml-1">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter bar */}
      {showFilters && canApprove && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by device code, requester name…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lifecycle Step</label>
              <select value={filterStep} onChange={e => setFilterStep(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All Steps</option>
                {Object.entries(STEP_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.emoji} {meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
              <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Requested By</label>
              <select value={filterRequestedBy} onChange={e => setFilterRequestedBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All Team Members</option>
                {groundUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
              ${filterStatus === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} /> {error}
          <button onClick={fetchRequests} className="ml-auto underline">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No requests found</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm underline">
                  Clear filters
                </button>
              )}
            </div>
          )}
          {filtered.map(req => (
            <RequestCard key={req.id} request={req}
              expanded={expanded === req.id}
              onToggle={() => setExpanded(expanded === req.id ? null : req.id)}
              canApprove={canApprove}
              onApprove={action => setApproveModal({ request: req, action })} />
          ))}
        </div>
      )}

      {approveModal && (
        <ApproveModal
          request={approveModal.request}
          action={approveModal.action}
          onClose={() => setApproveModal(null)}
          onDone={() => { setApproveModal(null); fetchRequests() }}
        />
      )}
    </div>
  )
}

const RequestCard = ({ request: req, expanded, onToggle, canApprove, onApprove }) => {
  const meta        = STEP_META[req.toStep] ?? { label: req.toStep, emoji: '📋' }
  const statusStyle = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending
  const healthStyle = HEALTH_STYLE[req.healthStatus] ?? HEALTH_STYLE.ok

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="text-2xl w-10 text-center flex-shrink-0">{meta.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{meta.label}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle.bg}`}>
              {statusStyle.icon} {req.status}
            </span>
            {req.autoApproved && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border border-purple-200">auto-approved</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {req.deviceCode ? <span><Monitor size={10} className="inline mr-0.5" />{req.deviceCode}</span>
             : req.setCode  ? <span><Layers size={10} className="inline mr-0.5" />{req.setCode}</span>
             : null}
            {' · '}By <span className="font-medium">{req.requestedByName}</span>
            {' · '}{new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${healthStyle}`}>
          {req.healthStatus === 'ok' ? '✓ OK' : req.healthStatus}
        </span>
        {expanded ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Step',     meta.label],
              ['Health',   req.healthStatus],
              ['Requested', new Date(req.createdAt).toLocaleString('en-IN')],
              ['By',        req.requestedByName],
              req.approvedAt     ? ['Approved',    new Date(req.approvedAt).toLocaleString('en-IN')] : null,
              req.approvedByName ? ['Approved by', req.approvedByName] : null,
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} className="bg-white rounded-lg border border-gray-200 p-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{k}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {req.healthNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Health Note</p>
              <p className="text-sm text-amber-800">{req.healthNote}</p>
            </div>
          )}
          {req.note && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Note</p>
              <p className="text-sm text-gray-700">{req.note}</p>
            </div>
          )}
          {req.rejectionNote && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{req.rejectionNote}</p>
            </div>
          )}

          {canApprove && req.status === 'pending' && (
            <div className="flex gap-3 pt-1">
              <button onClick={() => onApprove('reject')}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium">
                <XCircle size={16} /> Reject
              </button>
              <button onClick={() => onApprove('approve')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                <CheckCircle size={16} /> Approve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ApproveModal = ({ request: req, action, onClose, onDone }) => {
  const [note, setNote]           = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError]         = useState(null)
  const isApprove = action === 'approve'
  const meta = STEP_META[req.toStep] ?? { label: req.toStep, emoji: '📋' }

  const handleAction = async () => {
    if (!isApprove && !note.trim()) { setError('Please enter a reason for rejection.'); return }
    setProcessing(true); setError(null)
    try {
      if (isApprove) await lifecycleRequestApi.approve(req.id)
      else await lifecycleRequestApi.reject(req.id, note.trim())
      onDone()
    } catch (err) { setError(err.message) }
    finally { setProcessing(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          {isApprove ? <CheckCircle className="text-green-600" size={28} /> : <XCircle className="text-red-500" size={28} />}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isApprove ? 'Approve' : 'Reject'} Request</h2>
            <p className="text-sm text-gray-500">#{req.id} · {meta.emoji} {meta.label} · {req.requestedByName}</p>
          </div>
        </div>

        {isApprove ? (
          <div className="bg-green-50 rounded-lg border border-green-100 p-3 text-sm text-green-700">
            Approving will move <strong>{req.deviceCode ?? req.setCode}</strong> to <strong>{meta.label}</strong> status.
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Explain why this request is being rejected…" />
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleAction} disabled={processing || (!isApprove && !note.trim())}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60
              ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {processing ? 'Processing…' : isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Requests