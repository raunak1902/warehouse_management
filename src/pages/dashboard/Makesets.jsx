import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Layers, Plus, Search, X, ChevronRight, Package, Monitor, Smartphone,
  LayoutGrid, Tv, Battery, Check, AlertTriangle, Trash2, RefreshCw,
  Info, Wrench, PackagePlus, ArrowRight, Box, Lightbulb, TrendingUp,
  CheckCircle, XCircle, Settings, Save, ChevronDown, ChevronUp, Mouse, Zap, QrCode, Link2, MapPin,
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { useCatalogue } from '../../context/CatalogueContext'
import { hasRole, ROLES } from '../../config/roles'
import { inventoryRequestApi } from '../../api/inventoryRequestApi'
import { setApi } from '../../api/setApi'
import { resolveTypeId, getTypeLabel, getCodePrefixForType, deviceMatchesSlot, getAllTypes, loadCustomTypes, getColorClasses } from '../../config/deviceTypeRegistry'
import SetBarcodeGenerator from '../../components/SetBarcodeGenerator'
import WarehouseLocationSelector from '../../components/WarehouseLocationSelector'
import MoveSetModal from '../../components/MoveSetModal'
import { History } from 'lucide-react'
import { 
  calculateSetHealth, 
  getComponentHealthSummary, 
  getProblematicComponents,
  getHealthDisplayInfo,
  normalizeHealth as normalizeHealthStatus 
} from '../../utils/setHealthUtils'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CUSTOM_SET_TYPES_KEY = 'edsignage_custom_set_types'

// ── Set types are now fully DB-driven via CatalogueContext ───────────────────
// BUILTIN_SET_TYPES removed — all set types (including builtins) live in the DB.
// This ensures edits in Catalogue are immediately reflected everywhere.

// Built from registry — canonical IDs and labels, plus any user-defined custom types
// Rebuilt reactively inside the component so new custom device types appear immediately
const getKnownDeviceTypes = () => getAllTypes().map(t => ({ value: t.id, label: t.label }))

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
  if (counts.length === 0) return null

  const sorted = [...counts].sort((a, b) => a.count - b.count)
  const min = sorted[0].count
  const max = sorted[sorted.length - 1].count

  if (max === 0) return null   // no stock at all — handled by red state
  if (min === max) return null // perfectly balanced

  // All components sitting at the minimum are bottlenecks
  const bottlenecks = counts.filter(c => c.count === min)

  // After fixing ONLY the bottlenecks (bringing them up to the next tier),
  // the new limiting factor becomes the second-lowest count.
  // That is the realistic set count achievable by this one action.
  const secondMin = sorted.find(c => c.count > min)?.count ?? max
  const addCount = secondMin - min

  // The highest-count component — shown in "fully using your N Xs"
  const highestItem = sorted[sorted.length - 1]

  return {
    min,
    max: secondMin,          // achievable sets after this single fix
    trueMax: max,            // stock ceiling if everything were balanced
    bottlenecks,
    addCount,
    highestLabel: highestItem?.label,
    isFullyBalanced: secondMin === max, // true if fixing bottleneck achieves full balance
  }
}

