/**
 * src/pages/dashboard/Movements.jsx
 * ────────────────────────────────────
 * Warehouse Movement Log — paginated, filterable.
 * Accessible to all roles (ground team + manager + superadmin).
 * Shows DeviceLocationHistory + SetLocationHistory combined via GET /api/sets/movements.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin, Search, X, RefreshCw, ChevronLeft, ChevronRight,
  Building2, User, Calendar, ArrowRight, Filter, Package,
  Truck, Layers, SlidersHorizontal, RotateCcw, ExternalLink,
} from 'lucide-react'
import BarcodeResultCard from '../../components/BarcodeResultCard'
import SetBarcodeGenerator from '../../components/SetBarcodeGenerator'
import { API_URL } from '../../config/api'

const authHdr = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—'

const PAGE_SIZE = 30

// Location breadcrumb: e.g. "Main WH → Zone A → Rack 3"
function LocPill({ name, zone, specific }) {
  const parts = [name, zone, specific].filter(Boolean)
  if (!parts.length) return <span className="text-gray-400 italic text-xs">Unknown</span>
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />}
          <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-md text-[11px] font-medium">{p}</span>
        </span>
      ))}
    </span>
  )
}

function ReasonBadge({ reason }) {
  const styles = {
    location_move: 'bg-teal-100 text-teal-700 border-teal-200',
    updated:       'bg-blue-100 text-blue-700 border-blue-200',
    created:       'bg-emerald-100 text-emerald-700 border-emerald-200',
    added:         'bg-emerald-100 text-emerald-700 border-emerald-200',
    assigned:      'bg-violet-100 text-violet-700 border-violet-200',
    returned:      'bg-gray-100 text-gray-600 border-gray-200',
    migration:     'bg-slate-100 text-slate-500 border-slate-200',
    disassembled:  'bg-orange-100 text-orange-700 border-orange-200',
  }
  const labels = {
    location_move: '📦 Moved',
    updated:       '✏️ Updated',
    created:       '✅ Created',
    added:         '✅ Added',
    assigned:      '🔗 Assigned',
    returned:      '↩️ Returned',
    migration:     '🗄️ Initial',
    disassembled:  '🔧 Disassembled',
  }
  const cls = styles[reason] || 'bg-gray-100 text-gray-600 border-gray-200'
  const label = labels[reason] || reason || 'Changed'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  )
}

// ── Filters sidebar / panel ───────────────────────────────────────────────────
function FilterPanel({ filters, warehouses, users, onChange, onReset }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </p>
        <button onClick={onReset} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Type</label>
        <div className="flex gap-1.5">
          {[{ v: '', l: 'All' }, { v: 'device', l: 'Devices' }, { v: 'set', l: 'Sets' }].map(({ v, l }) => (
            <button key={v} onClick={() => onChange('kind', v)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filters.kind === v ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Code search */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Device / Set Code</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={filters.code}
            onChange={e => onChange('code', e.target.value)}
            placeholder="e.g. MSE-017 or ASET-003"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Warehouse */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Warehouse
        </label>
        <select
          value={filters.warehouseId}
          onChange={e => onChange('warehouseId', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white"
        >
          <option value="">All warehouses</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {/* Zone */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Zone</label>
        <input
          value={filters.zone}
          onChange={e => onChange('zone', e.target.value)}
          placeholder="e.g. Repair Section"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
        />
      </div>

      {/* Moved by */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
          <User className="w-3 h-3" /> Moved By
        </label>
        <select
          value={filters.changedById}
          onChange={e => onChange('changedById', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white"
        >
          <option value="">All users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Date Range
        </label>
        <div className="space-y-2">
          <input type="date" value={filters.dateFrom} onChange={e => onChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
          <input type="date" value={filters.dateTo} onChange={e => onChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
      </div>
    </div>
  )
}

// ── Movement record card ──────────────────────────────────────────────────────
function MovementCard({ record, onViewDevice, onViewSet }) {
  const wh   = record.warehouse?.name || record.warehouseName || (record.warehouseId ? `Warehouse #${record.warehouseId}` : null)
  const zone = record.warehouseZone
  const spec = record.warehouseSpecificLocation
  const who  = record.changedBy?.name || record.changedByName || 'System'
  const role = record.changedBy?.role?.name || ''
  const isSet = record._kind === 'set'

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">

        {/* Left: entity + location */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${isSet ? 'bg-violet-50' : 'bg-teal-50'}`}>
            {isSet
              ? <Layers className="w-4 h-4 text-violet-600" />
              : <MapPin className="w-4 h-4 text-teal-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button
                onClick={() => isSet ? onViewSet(record) : onViewDevice(record.device)}
                className={`font-mono text-sm font-bold flex items-center gap-1 transition-colors ${isSet ? 'text-violet-700 hover:text-violet-900' : 'text-gray-900 hover:text-primary-600'}`}
              >
                {isSet ? record.setCode : (record.device?.code || `Device #${record.deviceId}`)}
                <ExternalLink className="w-3 h-3" />
              </button>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isSet ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                {isSet ? 'Set' : 'Device'}
              </span>
              <ReasonBadge reason={record.changeReason} />
            </div>

            {/* New location */}
            <LocPill name={wh} zone={zone} specific={spec} />

            {/* Notes */}
            {record.notes && (
              <p className="text-xs text-gray-400 mt-1.5 italic">"{record.notes}"</p>
            )}
          </div>
        </div>

        {/* Right: who + when */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-gray-700">{who}</p>
          {role && <p className="text-[10px] text-gray-400">{role}</p>}
          <p className="text-[10px] text-gray-400 mt-1">{fmt(record.timestamp)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main Movements page ───────────────────────────────────────────────────────
export default function Movements({ userRole }) {
  const [records,    setRecords]    = useState([])
  const [total,      setTotal]      = useState(0)
  const [pages,      setPages]      = useState(1)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)

  const [warehouses, setWarehouses] = useState([])
  const [users,      setUsers]      = useState([])

  const [showFilters, setShowFilters] = useState(false)
  const [filters,    setFilters]    = useState({
    code: '', warehouseId: '', zone: '', changedById: '', dateFrom: '', dateTo: '', kind: '',
  })

  // Detail modals
  const [viewDevice, setViewDevice] = useState(null)
  const [viewSet,    setViewSet]    = useState(null)

  // Fetch warehouse + user lists for filter dropdowns
  useEffect(() => {
    fetch(`${API_URL}/api/warehouses`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setWarehouses(Array.isArray(data) ? data : []))
      .catch(() => {})

    fetch(`${API_URL}/api/users`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const fetchMovements = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pg, pageSize: PAGE_SIZE })
      if (filters.code)        params.set('code',        filters.code.trim())
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId)
      if (filters.zone)        params.set('zone',        filters.zone.trim())
      if (filters.changedById) params.set('changedById', filters.changedById)
      if (filters.dateFrom)    params.set('dateFrom',    filters.dateFrom)
      if (filters.dateTo)      params.set('dateTo',      filters.dateTo)
      if (filters.kind)        params.set('kind',        filters.kind)

      const r = await fetch(`${API_URL}/api/sets/movements?${params}`, { headers: authHdr() })
      if (!r.ok) throw new Error('Failed to load')
      const data = await r.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
      setPage(data.page || pg)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchMovements(1) }, [filters]) // eslint-disable-line

  const handleFilterChange = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }))
  }

  const handleReset = () => {
    setFilters({ code: '', warehouseId: '', zone: '', changedById: '', dateFrom: '', dateTo: '', kind: '' })
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const handleViewDevice = async (deviceSnippet) => {
    if (!deviceSnippet?.id) return
    try {
      const r = await fetch(`${API_URL}/api/devices/${deviceSnippet.id}`, { headers: authHdr() })
      if (r.ok) setViewDevice(await r.json())
    } catch {}
  }

  const handleViewSet = async (record) => {
    if (record.setId) {
      try {
        const r = await fetch(`${API_URL}/api/sets/${record.setId}`, { headers: authHdr() })
        if (r.ok) { setViewSet(await r.json()); return }
      } catch {}
    }
    // Set was disassembled — show minimal info
    setViewSet({
      id: null, code: record.setCode, barcode: '—', setTypeName: '—',
      lifecycleStatus: 'available', healthStatus: 'ok', components: [],
      warehouseId: record.warehouseId, warehouseZone: record.warehouseZone,
      warehouseSpecificLocation: record.warehouseSpecificLocation,
      warehouse: record.warehouseName ? { name: record.warehouseName } : null,
      _disassembled: true,
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-teal-600" />
            Movement Log
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            All device and set warehouse location changes
            {total > 0 && <span className="ml-2 text-gray-400">— {total.toLocaleString()} total records</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-primary-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => fetchMovements(page)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-5">

        {/* Filters panel */}
        {showFilters && (
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm sticky top-4">
              <FilterPanel
                filters={filters}
                warehouses={warehouses}
                users={users}
                onChange={handleFilterChange}
                onReset={handleReset}
              />
            </div>
          </aside>
        )}

        {/* Records */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading movements…</span>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No movement records found</p>
              {activeFilterCount > 0 && (
                <button onClick={handleReset} className="mt-3 text-sm text-primary-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {records.map(record => (
                <MovementCard
                  key={`${record._kind}-${record.id}`}
                  record={record}
                  onViewDevice={handleViewDevice}
                  onViewSet={handleViewSet}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && !loading && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {pages} · {total} records
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchMovements(page - 1)}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, pages - 4))
                  const pg = start + i
                  if (pg > pages) return null
                  return (
                    <button
                      key={pg}
                      onClick={() => fetchMovements(pg)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                        pg === page
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {pg}
                    </button>
                  )
                })}

                <button
                  onClick={() => fetchMovements(page + 1)}
                  disabled={page >= pages}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Device detail modal on record click */}
      {viewDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <BarcodeResultCard
              device={viewDevice}
              onClose={() => setViewDevice(null)}
              onDeviceUpdated={(updated) => { setViewDevice(updated); fetchMovements(page) }}
            />
          </div>
        </div>
      )}

      {/* Set detail modal */}
      {viewSet && !viewSet._disassembled && (
        <SetBarcodeGenerator
          key={viewSet.barcode || viewSet.id}
          set={viewSet}
          onClose={() => setViewSet(null)}
          onSetUpdated={() => { setViewSet(null); fetchMovements(page) }}
        />
      )}

      {/* Disassembled set — info only */}
      {viewSet?._disassembled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setViewSet(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900">{viewSet.code}</h3>
              </div>
              <button onClick={() => setViewSet(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800 mb-3">
              This set has been disassembled. View full history in Set History.
            </div>
            {(viewSet.warehouse?.name || viewSet.warehouseId) && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Last location: </span>
                {[viewSet.warehouse?.name, viewSet.warehouseZone, viewSet.warehouseSpecificLocation].filter(Boolean).join(' › ')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}