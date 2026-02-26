import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ClipboardList, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, Search, X, User, Layers, Monitor,
  Building2, AlertTriangle, FileText, TrendingUp,
  ArrowRight, CheckCircle2, Truck,
  ChevronRight, Hourglass
} from 'lucide-react'
import { normaliseRole, ROLES } from '../../App'
import { useInventory } from '../../context/InventoryContext'
import { lifecycleRequestApi, STEP_META, VALID_NEXT_STEPS } from '../../api/lifecycleRequestApi'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

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
                    ? 'w-8 h-8 bg-primary-600 border-primary-600 text-white shadow-md ring-2 ring-primary-200'
                    : isDone
                    ? 'w-7 h-7 bg-primary-100 border-primary-300 text-primary-600'
                    : isPending
                    ? 'w-8 h-8 bg-amber-500 border-amber-400 text-white shadow-md ring-2 ring-amber-200 animate-pulse'
                    : isNext
                    ? 'w-6 h-6 bg-orange-50 border-orange-300 text-orange-400'
                    : 'w-5 h-5 bg-gray-100 border-gray-200 text-gray-300'
                  }
                `}>
                  {isDone ? <CheckCircle2 size={isCurrent ? 14 : 12} /> : <span style={{ fontSize: isCurrent ? 14 : 11 }}>{meta?.emoji}</span>}
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
const Requests = ({ userRole }) => {
  const role         = normaliseRole(userRole)
  const isGroundTeam = role === ROLES.GROUNDTEAM
  const canApprove   = role === ROLES.SUPERADMIN || role === ROLES.MANAGER

  const { clients, devices, deviceSets } = useInventory()

  const [allRequests,      setAllRequests]      = useState([])
  const [summary,          setSummary]          = useState({ total: 0, byUser: {}, byStep: {} })
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [expandedCard,     setExpandedCard]     = useState(null)
  const [expandedTimeline, setExpandedTimeline] = useState(null)
  const [approveModal,     setApproveModal]     = useState(null)

  const [deployCollapsed,  setDeployCollapsed]  = useState(false)
  const [returnCollapsed,  setReturnCollapsed]  = useState(false)
  const [completedCollapsed, setCompletedCollapsed] = useState(true)

  const [searchQuery,      setSearchQuery]      = useState('')
  const [filterClient,     setFilterClient]     = useState('')
  const [filterStatus,     setFilterStatus]     = useState('')
  const [filterRequester,  setFilterRequester]  = useState('')

  // Per-section filter state
  const [deploySearch,     setDeploySearch]     = useState('')
  const [deployFilterClient, setDeployFilterClient] = useState('')
  const [deployFiltersOpen,  setDeployFiltersOpen]  = useState(false)
  const [returnSearch,     setReturnSearch]     = useState('')
  const [returnFilterClient, setReturnFilterClient] = useState('')
  const [returnFiltersOpen,  setReturnFiltersOpen]  = useState(false)
  const [completedSearch,  setCompletedSearch]  = useState('')

  const [groundUsers,  setGroundUsers]  = useState([])
  const [deviceSetMap, setDeviceSetMap] = useState({})

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
      if (devices) {
        devices.forEach(d => {
          const key = `device-${d.id}`
          if (map[key]) {
            map[key].currentStatus = d.lifecycleStatus
            map[key].healthStatus  = d.healthStatus || 'ok'
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
      setDeviceSetMap(map)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [canApprove, clients, devices, deviceSets])

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
    allRequests.forEach(req => {
      const key = req.deviceId ? `device-${req.deviceId}` : `set-${req.setId}`
      if (!groups[key]) {
        groups[key] = { key, deviceId: req.deviceId, setId: req.setId, code: req.deviceCode || req.setCode, type: req.deviceType, isSet: !!req.setId, info: deviceSetMap[key] || {}, pendingRequests: [], approvedHistory: [] }
      }
      if (req.status === 'pending')       groups[key].pendingRequests.push(req)
      else if (req.status === 'approved') groups[key].approvedHistory.push(req)
    })
    Object.values(groups).forEach(g => {
      g.pendingRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      g.approvedHistory.sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt))
    })
    return Object.values(groups)
  }, [allRequests, deviceSetMap])

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
  // Unclassified (no currentStatus yet, or toStep tells us which journey)
  const journeyOf      = (g) => {
    if (!g.info.currentStatus) {
      const toStep = g.pendingRequests[0]?.toStep || g.approvedHistory[0]?.toStep
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

  // Filtered variants
  const applyFilter = (groups, search, clientFilter) =>
    groups.filter(g => {
      const q = search.toLowerCase()
      return (
        (!q || g.code?.toLowerCase().includes(q) || g.type?.toLowerCase().includes(q) || g.info.clientName?.toLowerCase().includes(q)) &&
        (!clientFilter || g.info.clientId === parseInt(clientFilter))
      )
    })

  const filteredDeployGroups    = useMemo(() => applyFilter(deployGroups,    deploySearch,    deployFilterClient),    [deployGroups,    deploySearch,    deployFilterClient])
  const filteredReturnGroups    = useMemo(() => applyFilter(returnGroups,    returnSearch,    returnFilterClient),    [returnGroups,    returnSearch,    returnFilterClient])
  const filteredCompletedGroups = useMemo(() => applyFilter(completedGroups, completedSearch, ''),                   [completedGroups, completedSearch])

  const counts = useMemo(() => ({
    pending:         allRequests.filter(r => r.status === 'pending').length,
    approved:        allRequests.filter(r => r.status === 'approved').length,
    rejected:        allRequests.filter(r => r.status === 'rejected').length,
    deployActive:    deployGroups.length,
    deployPending:   deployGroups.reduce((n, g) => n + g.pendingRequests.length, 0),
    returnActive:    returnGroups.length,
    returnPending:   returnGroups.reduce((n, g) => n + g.pendingRequests.length, 0),
    completed:       completedGroups.length,
  }), [allRequests, deployGroups, returnGroups, completedGroups])

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
          onClick={fetchRequests}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-text-secondary hover:bg-gray-50 text-xs font-semibold transition-colors shadow-sm flex-shrink-0"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stats Bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Deploy stats */}
        <div className="bg-white rounded-xl border border-blue-100 p-3 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Truck size={16} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-text-primary leading-none">{counts.deployActive}</p>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">Deployments</p>
            {counts.deployPending > 0 && (
              <p className="text-[10px] font-bold text-amber-500 mt-0.5">{counts.deployPending} pending</p>
            )}
          </div>
        </div>
        {/* Return stats */}
        <div className="bg-white rounded-xl border border-rose-100 p-3 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
            <ArrowRight size={16} className="text-rose-500 rotate-180" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-text-primary leading-none">{counts.returnActive}</p>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">Returns</p>
            {counts.returnPending > 0 && (
              <p className="text-[10px] font-bold text-amber-500 mt-0.5">{counts.returnPending} pending</p>
            )}
          </div>
        </div>
        <StatTile label="Approved" value={counts.approved} icon={CheckCircle2} accent={{ bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', subText: 'text-emerald-500' }} />
        <StatTile label="Rejected" value={counts.rejected} icon={XCircle}     accent={{ bg: 'bg-red-50',     icon: 'text-red-500',     border: 'border-red-100',     subText: 'text-red-400'     }} />
      </div>

      {/* ── Pending-by-user strip (managers only) ───────────────────────── */}
      {canApprove && counts.pending > 0 && summary.byUser && Object.keys(summary.byUser).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold flex-shrink-0">
            <Clock size={13} /> Awaiting approval:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(summary.byUser).map(([name, count]) => (
              <span key={name} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs font-semibold text-amber-800">
                <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center">
                  {initials(name)}
                </span>
                {name} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Error / Loading ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={fetchRequests} className="ml-auto text-xs underline font-semibold">Retry</button>
        </div>
      )}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-muted font-medium">Loading requests…</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">

          {/* ════════════════════════════════════════════════════════════════
              📦 DEPLOYMENT REQUESTS
          ════════════════════════════════════════════════════════════════ */}
          <section>
            {/* Section header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Truck size={15} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary leading-none">Deployment Requests</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {counts.deployActive} active
                    {counts.deployPending > 0 && <span className="text-amber-500 font-bold"> · {counts.deployPending} awaiting approval</span>}
                  </p>
                </div>
              </div>
              {/* Deploy search */}
              <div className="relative hidden sm:block">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={deploySearch}
                  onChange={e => setDeploySearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-300 bg-gray-50 w-36"
                />
              </div>
              {/* Client filter */}
              <select
                value={deployFilterClient}
                onChange={e => setDeployFilterClient(e.target.value)}
                className="hidden sm:block px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-300 bg-gray-50 max-w-[120px]"
              >
                <option value="">All Clients</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={() => setDeployCollapsed(c => !c)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-text-secondary hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                {deployCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                {deployCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>

            {/* Mobile search row */}
            {!deployCollapsed && (
              <div className="flex sm:hidden gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search deployments…" value={deploySearch} onChange={e => setDeploySearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-300 bg-gray-50" />
                </div>
                <select value={deployFilterClient} onChange={e => setDeployFilterClient(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50">
                  <option value="">All Clients</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {!deployCollapsed && (
              <div className="space-y-2.5">
                {filteredDeployGroups.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                      <Truck size={20} className="text-blue-300" />
                    </div>
                    <p className="text-sm font-semibold text-text-muted">No active deployment requests</p>
                  </div>
                ) : (
                  filteredDeployGroups.map(group => (
                    <DeviceSetCard
                      key={group.key}
                      group={group}
                      expanded={expandedCard === group.key}
                      timelineExpanded={expandedTimeline === group.key}
                      onToggle={() => setExpandedCard(expandedCard === group.key ? null : group.key)}
                      onToggleTimeline={() => setExpandedTimeline(expandedTimeline === group.key ? null : group.key)}
                      canApprove={canApprove}
                      onApprove={(request, action) => setApproveModal({ request, action })}
                    />
                  ))
                )}
              </div>
            )}
          </section>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-200" />

          {/* ════════════════════════════════════════════════════════════════
              ↩️ RETURN REQUESTS
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <ArrowRight size={15} className="text-rose-500 rotate-180" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary leading-none">Return Requests</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {counts.returnActive} active
                    {counts.returnPending > 0 && <span className="text-amber-500 font-bold"> · {counts.returnPending} awaiting approval</span>}
                  </p>
                </div>
              </div>
              <div className="relative hidden sm:block">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={returnSearch}
                  onChange={e => setReturnSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-300 bg-gray-50 w-36"
                />
              </div>
              <select
                value={returnFilterClient}
                onChange={e => setReturnFilterClient(e.target.value)}
                className="hidden sm:block px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-300 bg-gray-50 max-w-[120px]"
              >
                <option value="">All Clients</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={() => setReturnCollapsed(c => !c)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-text-secondary hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                {returnCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                {returnCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>

            {!returnCollapsed && (
              <div className="flex sm:hidden gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search returns…" value={returnSearch} onChange={e => setReturnSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-300 bg-gray-50" />
                </div>
                <select value={returnFilterClient} onChange={e => setReturnFilterClient(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50">
                  <option value="">All Clients</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {!returnCollapsed && (
              <div className="space-y-2.5">
                {filteredReturnGroups.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-2">
                      <ArrowRight size={20} className="text-rose-300 rotate-180" />
                    </div>
                    <p className="text-sm font-semibold text-text-muted">No active return requests</p>
                  </div>
                ) : (
                  filteredReturnGroups.map(group => (
                    <DeviceSetCard
                      key={group.key}
                      group={group}
                      expanded={expandedCard === group.key}
                      timelineExpanded={expandedTimeline === group.key}
                      onToggle={() => setExpandedCard(expandedCard === group.key ? null : group.key)}
                      onToggleTimeline={() => setExpandedTimeline(expandedTimeline === group.key ? null : group.key)}
                      canApprove={canApprove}
                      onApprove={(request, action) => setApproveModal({ request, action })}
                    />
                  ))
                )}
              </div>
            )}
          </section>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-200" />

          {/* ════════════════════════════════════════════════════════════════
              ✅ COMPLETED  (collapsed by default)
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary leading-none">Completed</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">{counts.completed} devices · active or returned to warehouse</p>
                </div>
              </div>
              {!completedCollapsed && (
                <div className="relative hidden sm:block">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={completedSearch}
                    onChange={e => setCompletedSearch(e.target.value)}
                    className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-300 bg-gray-50 w-36"
                  />
                </div>
              )}
              <button
                onClick={() => setCompletedCollapsed(c => !c)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-text-secondary hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                {completedCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                {completedCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>

            {!completedCollapsed && (
              <div className="space-y-2.5">
                {filteredCompletedGroups.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                    <p className="text-sm font-semibold text-text-muted">No completed requests found</p>
                  </div>
                ) : (
                  filteredCompletedGroups.map(group => (
                    <DeviceSetCard
                      key={group.key}
                      group={group}
                      expanded={expandedCard === group.key}
                      timelineExpanded={expandedTimeline === group.key}
                      onToggle={() => setExpandedCard(expandedCard === group.key ? null : group.key)}
                      onToggleTimeline={() => setExpandedTimeline(expandedTimeline === group.key ? null : group.key)}
                      canApprove={canApprove}
                      onApprove={(request, action) => setApproveModal({ request, action })}
                    />
                  ))
                )}
              </div>
            )}
          </section>

        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────── */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE / SET CARD
// ═══════════════════════════════════════════════════════════════════════════════
const DeviceSetCard = ({
  group, expanded, timelineExpanded,
  onToggle, onToggleTimeline,
  canApprove, onApprove
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
                <div className="mt-2 lg:hidden flex items-center gap-2 flex-wrap">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${stepMeta.bgClass} ${stepMeta.textClass} ${stepMeta.borderClass}`}>
                    <ArrowRight size={9} /> {stepMeta.emoji} {stepMeta.label}
                  </div>
                  <span className={`text-[10px] font-bold ${waiting?.urgent ? 'text-red-500' : 'text-amber-600'}`}>
                    waiting {waiting?.label}
                  </span>
                </div>
              )}
            </div>

            {/* Chevron */}
            <div className="flex-shrink-0 mt-1 text-gray-400">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {/* Step track */}
          <div className="mt-3">
            <StepTrack currentStatus={currentStatus} pendingStep={latestPending?.toStep} />
          </div>
        </div>

        {/* ── RIGHT PANEL (desktop only): pending request quick view ──────── */}
        {hasPending && latestPending && stepMeta && (
          <div className="hidden lg:flex flex-col justify-center gap-2 px-4 py-3 min-w-[240px] max-w-[280px] bg-amber-50/50">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">
              <Clock size={10} className="text-amber-500" /> Awaiting Approval
            </p>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold w-fit ${stepMeta.bgClass} ${stepMeta.textClass} ${stepMeta.borderClass}`}>
              <ArrowRight size={10} /> {stepMeta.emoji} {stepMeta.label}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {initials(latestPending.requestedByName)}
              </span>
              <span className="font-semibold text-text-secondary truncate">{latestPending.requestedByName}</span>
              <span className="text-gray-300">·</span>
              <span className={`font-bold flex-shrink-0 ${waiting?.urgent ? 'text-red-500' : 'text-amber-600'}`}>
                {waiting?.label}
              </span>
            </div>
            {canApprove && (
              <div className="flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onApprove(latestPending, 'approve')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm"
                >
                  <CheckCircle size={11} /> Approve
                </button>
                <button
                  onClick={() => onApprove(latestPending, 'reject')}
                  className="flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-[11px] font-bold transition-all"
                >
                  <XCircle size={11} /> Reject
                </button>
                {pendingRequests.length > 1 && (
                  <span className="text-[10px] text-text-muted font-medium ml-0.5">+{pendingRequests.length - 1} more</span>
                )}
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

          {/* All caught up message */}
          {pendingRequests.length === 0 && (
            <div className="px-4 py-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 border-b border-gray-100">
              <CheckCircle2 size={14} className="text-emerald-500" />
              No pending requests — all caught up
            </div>
          )}

          {/* Timeline toggle */}
          {approvedHistory.length > 0 && (
            <div className="px-4 py-3">
              <button
                onClick={e => { e.stopPropagation(); onToggleTimeline() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
              >
                <TrendingUp size={13} />
                {timelineExpanded ? 'Hide' : 'Show'} Approval History
                <span className="ml-auto bg-primary-200 text-primary-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {approvedHistory.length} steps
                </span>
                {timelineExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          )}

          {/* Timeline — newest first */}
          {timelineExpanded && approvedHistory.length > 0 && (
            <div className="px-4 pb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <TrendingUp size={10} /> Approval History · Latest First
                </p>
                <div>
                  {approvedHistory.map((req, idx) => (
                    <TimelineItem key={req.id} request={req} isLast={idx === approvedHistory.length - 1} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENDING REQUEST ITEM
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
const TimelineItem = ({ request: req, isLast }) => {
  const meta = STEP_META[req.toStep] || { label: req.toStep, emoji: '📋', bgClass: 'bg-gray-100', textClass: 'text-gray-700', borderClass: 'border-gray-200' }

  return (
    <div className="flex gap-3">
      {/* Spine */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center text-sm ${meta.bgClass}`}>
          {meta.emoji}
        </div>
        {!isLast && <div className="w-px bg-gradient-to-b from-gray-300 to-transparent flex-1 mt-1 min-h-[14px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <p className={`text-xs font-bold ${meta.textClass}`}>{meta.label}</p>
        <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
          <User size={9} />
          {req.approvedByName || 'System'}
          <span className="text-gray-300">·</span>
          {new Date(req.approvedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        {req.note && !req.note.startsWith('{') && (
          <p className="mt-1 text-[10px] text-text-secondary italic bg-gray-50 border-l-2 border-gray-300 pl-2 py-0.5 rounded-r">
            {req.note}
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE / REJECT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const ApproveModal = ({ request: req, action, onClose, onDone }) => {
  const [rejectionNote, setRejectionNote] = useState('')
  const [loading,       setLoading]       = useState(false)
  const meta       = STEP_META[req.toStep] || { label: req.toStep, emoji: '📋', bgClass: 'bg-gray-100', textClass: 'text-gray-700' }
  const waiting    = waitingDuration(req.createdAt)
  const healthInfo = HEALTH_STYLE[req.healthStatus] || HEALTH_STYLE.ok
  const isApprove  = action === 'approve'

  const handleSubmit = async () => {
    if (!isApprove && !rejectionNote.trim()) { alert('Please provide a rejection reason'); return }
    setLoading(true)
    try {
      if (isApprove) await lifecycleRequestApi.approve(req.id)
      else await lifecycleRequestApi.reject(req.id, rejectionNote)
      onDone()
    } catch (err) {
      alert(`Failed: ${err.message}`)
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