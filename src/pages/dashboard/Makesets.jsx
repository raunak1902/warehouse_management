import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Layers, Plus, Search, X, ChevronRight, Package, Monitor, Smartphone,
  LayoutGrid, Tv, Battery, Check, AlertTriangle, Trash2, RefreshCw,
  Info, Wrench, PackagePlus, ArrowRight, Box, Lightbulb, TrendingUp,
  CheckCircle, XCircle, Settings, Save, ChevronDown, ChevronUp, Mouse, Zap, QrCode, Link2,
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { setApi } from '../../api/setApi'
import { resolveTypeId, getTypeLabel, getCodePrefixForType, deviceMatchesSlot, getAllTypes, loadCustomTypes, getColorClasses } from '../../config/deviceTypeRegistry'
import SetBarcodeGenerator from '../../components/SetBarcodeGenerator'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CUSTOM_SET_TYPES_KEY = 'edsignage_custom_set_types'

// ── Set types now use canonical Device Type IDs from deviceTypeRegistry ──────
// deviceTypes array = canonical IDs (e.g. "MB", "AST", "TV", "IST")
// deviceMatchesSlot() in getAvailableByType resolves any legacy type string to these IDs
const BUILTIN_SET_TYPES = {
  aStand: {
    label: 'A-Frame Standee',
    icon: 'LayoutGrid',
    colorClasses: {
      badge: 'bg-orange-100 text-orange-700 border-orange-200',
      card: 'border-orange-200 bg-orange-50',
      header: 'bg-orange-500',
    },
    deviceTypes: ['AST', 'TV', 'MB'],          // Canonical IDs
    deviceLabels: { AST: 'A-Frame Stand', TV: 'TV (43"+)', MB: 'Media Box' },
    builtin: true,
  },
  iStand: {
    label: 'I-Frame Standee',
    icon: 'Monitor',
    colorClasses: {
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      card: 'border-blue-200 bg-blue-50',
      header: 'bg-blue-500',
    },
    deviceTypes: ['IST', 'TV', 'MB'],          // Canonical IDs
    deviceLabels: { IST: 'I-Frame Stand', TV: 'TV (43"+)', MB: 'Media Box' },
    builtin: true,
  },
  tabletCombo: {
    label: 'Tablet Combo',
    icon: 'Smartphone',
    colorClasses: {
      badge: 'bg-purple-100 text-purple-700 border-purple-200',
      card: 'border-purple-200 bg-purple-50',
      header: 'bg-purple-500',
    },
    deviceTypes: ['TAB', 'BAT', 'TST'],        // Canonical IDs
    deviceLabels: { TAB: 'Tablet', BAT: 'Battery Pack', TST: 'Tablet Stand' },
    builtin: true,
  },
}

// Built from registry — canonical IDs and labels, plus any user-defined custom types
const ALL_KNOWN_DEVICE_TYPES = getAllTypes().map(t => ({ value: t.id, label: t.label }))

const ICON_MAP = { LayoutGrid, Monitor, Smartphone, Tv, Battery, Package, Layers, Mouse, Zap, Box }

const HEALTH_STYLES = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  repair: 'bg-amber-100 text-amber-700 border-amber-200',
  damage: 'bg-red-100 text-red-700 border-red-200',
}
// Normalize legacy health values written by old ground team requests
const normalizeHealth = (v) => {
  const map = { damaged: 'damage', needs_repair: 'repair', critical: 'damage' }
  return map[v] ?? v ?? 'ok'
}
const getHealthStyle = (raw) => HEALTH_STYLES[normalizeHealth(raw)] ?? HEALTH_STYLES.ok
const getHealthLabel = (raw) => ({ ok: '✓ OK', repair: '🔧 Repair', damage: '⚠ Damage' }[normalizeHealth(raw)] ?? '✓ OK')

