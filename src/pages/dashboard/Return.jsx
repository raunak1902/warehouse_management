/**
 * src/pages/dashboard/Return.jsx
 * ──────────────────────────────
 * Returns & Subscription Tracking page for managers/admins.
 * Three tabs:
 *   1. Subscription Reminders — devices/sets with expiry tracking
 *   2. In Return Pipeline     — currently in return_initiated | return_transit
 *   3. Completed Returns      — returned in last 90 days
 * 
 * NEW FEATURES:
 * - Devices needing attention are highlighted with pulsing glow
 * - Notifications cleared when action taken (extend/initiate return)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  RotateCcw, Calendar, CheckCircle2, Clock,
  RefreshCw, Package, Layers, Phone,
  Building2, MapPin, ArrowRight, CalendarCheck, Truck,
  XCircle, Search, X, AlertCircle,
} from 'lucide-react'
import BarcodeResultCard from '../../components/BarcodeResultCard'
import WarehouseLocationSelector from '../../components/WarehouseLocationSelector'
import { useInventory } from '../../context/InventoryContext'

const BASE = '/api/returns'
const authH = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` })

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const timeAgo = (d) => {
  if (!d) return '—'
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const URGENCY = {
  expired:  { label: 'Expired',     bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500'    },
  critical: { label: '2 days left',  bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  warning:  { label: '7 days left',  bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'  },
  ok:       { label: 'Active',       bg: 'bg-white',     border: 'border-gray-100',   badge: 'bg-green-100 text-green-700',   dot: 'bg-green-400'  },
}

const STEP_LABELS = {
  return_initiated: { label: 'Return Initiated', color: 'bg-rose-100 text-rose-700',  icon: '↩️' },
  return_transit:   { label: 'Return In Transit', color: 'bg-pink-100 text-pink-700',  icon: '🚛' },
}

// ── Extend modal ──────────────────────────────────────────────────────────────
function ExtendModal({ item, onClose, onExtended }) {
  const [date, setDate]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)

  const handleExtend = async () => {
    if (!date) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BASE}/${item._kind}/${item.id}/extend`, {
        method: 'PATCH', headers: authH(), body: JSON.stringify({ subscriptionEndDate: date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onExtended(item.id, item._kind, new Date(data.subscriptionEndDate))
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Extend Subscription</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="mb-1 text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{item.code}</span>
          {item.client && <span> · {item.client.name}</span>}
        </div>
        {item.subscriptionEndDate && (
          <p className="text-xs text-gray-400 mb-4">Current end: {formatDate(item.subscriptionEndDate)}</p>
        )}
        <label className="block text-sm font-medium text-gray-700 mb-1.5">New subscription end date</label>
        <input
          type="date" value={date} min={minDate.toISOString().split('T')[0]}
          onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm mb-4"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleExtend} disabled={!date || loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {loading ? 'Saving…' : 'Extend'}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Subscription card ─────────────────────────────────────────────────────────
function SubscriptionCard({ item, onExtend, onInitiateReturn, isHighlighted, cardRef }) {
  const u = URGENCY[item.urgency] ?? URGENCY.ok
  const daysText = item.daysLeft === null ? null
    : item.daysLeft < 0  ? `${Math.abs(item.daysLeft)}d overdue`
    : item.daysLeft === 0 ? 'Expires today'
    : `${item.daysLeft}d remaining`

  const canReturn = ['active', 'installed'].includes(item.lifecycleStatus)

  return (
    <div 
      ref={cardRef}
      className={`rounded-xl border ${u.border} ${u.bg} p-4 transition-all hover:shadow-sm
        ${isHighlighted ? 'animate-pulse-glow ring-2 ring-blue-400' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 border border-gray-100">
          {item._kind === 'set' ? <Layers size={16} className="text-indigo-500" /> : <Package size={16} className="text-blue-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{item.code}</span>
                <span className="text-xs text-gray-400">{item.type}</span>
                <span className="text-xs text-gray-400 capitalize">({item.lifecycleStatus?.replace(/_/g, ' ')})</span>
              </div>
              {item.client && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                  <Building2 size={10} /><span>{item.client.name}</span>
                  {item.client.phone && <><span>·</span><Phone size={10} /><span>{item.client.phone}</span></>}
                </div>
              )}
              {item.location && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                  <MapPin size={10} /><span>{item.location}</span>
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.badge} inline-flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${u.dot}`}></span>
                {daysText ?? u.label}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                <Calendar size={10} className="inline mr-0.5" />{formatDate(item.subscriptionEndDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap items-center">
            <button onClick={() => onExtend(item)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg transition-colors">
              <CalendarCheck size={12} />Extend
            </button>
            <div className="relative group">
              <button
                onClick={() => canReturn && onInitiateReturn(item)}
                disabled={!canReturn}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors
                  ${canReturn
                    ? 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200 cursor-pointer'
                    : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                  }`}
              >
                <RotateCcw size={12} />Initiate Return
              </button>
              {!canReturn && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 hidden group-hover:block z-10 text-center shadow-lg">
                  Device must be Active or Installed to initiate return
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline card ─────────────────────────────────────────────────────────────
function PipelineCard({ item }) {
  const step = STEP_LABELS[item.lifecycleStatus] ?? { label: item.lifecycleStatus, color: 'bg-gray-100 text-gray-700', icon: '📦' }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
          {item._kind === 'set' ? <Layers size={16} className="text-indigo-400" /> : <Package size={16} className="text-blue-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{item.code}</span>
                <span className="text-xs text-gray-400">{item.type}</span>
              </div>
              {item.client && <p className="text-xs text-gray-500 mt-0.5"><Building2 size={10} className="inline mr-1" />{item.client.name}</p>}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${step.color}`}>
              {step.icon} {step.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
            {item.initiatedBy && (
              <span className="flex items-center gap-1">
                <ArrowRight size={10} />Initiated by <span className="font-medium text-gray-600 ml-1">{item.initiatedBy}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} />{item.daysInStep === 0 ? 'Today' : `${item.daysInStep}d in this step`}
            </span>
            {item.subscriptionEndDate && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />Sub ended {formatDate(item.subscriptionEndDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Completed card ────────────────────────────────────────────────────────────
function CompletedCard({ item }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-green-100">
          <CheckCircle2 size={16} className="text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{item.code}</span>
                <span className="text-xs text-gray-400">{item.type}</span>
              </div>
              {item.client && <p className="text-xs text-gray-500 mt-0.5">{item.client.name}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">✓ Returned</span>
              <p className="text-xs text-gray-400 mt-1">{timeAgo(item.returnedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'subscriptions', label: 'Subscription Reminders', icon: Calendar   },
  { id: 'pipeline',      label: 'In Return Pipeline',     icon: Truck       },
  { id: 'completed',     label: 'Completed Returns',      icon: CheckCircle2 },
]

const Return = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { scanDevice } = useInventory()
  const [tab, setTab]               = useState('subscriptions')
  const [data, setData]             = useState({ subscriptions: null, pipeline: null, completed: null })
  const [loading, setLoading]       = useState({})
  const [error, setError]           = useState({})
  const [search, setSearch]         = useState('')
  const [extendItem, setExtendItem] = useState(null)
  const [urgencyFilter, setFilter]  = useState('all')
  const [highlightedItems, setHighlightedItems] = useState(new Set())
  const [barcodeDevice, setBarcodeDevice] = useState(null)   // for BarcodeResultCard modal
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError, setBarcodeError] = useState('')

  // NEW: warehouse location to receive the returning device
  const [returnWarehouseId,               setReturnWarehouseId]               = useState(null)
  const [returnWarehouseZone,             setReturnWarehouseZone]             = useState('Quality Check')
  const [returnWarehouseSpecificLocation, setReturnWarehouseSpecificLocation] = useState('')
  const [showReturnWarehouseModal,        setShowReturnWarehouseModal]        = useState(false)
  const [pendingReturnItem,               setPendingReturnItem]               = useState(null)
  const cardRefs = useRef({})

  const fetchTab = useCallback(async (tabId, force = false) => {
    if (!force && data[tabId] !== null) return
    setLoading(p => ({ ...p, [tabId]: true }))
    setError(p => ({ ...p, [tabId]: '' }))
    try {
      const res = await fetch(`${BASE}/${tabId}`, { headers: authH() })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(p => ({ ...p, [tabId]: json }))

      // Build highlighted set from needsAttention flag AND from URL params
      if (tabId === 'subscriptions') {
        const highlight = searchParams.get('highlight')
        const urlIds = new Set()
        if (highlight && highlight !== 'all') {
          highlight.split(',').forEach(part => urlIds.add(part.trim()))
        }
        const needsAttention = new Set()
        json.forEach(item => {
          const key = `${item._kind}-${item.id}`
          if (item.needsAttention || urlIds.has(key)) {
            needsAttention.add(key)
          }
        })
        setHighlightedItems(needsAttention)

        // Scroll to first highlighted item after render
        if (needsAttention.size > 0) {
          setTimeout(() => {
            const firstKey = [...needsAttention][0]
            const el = cardRefs.current[firstKey]
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 400)
        }
      }
    } catch (e) { setError(p => ({ ...p, [tabId]: e.message })) }
    finally { setLoading(p => ({ ...p, [tabId]: false })) }
  }, [data, searchParams])

  useEffect(() => { 
    fetchTab(tab) 
  }, [tab]) // eslint-disable-line

  // When URL highlight param changes (e.g. navigated from bell), re-fetch subscriptions
  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (highlight && tab === 'subscriptions') {
      setData(p => ({ ...p, subscriptions: null }))
    }
  }, [searchParams]) // eslint-disable-line

  const refresh = () => {
    setData(p => ({ ...p, [tab]: null }))
    setTimeout(() => fetchTab(tab, true), 50)
  }

  const handleExtended = async (id, kind, newDate) => {
    const daysLeft = Math.round((newDate - new Date()) / 86400000)
    const newUrgency = daysLeft < 0 ? 'expired' : daysLeft <= 2 ? 'critical' : daysLeft <= 7 ? 'warning' : 'ok'
    
    // Update local data
    setData(p => ({
      ...p,
      subscriptions: (p.subscriptions || []).map(item =>
        item.id === id && item._kind === kind
          ? { ...item, subscriptionEndDate: newDate, daysLeft, urgency: newUrgency, needsAttention: false }
          : item
      )
    }))

    // Remove from highlighted items
    setHighlightedItems(prev => {
      const next = new Set(prev)
      next.delete(`${kind}-${id}`)
      return next
    })

    // Mark as attended in backend
    try {
      const payload = kind === 'device' ? { deviceIds: [id] } : { setIds: [id] }
      await fetch(`${BASE}/mark-attended`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify(payload)
      })
      // Trigger notification count update in parent (Layout)
      window.dispatchEvent(new CustomEvent('subscription-updated'))
    } catch (e) {
      console.error('Failed to mark attended:', e)
    }
  }

  const handleInitiateReturn = async (item) => {
    // Step 1: Ask the user where the device is being returned to.
    // Pre-fill with the item's last known warehouse location so the manager
    // just confirms (or updates if it's going to a different spot).
    setPendingReturnItem(item)
    setReturnWarehouseId(item.warehouseId || null)
    setReturnWarehouseZone(item.warehouseZone || 'Quality Check')
    setReturnWarehouseSpecificLocation(item.warehouseSpecificLocation || '')
    setShowReturnWarehouseModal(true)
  }

  const handleConfirmReturn = async () => {
    const item = pendingReturnItem
    if (!item) return

    if (!item.barcode) {
      setBarcodeError('No barcode found for this device.')
      setShowReturnWarehouseModal(false)
      return
    }
    setBarcodeLoading(true)
    setBarcodeError('')
    setShowReturnWarehouseModal(false)
    try {
      const deviceData = await scanDevice(item.barcode)
      setBarcodeDevice(deviceData)

      // Mark as attended in backend
      const payload = item._kind === 'device' ? { deviceIds: [item.id] } : { setIds: [item.id] }
      await fetch(`${BASE}/mark-attended`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify(payload)
      })
      window.dispatchEvent(new CustomEvent('subscription-updated'))

      // Remove from highlighted items
      setHighlightedItems(prev => {
        const next = new Set(prev)
        next.delete(`${item._kind}-${item.id}`)
        return next
      })
    } catch (e) {
      setBarcodeError('Failed to load device details. Please try again.')
      console.error('Failed to load barcode card:', e)
    } finally {
      setBarcodeLoading(false)
      setPendingReturnItem(null)
    }
  }

  const currentData = data[tab] ?? []

  const filtered = tab === 'subscriptions'
    ? currentData
        .filter(i => urgencyFilter === 'all' || i.urgency === urgencyFilter)
        .filter(i => !search || i.code.toLowerCase().includes(search.toLowerCase()) || i.client?.name?.toLowerCase().includes(search.toLowerCase()))
    : currentData.filter(i => !search || i.code.toLowerCase().includes(search.toLowerCase()) || i.client?.name?.toLowerCase().includes(search.toLowerCase()))

  const subCounts = (data.subscriptions || []).reduce((acc, i) => { acc[i.urgency] = (acc[i.urgency] ?? 0) + 1; return acc }, {})

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-500" />
            Returns & Subscriptions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track subscription expiry, return pipeline and completed returns</p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading[tab] ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {/* Urgency filter pills — subscriptions tab only */}
      {tab === 'subscriptions' && data.subscriptions && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all',      label: 'All',      count: data.subscriptions.length, color: 'bg-gray-100 text-gray-700 border-gray-200'          },
            { key: 'expired',  label: 'Expired',  count: subCounts.expired  ?? 0,   color: 'bg-red-100 text-red-700 border-red-200'             },
            { key: 'critical', label: '2 Days',   count: subCounts.critical ?? 0,   color: 'bg-orange-100 text-orange-700 border-orange-200'    },
            { key: 'warning',  label: '7 Days',   count: subCounts.warning  ?? 0,   color: 'bg-amber-100 text-amber-700 border-amber-200'       },
            { key: 'ok',       label: 'Active',   count: subCounts.ok       ?? 0,   color: 'bg-green-100 text-green-700 border-green-200'       },
          ].map(({ key, label, count, color }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                ${urgencyFilter === key ? color + ' ring-1 ring-offset-1 ring-current shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
              {label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${urgencyFilter === key ? 'bg-white/60' : 'bg-gray-100'}`}>{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = data[id]?.length ?? null
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all border-b-2 ${
                  tab === id ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
                {count !== null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by code or client…"
              className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-gray-50"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {loading[tab] && (
            <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
              <RefreshCw size={18} className="animate-spin" /><span className="text-sm">Loading…</span>
            </div>
          )}
          {error[tab] && !loading[tab] && (
            <div className="flex items-center justify-center h-40 gap-2 text-red-500 text-sm">
              <XCircle size={16} />{error[tab]}
            </div>
          )}
          {!loading[tab] && !error[tab] && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
              {tab === 'subscriptions' && <Calendar size={32} strokeWidth={1.5} />}
              {tab === 'pipeline'      && <Truck     size={32} strokeWidth={1.5} />}
              {tab === 'completed'     && <CheckCircle2 size={32} strokeWidth={1.5} />}
              <p className="text-sm">{
                tab === 'subscriptions' ? 'No subscriptions match this filter'
                : tab === 'pipeline'    ? 'No devices currently in return pipeline'
                : 'No completed returns in the last 90 days'
              }</p>
            </div>
          )}
          {!loading[tab] && !error[tab] && filtered.length > 0 && (
            <div className="space-y-3">
              {tab === 'subscriptions' && filtered.map(item => {
                const itemKey = `${item._kind}-${item.id}`
                return (
                  <SubscriptionCard 
                    key={itemKey} 
                    item={item} 
                    onExtend={setExtendItem} 
                    onInitiateReturn={handleInitiateReturn}
                    isHighlighted={highlightedItems.has(itemKey)}
                    cardRef={el => cardRefs.current[itemKey] = el}
                  />
                )
              })}
              {tab === 'pipeline'      && filtered.map(item => <PipelineCard  key={`${item._kind}-${item.id}`} item={item} />)}
              {tab === 'completed'     && filtered.map(item => <CompletedCard key={`${item._kind}-${item.id}`} item={item} />)}
            </div>
          )}
        </div>
      </div>

      {extendItem && <ExtendModal item={extendItem} onClose={() => setExtendItem(null)} onExtended={handleExtended} />}

      {/* ── Return Warehouse Location Modal ──────────────────────────────────── */}
      {/* Shown before initiating a return — user picks which warehouse/zone   */}
      {/* the device is coming back to (defaults to Quality Check zone)        */}
      {showReturnWarehouseModal && pendingReturnItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Confirm Return Location</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Where is <span className="font-semibold text-gray-700">{pendingReturnItem.code}</span> being returned to?
                </p>
              </div>
              <button
                onClick={() => { setShowReturnWarehouseModal(false); setPendingReturnItem(null) }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Context note — device returning from client, may go to new location */}
            <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Pre-filled with the last known warehouse location. Since the device is returning from a client, confirm or update the storage location.
              </p>
            </div>

            <WarehouseLocationSelector
              warehouseId={returnWarehouseId}
              zone={returnWarehouseZone}
              specificLocation={returnWarehouseSpecificLocation}
              onWarehouseChange={setReturnWarehouseId}
              onZoneChange={setReturnWarehouseZone}
              onSpecificLocationChange={setReturnWarehouseSpecificLocation}
              suggestedZone="Quality Check"
              required={true}
            />

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleConfirmReturn}
                disabled={!returnWarehouseId}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} /> Confirm Return
              </button>
              <button
                onClick={() => { setShowReturnWarehouseModal(false); setPendingReturnItem(null) }}
                className="px-4 text-sm text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode loading overlay */}
      {barcodeLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 flex items-center gap-3 shadow-2xl">
            <RefreshCw size={20} className="animate-spin text-indigo-500" />
            <span className="text-sm font-medium text-gray-700">Loading device details…</span>
          </div>
        </div>
      )}

      {/* Barcode error toast */}
      {barcodeError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <XCircle size={16} />{barcodeError}
          <button onClick={() => setBarcodeError('')} className="ml-2 hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* BarcodeResultCard modal */}
      {barcodeDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <BarcodeResultCard
              device={barcodeDevice}
              onClose={() => setBarcodeDevice(null)}
              onDeviceUpdated={(updated) => {
                setBarcodeDevice(updated)
                refresh()
              }}
            />
          </div>
        </div>
      )}

      {/* CSS for pulsing glow animation */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default Return