// ─── SET CODE HELPER ─────────────────────────────────────────────────────────
// Mirrors the backend getNextSetCode logic — used to show expected set code
// on make_set requests before the manager approves.
const getNextSetCodeLocal = (prefix, existingSets) => {
  const occupied = new Set()
  existingSets.forEach(s => {
    const code = (s.code || '').toUpperCase()
    if (code.startsWith(prefix.toUpperCase() + '-')) {
      const suffix = code.slice(prefix.length + 1)
      if (/^\d+$/.test(suffix)) occupied.add(parseInt(suffix, 10))
    }
  })
  let next = 1
  while (occupied.has(next)) next++
  return `${prefix.toUpperCase()}-${String(next).padStart(3, '0')}`
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const Makesets = ({ userRole } = {}) => {
  const { devices, refreshDevices } = useInventory()
  const navigate = useNavigate()

  // ── Catalogue context (DB-backed set types) ───────────────────────────────
  const { setTypes: catalogueSetTypes } = useCatalogue()

  // ── Role helpers ──────────────────────────────────────────────────────────
  const isGroundTeam = hasRole(userRole, ROLES.GROUNDTEAM)
  const isManager    = hasRole(userRole, ROLES.MANAGER, ROLES.SUPERADMIN)

  // ── Request submission state (ground team) ────────────────────────────────
  const [requestSuccess, setRequestSuccess] = useState('')
  const [requestError, setRequestError]     = useState('')

  const [searchParams] = useSearchParams()
  const urlLifecycle = searchParams.get('lifecycle') // e.g. 'return_initiated,return_transit'

  const [sets, setSets] = useState([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState('')

  const [customSetTypes, setCustomSetTypes] = useState(loadCustomSetTypes)

  // Purely DB-driven — catalogue edits reflect everywhere immediately.
  // Falls back to localStorage custom types only if DB hasn't loaded yet.
  const allSetTypes = useMemo(() => {
    if (catalogueSetTypes && catalogueSetTypes.length > 0) {
      const dbTypes = {}
      catalogueSetTypes.forEach(st => {
        // componentSlots shape from DB: [{ slotKey, label, deviceTypeId }]
        const slots = Array.isArray(st.componentSlots) ? st.componentSlots : []
        const deviceTypes = slots
          .map(s => s.deviceTypeId || s.deviceType || s.type)
          .filter(Boolean)
        const deviceLabels = Object.fromEntries(
          slots
            .map(s => [s.deviceTypeId || s.deviceType || s.type, s.label])
            .filter(([k]) => k)
        )
        dbTypes[st.setTypeId] = {
          label: st.label,
          icon: st.icon || 'Package',
          colorClasses: {
            badge:  `bg-${st.color || 'gray'}-100 text-${st.color || 'gray'}-700 border-${st.color || 'gray'}-200`,
            card:   `border-${st.color || 'gray'}-200 bg-${st.color || 'gray'}-50`,
            header: `bg-${st.color || 'gray'}-500`,
          },
          deviceTypes,
          deviceLabels,
          builtin: st.isBuiltin,
        }
      })
      // DB is authoritative — do NOT merge hardcoded builtins so edits are never shadowed
      return dbTypes
    }
    // DB not loaded yet — temporary fallback to localStorage custom types
    return customSetTypes
  }, [catalogueSetTypes, customSetTypes])

  // Reactive device type list — updates when Devices page adds a new custom device type
  const [allKnownDeviceTypes, setAllKnownDeviceTypes] = useState(getKnownDeviceTypes)
  useEffect(() => {
    const handler = () => setAllKnownDeviceTypes(getKnownDeviceTypes())
    window.addEventListener('device-types-updated', handler)
    return () => window.removeEventListener('device-types-updated', handler)
  }, [])

  const [search, setSearch] = useState('')
  const urlFilterType = searchParams.get('filterType')
  const [filterType, setFilterType] = useState(urlFilterType || 'all')
  const [filterHealth, setFilterHealth] = useState('all')
  const [showTipsPanel, setShowTipsPanel] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [showDisassemble, setShowDisassemble] = useState(null)
  const [showDefineType, setShowDefineType] = useState(false)

  const [selectedSetType, setSelectedSetType] = useState('')
  const [setName, setSetName] = useState('')
  const [selectedDevices, setSelectedDevices] = useState({})
  // Warehouse location for the new set
  const [createWarehouseId, setCreateWarehouseId]                     = useState(null)
  const [createWarehouseZone, setCreateWarehouseZone]                 = useState('')
  const [createWarehouseSpecificLocation, setCreateWarehouseSpecificLocation] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  const [disassembleLoading, setDisassembleLoading] = useState(false)
  const [disassembleReason, setDisassembleReason] = useState('')
  const [disassembleReasonErr, setDisassembleReasonErr] = useState(false)
  // Per-component location overrides for disassembly
  // Shape: { [deviceId]: { warehouseId, warehouseZone, warehouseSpecificLocation } }
  const [disassembleLocations, setDisassembleLocations] = useState({})
  const [disassembleShareLocation, setDisassembleShareLocation] = useState(true) // shared toggle
  // Shared location (used when toggle is ON)
  const [disassembleSharedWarehouseId, setDisassembleSharedWarehouseId]                     = useState(null)
  const [disassembleSharedZone, setDisassembleSharedZone]                                   = useState('')
  const [disassembleSharedSpecificLocation, setDisassembleSharedSpecificLocation]           = useState('')
  const [showSetBarcode, setShowSetBarcode] = useState(null) // set object to show barcode for
  const [expandedGroups, setExpandedGroups] = useState({}) // Track which lifecycle groups are expanded
  const [showMoveSet, setShowMoveSet] = useState(null) // set object to move

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
      const maxSets = counts.length > 0 ? Math.min(...counts.map(c => c.count)) : 0
      const tip = computeTip(config, getAvailableByType)
      result[key] = { counts, maxSets, tip }
    })
    return result
  }, [allSetTypes, getAvailableByType])

  // ── Filtered sets list with sorting
  const filteredSets = useMemo(() => {
    const lifecycleSteps = urlLifecycle ? urlLifecycle.split(',') : null
    return sets.filter(s => {
      const q = search.toLowerCase()
      return (
        (!q || s.code?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.barcode?.toLowerCase().includes(q) || s.setTypeName?.toLowerCase().includes(q)) &&
        (filterType === 'all' || s.setType === filterType) &&
        (filterHealth === 'all' || s.healthStatus === filterHealth) &&
        (!lifecycleSteps || lifecycleSteps.includes(s.lifecycleStatus))
      )
    })
  }, [sets, search, filterType, filterHealth, urlLifecycle])

  // ── Grouped and sorted sets by lifecycle stage
  const groupedSets = useMemo(() => {
    const groups = {
      warehouse: { label: '📦 In Warehouse', sets: [], order: 1, steps: ['available', 'warehouse', 'returned'] },
      assigning: { label: '🔄 Assigning / In Transit', sets: [], order: 2, steps: ['assigning','assign_requested','assigned','ready_to_deploy','deploy_requested','in_transit','received','installed'] },
      deployed: { label: '✅ Active / Deployed', sets: [], order: 3, steps: ['active', 'deployed', 'under_maintenance'] },
      returning: { label: '↩️ Return Process', sets: [], order: 4, steps: ['return_initiated', 'return_requested', 'return_transit'] },
      other: { label: '⚠️ Other Status', sets: [], order: 5, steps: [] },
    }

    // Categorize sets into groups
    filteredSets.forEach(set => {
      const lifecycle = set.lifecycleStatus || 'available'
      let assigned = false
      for (const [key, group] of Object.entries(groups)) {
        if (group.steps.includes(lifecycle)) {
          group.sets.push(set)
          assigned = true
          break
        }
      }
      if (!assigned) groups.other.sets.push(set)
    })

    // Sort sets within each group: by setType, then by code
    Object.values(groups).forEach(group => {
      group.sets.sort((a, b) => {
        // Primary: setType
        const typeA = a.setType || ''
        const typeB = b.setType || ''
        if (typeA !== typeB) return typeA.localeCompare(typeB)
        // Secondary: code
        return (a.code || '').localeCompare(b.code || '')
      })
    })

    // Return only non-empty groups in order
    return Object.values(groups)
      .filter(g => g.sets.length > 0)
      .sort((a, b) => a.order - b.order)
  }, [filteredSets])

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

  // ── Create set (role-aware)
  const handleCreate = async () => {
    setCreateError('')
    setRequestSuccess('')
    setRequestError('')
    const config = allSetTypes[selectedSetType]
    if (!config) return setCreateError('Select a set type.')
    const componentDeviceIds = Object.values(selectedDevices).filter(Boolean).map(Number)
    if (componentDeviceIds.length !== config.deviceTypes.length)
      return setCreateError('Please select one device for each component.')
    if (!createWarehouseId)
      return setCreateError('Please select a warehouse location for this set.')

    setCreateLoading(true)
    try {
      if (isGroundTeam) {
        const setTypeConfig = catalogueSetTypes.find(st => st.setTypeId === selectedSetType)
        const setPrefix = setTypeConfig?.prefix || selectedSetType.toUpperCase()
        const expectedSetCode = getNextSetCodeLocal(setPrefix, sets)
        await inventoryRequestApi.requestMakeSet({
          setTypeId: selectedSetType,
          setTypeName: config.label,
          setName: setName || undefined,
          reservedDeviceIds: componentDeviceIds,
          expectedCodeRange: expectedSetCode,
          warehouseId: createWarehouseId,
          warehouseZone: createWarehouseZone || undefined,
          warehouseSpecificLocation: createWarehouseSpecificLocation || undefined,
        })
        setCreateSuccess(true)
        setTimeout(() => { setShowCreate(false); resetCreateForm(); setCreateSuccess(false); setRequestSuccess('Set creation request submitted! A manager will review it shortly.') }, 2000)
      } else {
        // Manager: direct create
        const newSet = await setApi.create({
          setType: selectedSetType,
          setTypeName: config.label,
          name: setName || undefined,
          componentDeviceIds,
          warehouseId: createWarehouseId,
          warehouseZone: createWarehouseZone || undefined,
          warehouseSpecificLocation: createWarehouseSpecificLocation || undefined,
        })
        await Promise.all([fetchSets(), refreshDevices()])
        setShowCreate(false); resetCreateForm()
        setShowSetBarcode(newSet)
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed.'
      if (isGroundTeam) setRequestError(msg)
      else setCreateError(msg)
    } finally { setCreateLoading(false) }
  }

  const resetCreateForm = () => {
    setSelectedSetType(''); setSetName(''); setSelectedDevices({})
    setCreateWarehouseId(null); setCreateWarehouseZone(''); setCreateWarehouseSpecificLocation('')
    setCreateError(''); setCreateSuccess(false)
  }

  // ── Disassemble (no delete)
  const handleDisassemble = async (set) => {
    if (!disassembleReason.trim()) { setDisassembleReasonErr(true); return }
    setDisassembleReasonErr(false)
    setDisassembleLoading(true)

    // Build component locations array
    const componentLocations = (set.components || []).map(comp => {
      if (disassembleShareLocation) {
        // All components go to the shared location
        return {
          deviceId: comp.id,
          warehouseId: disassembleSharedWarehouseId,
          warehouseZone: disassembleSharedZone || null,
          warehouseSpecificLocation: disassembleSharedSpecificLocation || null,
        }
      }
      // Per-component override, or fall back to preSet snapshot (backend handles null as fallback)
      const loc = disassembleLocations[comp.id] || {}
      return {
        deviceId: comp.id,
        warehouseId: loc.warehouseId ?? null,
        warehouseZone: loc.warehouseZone ?? null,
        warehouseSpecificLocation: loc.warehouseSpecificLocation ?? null,
      }
    })

    try {
      if (isGroundTeam) {
        await inventoryRequestApi.requestBreakSet(set.id, disassembleReason.trim(), componentLocations)
        setShowDisassemble(null)
        setDisassembleReason('')
        resetDisassembleLocations()
        setRequestSuccess('Break set request submitted! A manager will review it shortly.')
      } else {
        await setApi.disassemble(set.id, [], disassembleReason.trim(), componentLocations)
        await Promise.all([fetchSets(), refreshDevices()])
        setShowDisassemble(null)
        setDisassembleReason('')
        resetDisassembleLocations()
      }
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Failed.')
    } finally { setDisassembleLoading(false) }
  }

  const resetDisassembleLocations = () => {
    setDisassembleLocations({})
    setDisassembleShareLocation(true)
    setDisassembleSharedWarehouseId(null)
    setDisassembleSharedZone('')
    setDisassembleSharedSpecificLocation('')
  }

  // When the disassemble modal opens, pre-fill shared location from the set's current location
  const openDisassemble = (set) => {
    setDisassembleReason('')
    setDisassembleReasonErr(false)
    setDisassembleShareLocation(true)
    // Pre-fill shared selector with the set's current warehouse location
    setDisassembleSharedWarehouseId(set.warehouseId || null)
    setDisassembleSharedZone(set.warehouseZone || '')
    setDisassembleSharedSpecificLocation(set.warehouseSpecificLocation || '')
    // Pre-fill per-component from each device's preSet snapshot
    const perComp = {}
    ;(set.components || []).forEach(comp => {
      perComp[comp.id] = {
        warehouseId: comp.preSetWarehouseId || null,
        warehouseZone: comp.preSetWarehouseZone || '',
        warehouseSpecificLocation: comp.preSetWarehouseSpecificLocation || '',
      }
    })
    setDisassembleLocations(perComp)
    setShowDisassemble(set)
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
    window.dispatchEvent(new CustomEvent('set-types-updated'))
    setShowDefineType(false); setNewTypeName(''); setNewTypeComponents([{ deviceType: '', label: '' }]); setDefineError('')
  }

  const handleDeleteCustomType = (key) => {
    if (!window.confirm('Remove this custom set type?')) return
    const updated = { ...customSetTypes }; delete updated[key]
    setCustomSetTypes(updated); saveCustomSetTypes(updated)
    window.dispatchEvent(new CustomEvent('set-types-updated'))
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
          <button
            onClick={() => navigate('/dashboard/set-history')}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium"
          >
            <History className="w-4 h-4" /> Set History
          </button>
          {isManager && (
            <button onClick={() => setShowDefineType(true)} className="flex items-center gap-2 px-3 py-2 border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg text-sm font-medium">
              <Settings className="w-4 h-4" /> Define Set Type
            </button>
          )}
          <button onClick={() => { resetCreateForm(); refreshDevices(); setShowCreate(true) }} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium text-sm shadow-sm">
            <Plus className="w-4 h-4" /> {isGroundTeam ? 'Request Set' : 'Create Set'}
          </button>
        </div>
      </div>

      {/* Request feedback banners */}
      {requestSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span className="flex-1">{requestSuccess}</span>
          <button onClick={() => setRequestSuccess('')} className="p-1 hover:bg-emerald-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}
      {requestError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="flex-1">{requestError}</span>
          <button onClick={() => setRequestError('')} className="p-1 hover:bg-red-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

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
                          <strong>{tip.max} sets</strong>
                          {!tip.isFullyBalanced && <span className="font-normal"> (then balance remaining stock for {tip.trueMax} total)</span>}
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

      {/* Sets list - Grouped by lifecycle */}
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
          <button onClick={() => { resetCreateForm(); refreshDevices(); setShowCreate(true) }} className="mt-1 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Set
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSets.map((group, groupIdx) => {
            const groupKey = `group-${groupIdx}`
            const isExpanded = expandedGroups[groupKey] !== false // Default to expanded
            return (
              <div key={groupIdx} className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
                {/* Group Header */}
                <button 
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-150 border-b border-gray-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-800">{group.label}</span>
                    <span className="px-2.5 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full border border-violet-200">
                      {group.sets.length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>

                {/* Group Content */}
                {isExpanded && (
                  <div className="p-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.sets.map(set => {
                      const config = allSetTypes[set.setType]
                      const Icon = getIcon(config?.icon)
                      
                      // Calculate actual set health from components
                      const calculatedHealth = calculateSetHealth(set.components)
                      const healthInfo = getHealthDisplayInfo(calculatedHealth)
                      const healthSummary = getComponentHealthSummary(set.components)
                      const problematicComponents = getProblematicComponents(set.components)
                      const totalComps = set.components?.length || 0

                      // Check for health mismatch (backend vs calculated)
                      const healthMismatch = set.healthStatus !== calculatedHealth

                      return (
                        <div 
                          key={set.id} 
                          className={`bg-white rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer group relative
                            ${calculatedHealth === 'damage' ? 'border-2 border-red-300' : 
                              calculatedHealth === 'repair' ? 'border-2 border-amber-300' : 
                              calculatedHealth === 'lost' ? 'border-2 border-gray-300' : 
                              'border border-gray-200 hover:border-violet-300'}`}
                          onClick={() => setShowSetBarcode(set)}
                        >
                          {/* Health mismatch indicator (for debugging) */}
                          {healthMismatch && (
                            <div className="absolute -top-2 -right-2 w-4 h-4 bg-orange-500 rounded-full border-2 border-white" 
                              title={`Health mismatch: DB shows ${set.healthStatus}, calculated ${calculatedHealth}`} />
                          )}
                          
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-lg ${config?.colorClasses?.card || 'bg-gray-100'}`}>
                                <Icon className="w-5 h-5 text-gray-700" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm font-mono">{set.code}</p>
                                <p className="text-xs text-gray-500">{set.setTypeName}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-600 group-hover:translate-x-1 transition-all mt-1" />
                          </div>
                          
                          {set.name && <p className="text-sm text-gray-700 font-medium mb-2 truncate">{set.name}</p>}
                          
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {/* Use calculated health, not DB health */}
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${healthInfo.badge}`}>
                              {healthInfo.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LIFECYCLE_STYLES[set.lifecycleStatus] || LIFECYCLE_STYLES.available}`}>
                              {LIFECYCLE_STEP_LABELS[set.lifecycleStatus] || set.lifecycleStatus || 'In Warehouse'}
                            </span>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Package className="w-3.5 h-3.5" />
                              <span>{totalComps} components</span>
                            </div>
                            {/* Warehouse location breadcrumb */}
                            {(() => {
                              const parts = [
                                set.warehouse?.name || (set.warehouseId ? `WH #${set.warehouseId}` : null),
                                set.warehouseZone,
                                set.warehouseSpecificLocation,
                              ].filter(Boolean)
                              return parts.length > 0 ? (
                                <div className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {parts.map((p, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                      {i > 0 && <span className="text-gray-300">›</span>}
                                      <span>{p}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : null
                            })()}
                            
                            {/* Component Health Summary */}
                            {totalComps > 0 && (
                              <div className="flex items-center gap-2 text-[10px] font-medium">
                                {healthSummary.ok > 0 && (
                                  <span className="text-emerald-600 flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> {healthSummary.ok}
                                  </span>
                                )}
                                {healthSummary.repair > 0 && (
                                  <span className="text-amber-600 flex items-center gap-0.5">
                                    <Wrench className="w-3 h-3" /> {healthSummary.repair}
                                  </span>
                                )}
                                {healthSummary.damage > 0 && (
                                  <span className="text-red-600 flex items-center gap-0.5">
                                    <AlertTriangle className="w-3 h-3" /> {healthSummary.damage}
                                  </span>
                                )}
                                {healthSummary.lost > 0 && (
                                  <span className="text-gray-600 flex items-center gap-0.5">
                                    <XCircle className="w-3 h-3" /> {healthSummary.lost} lost
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Warning for problematic components */}
                            {problematicComponents.length > 0 && (
                              <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                {problematicComponents.length} component{problematicComponents.length > 1 ? 's' : ''} need{problematicComponents.length === 1 ? 's' : ''} attention
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
                                Add <strong>{tip.addCount} {tip.bottlenecks.map(b => b.label).join(' / ')}</strong> → unlock <strong>{tip.max} sets</strong>{!tip.isFullyBalanced && ` (${tip.trueMax} possible if fully balanced)`}
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
                        const softLocked = available.filter(d => d.lifecycleStatus === 'pending_set_assignment')
                        // Also exclude devices already picked in another slot of this same form
                        const pickedElsewhere = new Set(
                          Object.entries(selectedDevices)
                            .filter(([k, v]) => k !== devType && v)
                            .map(([, v]) => Number(v))
                        )
                        const selectable = available.filter(d =>
                          d.lifecycleStatus !== 'pending_set_assignment' && !pickedElsewhere.has(d.id)
                        )
                        return (
                          <div key={devType} className={`border rounded-xl p-3 ${selectedDevices[devType] ? 'border-violet-300 bg-violet-50' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-700">{config.deviceLabels[devType]}</span>
                              <span className={`ml-auto text-xs font-semibold ${selectable.length === 0 ? 'text-red-600' : 'text-emerald-600'}`}>{selectable.length} available</span>
                              {softLocked.length > 0 && <span className="text-xs text-indigo-600">{softLocked.length} pending</span>}
                            </div>
                            {selectable.length === 0 ? (
                              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200">⚠ No {config.deviceLabels[devType]} available in warehouse</p>
                            ) : (
                              <select value={selectedDevices[devType] || ''} onChange={e => setSelectedDevices(prev => ({ ...prev, [devType]: e.target.value }))}
                                className={`w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 ${!selectedDevices[devType] ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                                <option value="">Select {config.deviceLabels[devType]} *</option>
                                {selectable.map(d => <option key={d.id} value={d.id}>{d.code} — {d.brand} {d.model} ({d.size || 'N/A'})</option>)}
                              </select>
                            )}
                            {softLocked.length > 0 && (
                              <p className="mt-1 text-[10px] text-indigo-600">
                                {softLocked.length} device{softLocked.length > 1 ? 's' : ''} hidden — pending set assignment approval
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Step 4: warehouse location */}
              {selectedSetType && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-violet-500" />
                    Step 4 — Warehouse Location <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-violet-200 rounded-xl p-3 bg-violet-50/40">
                    <p className="text-xs text-violet-700 mb-3 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      All components will be assigned this location. Each component's current location is saved so it can be restored when the set is disassembled.
                    </p>
                    <WarehouseLocationSelector
                      warehouseId={createWarehouseId}
                      zone={createWarehouseZone}
                      specificLocation={createWarehouseSpecificLocation}
                      onWarehouseChange={setCreateWarehouseId}
                      onZoneChange={setCreateWarehouseZone}
                      onSpecificLocationChange={setCreateWarehouseSpecificLocation}
                      required={true}
                    />
                  </div>
                </div>
              )}

              {createSuccess && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-base font-bold text-gray-800">Request Submitted!</p>
                  <p className="text-sm text-gray-500">A manager will review and approve your set creation request shortly.</p>
                </div>
              )}

              {!createSuccess && createError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{createError}
                </div>
              )}
            </div>

            {!createSuccess && (
              <div className="flex gap-3 p-5 border-t border-gray-100">
                <button type="button" onClick={() => { setShowCreate(false); resetCreateForm() }} disabled={createLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 text-sm">Cancel</button>
                <button type="button" onClick={handleCreate} disabled={createLoading || !selectedSetType} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                  {createLoading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {isGroundTeam ? 'Submitting...' : 'Creating...'}</>
                    : <><PackagePlus className="w-4 h-4" /> {isGroundTeam ? 'Submit Request' : 'Create Set'}</>}
                </button>
              </div>
            )}
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
                          const found = allKnownDeviceTypes.find(d => d.value === e.target.value)
                          setNewTypeComponents(p => p.map((c, idx) => idx === i ? { deviceType: e.target.value, label: found?.label || c.label } : c))
                        }}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
                        <option value="">Select device type</option>
                        {allKnownDeviceTypes.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
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


      {/* ════════════ DISASSEMBLE MODAL ════════════ */}
      {showDisassemble && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 p-5 border-b border-gray-100">
              <div className="p-2.5 bg-amber-100 rounded-xl"><Wrench className="w-6 h-6 text-amber-600" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Disassemble Set</h3>
                <p className="text-sm text-gray-500">{showDisassemble.code} · {showDisassemble.components?.length || 0} components</p>
              </div>
              <button onClick={() => { setShowDisassemble(null); setDisassembleReason(''); setDisassembleReasonErr(false); resetDisassembleLocations() }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <p className="text-sm text-gray-600">All <strong>{showDisassemble.components?.length || 0} components</strong> will be returned to warehouse individually. This cannot be undone.</p>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reason for disassembly <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client returned set, upgrading to larger model, components needed elsewhere…"
                  value={disassembleReason}
                  onChange={e => { setDisassembleReason(e.target.value); if (e.target.value.trim()) setDisassembleReasonErr(false) }}
                  className={`w-full text-sm rounded-lg border px-3 py-2 resize-none focus:outline-none focus:ring-2 transition-colors ${
                    disassembleReasonErr
                      ? 'border-red-400 focus:ring-red-200 bg-red-50'
                      : 'border-gray-300 focus:ring-amber-200 focus:border-amber-400'
                  }`}
                />
                {disassembleReasonErr && (
                  <p className="text-xs text-red-600 mt-1">A reason is required before disassembling.</p>
                )}
              </div>

              {/* Location section */}
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">Component Return Locations</span>
                  </div>
                  {/* Shared / Individual toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-700">Individual</span>
                    <button
                      type="button"
                      onClick={() => setDisassembleShareLocation(v => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${disassembleShareLocation ? 'bg-amber-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${disassembleShareLocation ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-amber-700">All same</span>
                  </div>
                </div>

                <div className="p-4">
                  {disassembleShareLocation ? (
                    /* ── Shared location ── */
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        All components will go to the same location. Pre-filled with the set's current location.
                      </p>
                      <WarehouseLocationSelector
                        warehouseId={disassembleSharedWarehouseId}
                        zone={disassembleSharedZone}
                        specificLocation={disassembleSharedSpecificLocation}
                        onWarehouseChange={setDisassembleSharedWarehouseId}
                        onZoneChange={setDisassembleSharedZone}
                        onSpecificLocationChange={setDisassembleSharedSpecificLocation}
                        required={false}
                      />
                    </div>
                  ) : (
                    /* ── Per-component location ── */
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">
                        Each component is pre-filled with its location <em>before</em> the set was created. Override as needed.
                      </p>
                      {(showDisassemble.components || []).map(comp => {
                        const loc = disassembleLocations[comp.id] || {}
                        return (
                          <div key={comp.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-gray-500" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 font-mono">{comp.code}</p>
                                <p className="text-xs text-gray-400">{comp.brand} {comp.model}</p>
                              </div>
                              {/* Show preSet snapshot as a hint */}
                              {comp.preSetWarehouseId && (
                                <span className="ml-auto text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                  Pre-set location loaded
                                </span>
                              )}
                            </div>
                            <WarehouseLocationSelector
                              warehouseId={loc.warehouseId ?? null}
                              zone={loc.warehouseZone ?? ''}
                              specificLocation={loc.warehouseSpecificLocation ?? ''}
                              onWarehouseChange={val => setDisassembleLocations(prev => ({ ...prev, [comp.id]: { ...prev[comp.id], warehouseId: val, warehouseZone: '' } }))}
                              onZoneChange={val => setDisassembleLocations(prev => ({ ...prev, [comp.id]: { ...prev[comp.id], warehouseZone: val } }))}
                              onSpecificLocationChange={val => setDisassembleLocations(prev => ({ ...prev, [comp.id]: { ...prev[comp.id], warehouseSpecificLocation: val } }))}
                              required={false}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => { setShowDisassemble(null); setDisassembleReason(''); setDisassembleReasonErr(false); resetDisassembleLocations() }} disabled={disassembleLoading} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 text-sm">Cancel</button>
              <button onClick={() => handleDisassemble(showDisassemble)} disabled={disassembleLoading} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {disassembleLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Wrench className="w-4 h-4" /> {isGroundTeam ? 'Submit Request' : 'Disassemble'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

      {/* MOVE SET MODAL */}
      {showMoveSet && (
        <MoveSetModal
          set={showMoveSet}
          onSuccess={async (updatedSet) => {
            // Update the set in local state so the card refreshes immediately
            setSets(prev => prev.map(s => s.id === updatedSet.id ? { ...s, ...updatedSet } : s))
            await refreshDevices()
          }}
          onClose={() => setShowMoveSet(null)}
        />
      )}

      {/* SET BARCODE MODAL */}
      {showSetBarcode && (
        <SetBarcodeGenerator
          key={showSetBarcode.barcode || showSetBarcode.id}
          set={showSetBarcode}
          onClose={() => setShowSetBarcode(null)}
        />
      )}
    </>
  )
}

export default Makesets