const LIFECYCLE_STYLES = {
  // warehouse bucket
  available:        'bg-slate-100 text-slate-700 border-slate-200',
  warehouse:        'bg-slate-100 text-slate-700 border-slate-200',
  returned:         'bg-slate-100 text-slate-600 border-slate-200',
  // assigning bucket
  assigning:        'bg-blue-100 text-blue-700 border-blue-200',
  assign_requested: 'bg-blue-100 text-blue-700 border-blue-200',
  assigned:         'bg-blue-100 text-blue-700 border-blue-200',
  ready_to_deploy:  'bg-teal-100 text-teal-700 border-teal-200',
  deploy_requested: 'bg-teal-100 text-teal-700 border-teal-200',
  in_transit:       'bg-amber-100 text-amber-700 border-amber-200',
  received:         'bg-purple-100 text-purple-700 border-purple-200',
  installed:        'bg-indigo-100 text-indigo-700 border-indigo-200',
  // deployed bucket
  active:           'bg-emerald-100 text-emerald-700 border-emerald-200',
  deployed:         'bg-emerald-100 text-emerald-700 border-emerald-200',
  under_maintenance:'bg-orange-100 text-orange-700 border-orange-200',
  // return
  return_initiated: 'bg-rose-100 text-rose-700 border-rose-200',
  return_requested: 'bg-rose-100 text-rose-700 border-rose-200',
  return_transit:   'bg-pink-100 text-pink-700 border-pink-200',
  // other
  lost:             'bg-red-100 text-red-700 border-red-200',
  health_update:    'bg-cyan-100 text-cyan-700 border-cyan-200',
}

const LIFECYCLE_STEP_LABELS = {
  available:        'In Warehouse',
  warehouse:        'In Warehouse',
  returned:         'Returned',
  assigning:        'Assigning to Client',
  assign_requested: 'Assigning to Client',
  assigned:         'Assigning to Client',
  ready_to_deploy:  'Ready to Deploy',
  deploy_requested: 'Ready to Deploy',
  in_transit:       'In Transit',
  received:         'Received at Site',
  installed:        'Installed',
  active:           'Active / Live',
  deployed:         'Active / Live',
  under_maintenance:'Under Maintenance',
  return_initiated: 'Return Initiated',
  return_requested: 'Return Initiated',
  return_transit:   'Return In Transit',
  lost:             'Lost',
  health_update:    'Health Update',
}

const CUSTOM_COLORS = [
  { label: 'Teal',   classes: { badge: 'bg-teal-100 text-teal-700 border-teal-200',     card: 'border-teal-200 bg-teal-50',     header: 'bg-teal-500'   } },
  { label: 'Rose',   classes: { badge: 'bg-rose-100 text-rose-700 border-rose-200',     card: 'border-rose-200 bg-rose-50',     header: 'bg-rose-500'   } },
  { label: 'Indigo', classes: { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', card: 'border-indigo-200 bg-indigo-50', header: 'bg-indigo-500' } },
  { label: 'Amber',  classes: { badge: 'bg-amber-100 text-amber-700 border-amber-200',  card: 'border-amber-200 bg-amber-50',   header: 'bg-amber-500'  } },
  { label: 'Cyan',   classes: { badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',     card: 'border-cyan-200 bg-cyan-50',     header: 'bg-cyan-500'   } },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const getIcon = (name) => ICON_MAP[name] || Package

const loadCustomSetTypes = () => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SET_TYPES_KEY) || '{}') } catch { return {} }
}
const saveCustomSetTypes = (t) => localStorage.setItem(CUSTOM_SET_TYPES_KEY, JSON.stringify(t))

const computeTip = (config, getAvailableByType) => {
  const counts = config.deviceTypes.map(t => ({
    type: t, label: config.deviceLabels[t], count: getAvailableByType(t).length,
  }))
  const min = Math.min(...counts.map(c => c.count))
  const max = Math.max(...counts.map(c => c.count))
  if (max === 0) return null
  if (min === max) return null // perfectly balanced
  const bottlenecks = counts.filter(c => c.count === min)
  const addCount = max - min
  const highestItem = counts.find(c => c.count === max)
  return { min, max, bottlenecks, addCount, highestLabel: highestItem?.label }
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const Makesets = () => {
  const { devices, refreshDevices } = useInventory()

  const [sets, setSets] = useState([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState('')

  const [customSetTypes, setCustomSetTypes] = useState(loadCustomSetTypes)
  const allSetTypes = useMemo(() => ({ ...BUILTIN_SET_TYPES, ...customSetTypes }), [customSetTypes])

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterHealth, setFilterHealth] = useState('all')
  const [showTipsPanel, setShowTipsPanel] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [showDisassemble, setShowDisassemble] = useState(null)
  const [showDefineType, setShowDefineType] = useState(false)

  const [selectedSetType, setSelectedSetType] = useState('')
  const [setName, setSetName] = useState('')
  const [selectedDevices, setSelectedDevices] = useState({})
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [disassembleLoading, setDisassembleLoading] = useState(false)
  const [showSetBarcode, setShowSetBarcode] = useState(null) // set object to show barcode for

  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeComponents, setNewTypeComponents] = useState([{ deviceType: '', label: '' }])
  const [newTypeColor, setNewTypeColor] = useState(0)
  const [newTypeIcon, setNewTypeIcon] = useState('Package')
  const [defineError, setDefineError] = useState('')

  // ── Fetch sets
  const fetchSets = useCallback(async () => {
    setSetsLoading(true); setSetsError('')
    try { setSets(await setApi.getAll()) }
    catch { setSetsError('Failed to load sets.') }
    finally { setSetsLoading(false) }
  }, [])

  useEffect(() => { fetchSets() }, [fetchSets])

  // ── Warehouse devices
  const warehouseDevices = useMemo(
    () => (devices || []).filter(d => (d.lifecycleStatus === 'available' || d.lifecycleStatus === 'warehouse') && !d.setId),
    [devices]
  )
  const getAvailableByType = useCallback(
    // slotTypeId is a canonical Device Type ID (e.g. "MB", "AST", "TV")
    // deviceMatchesSlot resolves any legacy type string on the device to its canonical ID
    (slotTypeId) => warehouseDevices.filter(d => deviceMatchesSlot(d, slotTypeId)),
    [warehouseDevices]
  )

  // ── Stock analysis per set type
  const stockAnalysis = useMemo(() => {
    const result = {}
    Object.entries(allSetTypes).forEach(([key, config]) => {
      const counts = config.deviceTypes.map(t => ({
        type: t, label: config.deviceLabels[t], count: getAvailableByType(t).length,
      }))
      const maxSets = Math.min(...counts.map(c => c.count))
      const tip = computeTip(config, getAvailableByType)
      result[key] = { counts, maxSets, tip }
    })
    return result
  }, [allSetTypes, getAvailableByType])

  // ── Filtered sets list
  const filteredSets = useMemo(() => sets.filter(s => {
    const q = search.toLowerCase()
    return (
      (!q || s.code?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.barcode?.toLowerCase().includes(q) || s.setTypeName?.toLowerCase().includes(q)) &&
      (filterType === 'all' || s.setType === filterType) &&
      (filterHealth === 'all' || s.healthStatus === filterHealth)
    )
  }), [sets, search, filterType, filterHealth])

  const WAREHOUSE_SET_STEPS = new Set(['available', 'warehouse', 'returned'])
  const DEPLOYED_SET_STEPS  = new Set(['active', 'deployed', 'under_maintenance'])
  const ASSIGNING_SET_STEPS = new Set(['assigning','assign_requested','assigned','ready_to_deploy','deploy_requested','in_transit','received','installed','return_initiated','return_requested','return_transit'])

  const stats = useMemo(() => ({
    total:     sets.length,
    warehouse: sets.filter(s => WAREHOUSE_SET_STEPS.has(s.lifecycleStatus)).length,
    deployed:  sets.filter(s => DEPLOYED_SET_STEPS.has(s.lifecycleStatus)).length,
    assigning: sets.filter(s => ASSIGNING_SET_STEPS.has(s.lifecycleStatus)).length,
    damaged:   sets.filter(s => s.healthStatus !== 'ok').length,
  }), [sets])

  // ── Create set
  const handleCreate = async () => {
    setCreateError('')
    const config = allSetTypes[selectedSetType]
    if (!config) return setCreateError('Select a set type.')
    const componentDeviceIds = Object.values(selectedDevices).filter(Boolean).map(Number)
    if (componentDeviceIds.length !== config.deviceTypes.length)
      return setCreateError('Please select one device for each component.')
    setCreateLoading(true)
    try {
      const newSet = await setApi.create({ setType: selectedSetType, setTypeName: config.label, name: setName || undefined, componentDeviceIds, location: 'Warehouse A' })
      await Promise.all([fetchSets(), refreshDevices()])  // sync both — devices get setId, stock analysis updates
      setShowCreate(false); resetCreateForm()
      setShowSetBarcode(newSet)  // show QR barcode for the newly created set
    } catch (err) {
      setCreateError(err?.response?.data?.error || 'Failed to create set.')
    } finally { setCreateLoading(false) }
  }

  const resetCreateForm = () => { setSelectedSetType(''); setSetName(''); setSelectedDevices({}); setCreateError('') }

  // ── Disassemble / delete
  const handleDisassemble = async (set) => {
    setDisassembleLoading(true)
    try { await setApi.disassemble(set.id, []); await Promise.all([fetchSets(), refreshDevices()]); setShowDisassemble(null) }
    catch (err) { alert(err?.response?.data?.error || 'Failed to disassemble set.') }
    finally { setDisassembleLoading(false) }
  }

  const handleDelete = async (set) => {
    if (!window.confirm(`Delete set ${set.code}? All components will return to warehouse.`)) return
    try { await setApi.delete(set.id); await Promise.all([fetchSets(), refreshDevices()]); setShowDetail(null) }
    catch (err) { alert(err?.response?.data?.error || 'Failed to delete set.') }
  }

  // ── Save custom type
  const handleSaveCustomType = () => {
    setDefineError('')
    if (!newTypeName.trim()) return setDefineError('Set type name is required.')
    const valid = newTypeComponents.filter(c => c.deviceType && c.label)
    if (!valid.length) return setDefineError('Add at least one component.')
    const key = 'custom_' + newTypeName.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    const updated = {
      ...customSetTypes,
      [key]: {
        label: newTypeName.trim(), icon: newTypeIcon,
        colorClasses: CUSTOM_COLORS[newTypeColor].classes,
        deviceTypes: valid.map(c => c.deviceType),
        deviceLabels: Object.fromEntries(valid.map(c => [c.deviceType, c.label])),
        builtin: false,
      },
    }
    setCustomSetTypes(updated); saveCustomSetTypes(updated)
    setShowDefineType(false); setNewTypeName(''); setNewTypeComponents([{ deviceType: '', label: '' }]); setDefineError('')
  }

  const handleDeleteCustomType = (key) => {
    if (!window.confirm('Remove this custom set type?')) return
    const updated = { ...customSetTypes }; delete updated[key]
    setCustomSetTypes(updated); saveCustomSetTypes(updated)
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-violet-600" /> Device Sets
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Bundle warehouse devices into deployable sets</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSets} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowDefineType(true)} className="flex items-center gap-2 px-3 py-2 border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg text-sm font-medium">
            <Settings className="w-4 h-4" /> Define Set Type
          </button>
          <button onClick={() => { resetCreateForm(); setShowCreate(true) }} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium text-sm shadow-sm">
            <Plus className="w-4 h-4" /> Create Set
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sets',      value: stats.total,     bg: 'bg-violet-100',  icon: Layers,         iconColor: 'text-violet-600'  },
          { label: 'In Warehouse',    value: stats.warehouse, bg: 'bg-slate-100',   icon: Package,        iconColor: 'text-slate-600'   },
          { label: 'Assigning',       value: stats.assigning, bg: 'bg-blue-100',    icon: Link2,          iconColor: 'text-blue-600'    },
          { label: 'Deployed',        value: stats.deployed,  bg: 'bg-emerald-100', icon: ArrowRight,     iconColor: 'text-emerald-600' },
          { label: 'Needs Attention', value: stats.damaged,   bg: 'bg-amber-100',   icon: AlertTriangle,  iconColor: 'text-amber-600'   },
        ].map(({ label, value, bg, icon: Icon, iconColor }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      {/* ── Smart Tips Panel ─────────────────────────────────────────────── */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
        <button className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 hover:bg-amber-100 transition-colors" onClick={() => setShowTipsPanel(v => !v)}>
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Stock Analysis &amp; Smart Tips
            <span className="text-xs font-normal text-amber-600 ml-1">— how many sets you can build right now</span>
          </div>
          {showTipsPanel ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-amber-500" />}
        </button>

        {showTipsPanel && (
          <div className="p-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(allSetTypes).map(([key, config]) => {
              const Icon = getIcon(config.icon)
              const { counts, maxSets, tip } = stockAnalysis[key] || { counts: [], maxSets: 0, tip: null }
              const min = counts.length ? Math.min(...counts.map(c => c.count)) : 0
              const max = counts.length ? Math.max(...counts.map(c => c.count)) : 0
              return (
                <div key={key} className={`border-2 rounded-xl overflow-hidden ${config.colorClasses.card}`}>
                  {/* Card header */}
                  <div className={`px-3 py-2.5 ${config.colorClasses.header} flex items-center gap-2`}>
                    <Icon className="w-4 h-4 text-white" />
                    <span className="text-white font-semibold text-sm flex-1">{config.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${maxSets > 0 ? 'bg-white/25 text-white' : 'bg-red-900/30 text-red-100'}`}>
                      {maxSets} sets ready
                    </span>
                  </div>

                  {/* Component rows */}
                  <div className="px-3 py-2.5 space-y-2 bg-white">
                    {counts.map(({ type, label, count }) => {
                      const isBottleneck = count === min && count < max
                      const pct = max > 0 ? Math.round((count / max) * 100) : 0
                      return (
                        <div key={type}>
                          <div className="flex items-center gap-2 mb-0.5">
                            {count > 0
                              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            <span className={`text-xs flex-1 ${isBottleneck ? 'font-bold text-red-700' : 'text-gray-700'}`}>{label}</span>
                            <span className={`text-xs font-bold tabular-nums ${count === 0 ? 'text-red-600' : isBottleneck ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {count}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden ml-5">
                            <div
                              className={`h-full rounded-full transition-all ${count === 0 ? 'bg-red-400' : isBottleneck ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tip */}
                  <div className="px-3 pb-3">
                    {tip ? (
                      <div className="px-2.5 py-2 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800">
                          Add <strong>{tip.addCount} more {tip.bottlenecks.map(b => b.label).join(' / ')}</strong> to unlock{' '}
                          <strong>{tip.max} total sets</strong>, fully using your {tip.max} {tip.highestLabel}s
                        </p>
                      </div>
                    ) : maxSets > 0 ? (
                      <div className="px-2.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <p className="text-xs text-emerald-700 font-medium">Stock balanced — ready to build {maxSets} sets</p>
                      </div>
                    ) : (
                      <div className="px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-700">No stock available for one or more components.</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search code, name, barcode..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
          <option value="all">All Types</option>
          {Object.entries(allSetTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
          <option value="all">All Health</option>
          <option value="ok">OK</option>
          <option value="repair">Repair</option>
          <option value="damage">Damage</option>
        </select>
      </div>

      {/* Sets list */}
      {setsLoading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : setsError ? (
        <div className="flex flex-col items-center py-16 text-red-500 gap-2">
          <AlertTriangle className="w-8 h-8" /><p>{setsError}</p>
          <button onClick={fetchSets} className="text-sm text-violet-600 underline">Retry</button>
        </div>
      ) : filteredSets.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
          <Box className="w-12 h-12 opacity-40" />
          <p className="font-medium text-gray-500">No sets found</p>
          <button onClick={() => { resetCreateForm(); setShowCreate(true) }} className="mt-1 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Set
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSets.map(set => {
            const config = allSetTypes[set.setType]
            const Icon = getIcon(config?.icon)
            return (
              <div key={set.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setShowDetail(set)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${config?.colorClasses?.card || 'bg-gray-100'}`}><Icon className="w-5 h-5 text-gray-700" /></div>
                    <div><p className="font-semibold text-gray-900 text-sm">{set.code}</p><p className="text-xs text-gray-500">{set.setTypeName}</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors mt-1" />
                </div>
                {set.name && <p className="text-sm text-gray-700 font-medium mb-2">{set.name}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getHealthStyle(set.healthStatus)}`}>
                    {getHealthLabel(set.healthStatus)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LIFECYCLE_STYLES[set.lifecycleStatus] || LIFECYCLE_STYLES.available}`}>
                    {LIFECYCLE_STEP_LABELS[set.lifecycleStatus] || set.lifecycleStatus || 'In Warehouse'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Package className="w-3.5 h-3.5" />
                  <span>{set.components?.length || 0} components</span>
                  {set.location && <><span className="mx-1">·</span><span>{set.location}</span></>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════ CREATE SET MODAL ════════════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); resetCreateForm() } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2"><PackagePlus className="w-5 h-5 text-violet-600" /><h2 className="text-lg font-bold text-gray-900">Create New Set</h2></div>
              <button onClick={() => { setShowCreate(false); resetCreateForm() }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Step 1: set type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Step 1 — Choose Set Type</label>
                <div className="space-y-2">
                  {Object.entries(allSetTypes).map(([key, config]) => {
                    const Icon = getIcon(config.icon)
                    const isSelected = selectedSetType === key
                    const { counts = [], maxSets = 0, tip } = stockAnalysis[key] || {}
                    const min = counts.length ? Math.min(...counts.map(c => c.count)) : 0
                    const max = counts.length ? Math.max(...counts.map(c => c.count)) : 0
                    return (
                      <button key={key} type="button" onClick={() => { setSelectedSetType(key); setSelectedDevices({}) }}
                        className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden ${isSelected ? 'border-violet-500' : 'border-gray-200 hover:border-gray-300'}`}>
                        {/* Row header */}
                        <div className={`flex items-center gap-2 px-3 py-2 ${isSelected ? config.colorClasses.header + ' text-white' : config.colorClasses.card}`}>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-700'}`} />
                          <span className={`text-sm font-semibold flex-1 ${isSelected ? 'text-white' : 'text-gray-800'}`}>{config.label}</span>
                          {!config.builtin && <span className={`text-xs px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>Custom</span>}
                          <span className={`text-xs font-bold ${isSelected ? 'text-white/90' : maxSets > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {maxSets} sets possible
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        {/* Stock rows */}
                        <div className="px-3 py-2.5 bg-white space-y-1.5">
                          {counts.map(({ type, label, count }) => {
                            const isBottleneck = count === min && count < max
                            return (
                              <div key={type} className="flex items-center gap-2">
                                {count > 0 ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                                <span className={`text-xs flex-1 ${isBottleneck ? 'font-bold text-red-700' : 'text-gray-600'}`}>{label}</span>
                                <span className={`text-xs font-bold tabular-nums ${count === 0 ? 'text-red-600' : isBottleneck ? 'text-amber-700' : 'text-emerald-700'}`}>
                                  {count} in warehouse
                                </span>
                              </div>
                            )
                          })}
                          {tip && (
                            <div className="mt-1 flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                              <TrendingUp className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-amber-800">
                                Add <strong>{tip.addCount} {tip.bottlenecks.map(b => b.label).join(' / ')}</strong> → unlock <strong>{tip.max} total sets</strong>
                              </p>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: name */}
              {selectedSetType && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Step 2 — Set Name <span className="font-normal text-gray-400">(optional)</span></label>
                  <input type="text" value={setName} onChange={e => setSetName(e.target.value)} placeholder="e.g. Showroom Set A" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
              )}

              {/* Step 3: pick devices */}
              {selectedSetType && (() => {
                const config = allSetTypes[selectedSetType]
                return (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Step 3 — Select Components</label>
                    <div className="space-y-3">
                      {config.deviceTypes.map(devType => {
                        const available = getAvailableByType(devType)
                        return (
                          <div key={devType} className={`border rounded-xl p-3 ${selectedDevices[devType] ? 'border-violet-300 bg-violet-50' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-700">{config.deviceLabels[devType]}</span>
                              <span className={`ml-auto text-xs font-semibold ${available.length === 0 ? 'text-red-600' : 'text-emerald-600'}`}>{available.length} available</span>
                            </div>
                            {available.length === 0 ? (
                              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200">⚠ No {config.deviceLabels[devType]} available in warehouse</p>
                            ) : (
                              <select value={selectedDevices[devType] || ''} onChange={e => setSelectedDevices(prev => ({ ...prev, [devType]: e.target.value }))}
                                className={`w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 ${!selectedDevices[devType] ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                                <option value="">Select {config.deviceLabels[devType]} *</option>
                                {available.map(d => <option key={d.id} value={d.id}>{d.code} — {d.brand} {d.model} ({d.size || 'N/A'})</option>)}
                              </select>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {createError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{createError}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button type="button" onClick={() => { setShowCreate(false); resetCreateForm() }} disabled={createLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 text-sm">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={createLoading || !selectedSetType} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                {createLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</> : <><PackagePlus className="w-4 h-4" /> Create Set</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ DEFINE CUSTOM TYPE MODAL ════════════ */}
      {showDefineType && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowDefineType(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2"><Settings className="w-5 h-5 text-violet-600" /><h2 className="text-lg font-bold text-gray-900">Define Custom Set Type</h2></div>
              <button onClick={() => setShowDefineType(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Set Type Name *</label>
                <input type="text" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="e.g. Outdoor Kiosk" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color Theme</label>
                <div className="flex gap-2">
                  {CUSTOM_COLORS.map((c, i) => (
                    <button key={i} type="button" onClick={() => setNewTypeColor(i)} title={c.label}
                      className={`w-8 h-8 rounded-full ${c.classes.header} border-4 transition-all ${newTypeColor === i ? 'border-gray-800 scale-110' : 'border-transparent'}`} />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(ICON_MAP).map(name => {
                    const Icon = ICON_MAP[name]
                    return (
                      <button key={name} type="button" onClick={() => setNewTypeIcon(name)} className={`p-2 rounded-lg border-2 ${newTypeIcon === name ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <Icon className="w-4 h-4 text-gray-600" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Components Required *</label>
                  <button type="button" onClick={() => setNewTypeComponents(p => [...p, { deviceType: '', label: '' }])} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {newTypeComponents.map((comp, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={comp.deviceType}
                        onChange={e => {
                          const found = ALL_KNOWN_DEVICE_TYPES.find(d => d.value === e.target.value)
                          setNewTypeComponents(p => p.map((c, idx) => idx === i ? { deviceType: e.target.value, label: found?.label || c.label } : c))
                        }}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
                        <option value="">Select device type</option>
                        {ALL_KNOWN_DEVICE_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <input type="text" value={comp.label} placeholder="Display label"
                        onChange={e => setNewTypeComponents(p => p.map((c, idx) => idx === i ? { ...c, label: e.target.value } : c))}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
                      {newTypeComponents.length > 1 && (
                        <button type="button" onClick={() => setNewTypeComponents(p => p.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Existing custom types */}
              {Object.keys(customSetTypes).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Saved Custom Types</label>
                  <div className="space-y-2">
                    {Object.entries(customSetTypes).map(([key, config]) => (
                      <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.colorClasses.card}`}>
                        <span className="text-sm font-medium flex-1">{config.label}</span>
                        <span className="text-xs text-gray-500">{config.deviceTypes.length} components</span>
                        <button type="button" onClick={() => handleDeleteCustomType(key)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {defineError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4" />{defineError}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button type="button" onClick={() => setShowDefineType(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm">Cancel</button>
              <button type="button" onClick={handleSaveCustomType} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium flex items-center justify-center gap-2 text-sm">
                <Save className="w-4 h-4" /> Save Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ SET DETAIL MODAL ════════════ */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowDetail(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div><h2 className="text-lg font-bold text-gray-900">{showDetail.code}</h2><p className="text-sm text-gray-500">{showDetail.setTypeName}</p></div>
              <button onClick={() => setShowDetail(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Code', value: showDetail.code },
                  { label: 'Barcode', value: showDetail.barcode, mono: true },
                  { label: 'Status', value: LIFECYCLE_STEP_LABELS[showDetail.lifecycleStatus] || showDetail.lifecycleStatus || 'In Warehouse' },
                  { label: 'Health', value: showDetail.healthStatus },
                  { label: 'Location', value: showDetail.location || '—' },
                  { label: 'Name', value: showDetail.name || '—' },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className={`font-medium text-gray-800 text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Package className="w-4 h-4" /> Components ({showDetail.components?.length || 0})</p>
                <div className="space-y-2">
                  {showDetail.components?.map(comp => (
                    <div key={comp.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{comp.code}</p>
                        <p className="text-xs text-gray-500">{comp.brand} {comp.model} · {comp.size || 'N/A'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getHealthStyle(comp.healthStatus)}`}>{getHealthLabel(comp.healthStatus)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100">
              <button onClick={() => { setShowSetBarcode(showDetail); setShowDetail(null) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg text-sm font-medium"><QrCode className="w-4 h-4" /> Barcode</button>
              {['available', 'warehouse', 'returned'].includes(showDetail?.lifecycleStatus)
                ? <button onClick={() => { setShowDisassemble(showDetail); setShowDetail(null) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg text-sm font-medium"><Wrench className="w-4 h-4" /> Disassemble</button>
                : <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 text-gray-400 bg-gray-50 rounded-lg text-sm font-medium cursor-not-allowed" title="Cannot disassemble — set is not in warehouse"><Wrench className="w-4 h-4" /> Disassemble</div>
              }
              <button onClick={() => handleDelete(showDetail)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium"><Trash2 className="w-4 h-4" /> Delete</button>
              <button onClick={() => setShowDetail(null)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ DISASSEMBLE MODAL ════════════ */}
      {showDisassemble && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-100 rounded-xl"><Wrench className="w-6 h-6 text-amber-600" /></div>
              <div><h3 className="text-lg font-bold text-gray-900">Disassemble Set</h3><p className="text-sm text-gray-500">{showDisassemble.code}</p></div>
            </div>
            <p className="text-sm text-gray-600 mb-5">All <strong>{showDisassemble.components?.length || 0} components</strong> will be returned to warehouse individually. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDisassemble(null)} disabled={disassembleLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 text-sm">Cancel</button>
              <button onClick={() => handleDisassemble(showDisassemble)} disabled={disassembleLoading} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {disassembleLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Wrench className="w-4 h-4" /> Disassemble</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

      {/* SET BARCODE MODAL */}
      {showSetBarcode && (
        <SetBarcodeGenerator
          set={showSetBarcode}
          onClose={() => setShowSetBarcode(null)}
        />
      )}
    </>
  )
}

export default Makesets