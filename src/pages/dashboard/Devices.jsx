import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone,
  LayoutGrid,
  Monitor,
  Tablet as TabletIcon,
  Tv,
  Search,
  ChevronRight,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  QrCode,
  X,
  Plus,
  Filter,
  MapPin,
  Tag,
  Ruler,
  Box,
  Package,
  Truck,
  Link2,
  Layers,
  Battery,
  Check,
  ChevronDown,
  Info,
  ScanBarcode,
  Camera,
  Warehouse,
  ArrowRight,
  PackagePlus,
  ShieldCheck,
  Mouse,
  Zap,
} from 'lucide-react'
import {
  useInventory,
  getDeviceLifecycleStatus,
  getSubscriptionFilterStatus,
  getSubscriptionStatus,
  LIFECYCLE_LABELS,
  LIFECYCLE_COLORS,
} from '../../context/InventoryContext'
import {
  ALL_PRODUCT_TYPES,
  PRODUCT_TYPES,
  getSizesForProductType,
  getBrandsForProductType,
  getCodePrefix,
  DEVICE_COLORS,
  getIndianLocationHierarchyForFilter,
  normalizeCode,
  getNextAutoCode,
  validateDeviceCode,
  DEVICE_HEALTH_STATUS,
} from '../../config/deviceConfig'
import {
  getAllTypes,
  resolveTypeId,
  getTypeLabel,
  getColorClasses,
} from '../../config/deviceTypeRegistry'
import BarcodeScanner from '../../components/BarcodeScanner'
import BarcodeResultCard from '../../components/BarcodeResultCard'
import BulkBarcodeGenerator from '../../components/BulkBarcodeGenerator'
import DeviceTimeline from '../../components/DeviceTimeline'
import LifecycleActionModal from '../../components/LifecycleActionModal'

// Normalize legacy health status values to canonical ones used throughout the system.
// Ground team requests may have written 'damaged', 'needs_repair', 'critical' into the DB.
const normalizeHealth = (v) => {
  if (!v) return 'ok'
  const map = { damaged: 'damage', needs_repair: 'repair', critical: 'damage' }
  return map[v] ?? v
}

const HEALTH_STYLE = {
  ok:     { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: '✓ OK' },
  repair: { badge: 'bg-amber-100   text-amber-800   border-amber-200',   label: '🔧 Repair' },
  damage: { badge: 'bg-red-100     text-red-800     border-red-200',     label: '⚠ Damage' },
}
const getHealthStyle = (raw) => HEALTH_STYLE[normalizeHealth(raw)] ?? HEALTH_STYLE.ok

const LIFECYCLE_OPTIONS = [
  { value: 'all', label: 'All Devices', icon: Layers, desc: 'View all devices in system' },
  { value: 'deployed', label: 'Deployed', icon: Truck, desc: 'In use by client at location' },
  { value: 'assigning', label: 'Assigning', icon: Link2, desc: 'Ordered, not yet deployed' },
  { value: 'warehouse', label: 'In Warehouse', icon: Package, desc: 'In Warehouse A, B or C' },
]

const PRODUCT_TYPE_ICONS = {
  tv: Tv,
  TV: Tv,
  tablet: TabletIcon,
  TAB: TabletIcon,
  'touch-tv': Tv,
  TTV: Tv,
  'a-stand': LayoutGrid,
  AST: LayoutGrid,
  'i-stand': Monitor,
  IST: Monitor,
  'tablet-stand': TabletIcon,
  TST: TabletIcon,
  stand: LayoutGrid,
  istand: Monitor,
  MB: Box,
  BAT: Battery,
  MSE: Mouse,
  W: Zap,
}

// SET TYPES CONFIG
// deviceType values use canonical forms (from deviceConfig.js) to match any variation:
// - 'stand' matches: "stand", "a-stand", "A stand", "A-Frame Stand", etc.
// - 'istand' matches: "istand", "i-stand", "I stand", "I-Frame Stand", etc.
// - 'mediaBox' matches: "mediaBox", "Media Box", "MB", etc.
// - 'battery' matches: "battery", "Battery Pack", etc.
// - 'fabrication' matches: "fabrication", "Tablet Stand", etc.
const SET_TYPES = {
  aStand: {
    label: 'A-Frame Standee',
    icon: LayoutGrid,
    color: 'orange',
    components: [
      { key: 'stand', label: 'A-Frame Stand', icon: LayoutGrid, inventoryKey: 'aFrameStands', deviceType: 'stand' },
      { key: 'tv', label: 'TV (43" or larger)', icon: Monitor, inventoryKey: 'tvs', deviceType: 'tv' },
      { key: 'mediaBox', label: 'Media Box', icon: Tv, inventoryKey: 'mediaBoxes', deviceType: 'mediaBox' },
    ]
  },
  iStand: {
    label: 'I-Frame Standee',
    icon: Monitor,
    color: 'blue',
    components: [
      { key: 'stand', label: 'I-Frame Stand', icon: Monitor, inventoryKey: 'iFrameStands', deviceType: 'istand' },
      { key: 'tv', label: 'TV (43" or larger)', icon: Monitor, inventoryKey: 'tvs', deviceType: 'tv' },
      { key: 'mediaBox', label: 'Media Box', icon: Tv, inventoryKey: 'mediaBoxes', deviceType: 'mediaBox' },
    ]
  },
  tabletCombo: {
    label: 'Tablet Combo',
    icon: Smartphone,
    color: 'purple',
    components: [
      { key: 'tablet', label: 'Tablet', icon: Smartphone, inventoryKey: 'tablets', deviceType: 'tablet' },
      { key: 'battery', label: 'Battery', icon: Battery, inventoryKey: 'batteries', deviceType: 'battery' },
      { key: 'fabrication', label: 'Tablet Stand (Fabrication)', icon: LayoutGrid, inventoryKey: 'fabricationTablet', deviceType: 'fabrication' },
    ]
  }
}

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  upcoming: 'bg-sky-100 text-sky-800 border-sky-200',
  warehouse: 'bg-slate-100 text-slate-800 border-slate-200',
}

function getDeviceTypeLabel(type) {
  // Registry resolves any type string (legacy or canonical) to a display label
  return getTypeLabel(type) || type || '—'
}

const Devices = () => {
  const navigate = useNavigate()
  const {
    devices,
    clients,
    getClientById,
    getDevicesByType,
    getUniqueDeviceFilterOptions,
    addDevice,
    bulkAddDevices,
    componentInventory,
    deviceSets,
    createDeviceSet,
    deleteDeviceSet,
    getAvailableDevicesForComponent,
  } = useInventory()

  // ── Pending lifecycle requests map: deviceId → true ──────────────────────
  // Fetched once on mount and whenever devices change, so the 🕐 badge is
  // always current without polling.
  const [pendingDeviceIds, setPendingDeviceIds] = useState(new Set())

  useEffect(() => {
    if (!devices.length) return
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    fetch('/api/lifecycle-requests?status=pending', { headers })
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const ids = new Set(rows.filter(r => r.deviceId).map(r => r.deviceId))
        setPendingDeviceIds(ids)
      })
      .catch(() => {})
  }, [devices])

  const [lifecycleFilter, setLifecycleFilter] = useState('all')
  const [selectedType, setSelectedType] = useState(null)
  const [searchCode, setSearchCode] = useState('')
  const [detailDevice, setDetailDevice] = useState(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState('devices')
  
  // Make Set modal state
  const [showMakeSetModal, setShowMakeSetModal] = useState(false)
  const [selectedSetType, setSelectedSetType] = useState(null)
  const [selectedComponents, setSelectedComponents] = useState({})
  const [setName, setSetName] = useState('')
  const [expandedSet, setExpandedSet] = useState(null)
  
  // Lifecycle timeline expand state: deviceId → true/false
  const [expandedTimeline, setExpandedTimeline] = useState(null) // device.id or `set-${setId}`
  // Lifecycle action modal
  const [lifecycleActionDevice, setLifecycleActionDevice] = useState(null)
  
  // Barcode Scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)

  // Bulk Add state
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [bulkQty, setBulkQty] = useState(10)
  const [bulkProductType, setBulkProductType] = useState('tv')
  const [bulkBrand, setBulkBrand] = useState('')
  const [bulkSize, setBulkSize] = useState('')
  const [bulkColor, setBulkColor] = useState('')
  const [bulkModel, setBulkModel] = useState('')
  const [bulkMfgDate, setBulkMfgDate] = useState('')
  const [bulkInDate, setBulkInDate] = useState('')
  const [bulkHealth, setBulkHealth] = useState('ok')
  const [bulkLifecycleStatus, setBulkLifecycleStatus] = useState('warehouse')
  const [bulkAdding, setBulkAdding] = useState(false)
  const [bulkAddProgress, setBulkAddProgress] = useState(0)
  const [showBulkBarcodes, setShowBulkBarcodes] = useState(false)
  const [bulkCreatedDevices, setBulkCreatedDevices] = useState([])

  // NEW: Barcode Generator state
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [selectedDeviceForBarcode, setSelectedDeviceForBarcode] = useState(null)

  // Filters
  const [filterClientId, setFilterClientId] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterPinpoint, setFilterPinpoint] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterModel, setFilterModel] = useState('')

  // Add device form state
  const [newProductType, setNewProductType] = useState('tv')
  const [newBrand, setNewBrand] = useState('')
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')
  const [newGpsId, setNewGpsId] = useState('')
  const [newMfgDate, setNewMfgDate] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newDeviceCode, setNewDeviceCode] = useState('')
  const [newLifecycleStatus, setNewLifecycleStatus] = useState('warehouse')
  const [newHealth, setNewHealth] = useState('ok')
  const [newInDate, setNewInDate] = useState('')
  // Custom product types (user-defined, stored in localStorage)
  const [customProductTypes, setCustomProductTypes] = useState(() => { try { return JSON.parse(localStorage.getItem('customProductTypes') || '[]') } catch { return [] } })
  const [showAddTypeModal, setShowAddTypeModal] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeCode, setNewTypeCode] = useState('')
  // Custom brands/colors/sizes
  const [customBrands, setCustomBrands] = useState(() => { try { return JSON.parse(localStorage.getItem('customBrands') || '[]') } catch { return [] } })
  const [showAddBrand, setShowAddBrand] = useState(false)
  const [newBrandInput, setNewBrandInput] = useState('')
  const [customColors, setCustomColors] = useState(() => { try { return JSON.parse(localStorage.getItem('customColors') || '[]') } catch { return [] } })
  const [showAddColor, setShowAddColor] = useState(false)
  const [newColorInput, setNewColorInput] = useState('')
  const [showCustomSize, setShowCustomSize] = useState(false)
  const [customSizeInput, setCustomSizeInput] = useState('')
  // Bulk custom fields
  const [showBulkAddBrand, setShowBulkAddBrand] = useState(false)
  const [bulkNewBrandInput, setBulkNewBrandInput] = useState('')
  const [showBulkAddColor, setShowBulkAddColor] = useState(false)
  const [bulkNewColorInput, setBulkNewColorInput] = useState('')
  const [showBulkCustomSize, setShowBulkCustomSize] = useState(false)
  const [bulkCustomSizeInput, setBulkCustomSizeInput] = useState('')
  const [addingDevice, setAddingDevice] = useState(false)
  // NEW: Whether the user has unlocked manual code editing
  const [codeEditMode, setCodeEditMode] = useState(false)

  const filterOptions = useMemo(() => getUniqueDeviceFilterOptions(), [getUniqueDeviceFilterOptions])
  const locationHierarchy = useMemo(() => getIndianLocationHierarchyForFilter(), [])

  const sizesForNewProduct = useMemo(() => getSizesForProductType(newProductType), [newProductType])
  const brandsForNewProduct = useMemo(() => getBrandsForProductType(newProductType), [newProductType])

  // Auto-computed next code for the selected product type (TV-1 = TV-001 are the same, normalized)
  // For custom types like 'custom-MSE', prefix is 'MSE'
  const getEffectivePrefix = (type) => {
    if (type && type.startsWith('custom-')) return type.replace('custom-', '').toUpperCase()
    return getCodePrefix(type)
  }
  const suggestedCode = useMemo(() => {
    const prefix = getEffectivePrefix(newProductType)
    const existing = devices.filter(d => d.code && d.code.toUpperCase().startsWith(prefix + '-'))
    const occupied = new Set(existing.map(d => {
      const s = d.code.toUpperCase().slice(prefix.length + 1)
      return /^\d+$/.test(s) ? parseInt(s, 10) : 0
    }).filter(n => n > 0))
    // Find first available number (fills gaps, same logic as bulk add)
    let next = 1
    while (occupied.has(next)) next++
    return `${prefix}-${String(next).padStart(3, '0')}`
  }, [devices, newProductType])

  // The effective code that will be used — auto-assigned unless user unlocked edit mode
  const effectiveCode = codeEditMode ? newDeviceCode.trim() : suggestedCode

  const codeValidation = useMemo(() => {
    if (!effectiveCode) return { valid: false, error: 'Code is required.' }
    if (newProductType && newProductType.startsWith('custom-')) {
      const isDup = devices.some(d => d.code && d.code.toUpperCase() === effectiveCode.toUpperCase())
      return isDup ? { valid: false, error: 'This code already exists.' } : { valid: true, error: null }
    }
    return validateDeviceCode(effectiveCode, newProductType, devices)
  }, [effectiveCode, newProductType, devices])

  const getDevicesForLifecycle = (list) => {
    if (lifecycleFilter === 'all') return list
    return list.filter((d) => getDeviceLifecycleStatus(d) === lifecycleFilter)
  }

  const filteredDevices = useMemo(() => {
    let list = selectedType
      // Filter by canonical type ID — resolveTypeId maps any legacy type string to the ID
      ? devices.filter(d => resolveTypeId(d.type) === selectedType || d.type === selectedType)
      : devices
    list = getDevicesForLifecycle(list)
    if (lifecycleFilter !== 'warehouse' && filterClientId) list = list.filter((d) => d.clientId === Number(filterClientId))
    if (filterState === 'Warehouse') {
      list = list.filter((d) => !(d.state || '').trim() && (d.location || ''))
      if (filterPinpoint) list = list.filter((d) => (d.location || '') === filterPinpoint)
    } else if (filterState) {
      list = list.filter((d) => (d.state || '') === filterState)
      if (filterDistrict) list = list.filter((d) => (d.district || '') === filterDistrict)
      if (filterPinpoint) list = list.filter((d) => (d.location || '') === filterPinpoint)
    }
    if (filterBrand) list = list.filter((d) => (d.brand || '') === filterBrand)
    if (filterSize) list = list.filter((d) => (d.size || '') === filterSize)
    if (filterModel) list = list.filter((d) => (d.model || '').toLowerCase().includes(filterModel.toLowerCase()))
    if (searchCode) list = list.filter((d) => d.code.toLowerCase().includes(searchCode.toLowerCase()))
    return list
  }, [
    devices,
    selectedType,
    getDevicesByType,
    lifecycleFilter,
    filterClientId,
    filterState,
    filterDistrict,
    filterPinpoint,
    filterBrand,
    filterSize,
    filterModel,
    searchCode,
  ])

  const counts = useMemo(() => {
    // Group devices by canonical type ID (resolves all legacy strings automatically)
    const out = {}
    devices.forEach((d) => {
      const canonicalId = resolveTypeId(d.type) || d.type
      if (!canonicalId) return
      const passes = lifecycleFilter === 'all' || getDeviceLifecycleStatus(d) === lifecycleFilter
      if (passes) {
        out[canonicalId] = (out[canonicalId] || 0) + 1
      }
    })
    // Ensure all registry types have a 0 entry even if no devices
    getAllTypes().forEach(t => {
      if (!(t.id in out)) out[t.id] = 0
    })
    return out
  }, [devices, lifecycleFilter])

  const lifecycleTotals = useMemo(() => {
    const out = { all: devices.length, deployed: 0, assigning: 0, warehouse: 0 }
    devices.forEach((d) => {
      const status = getDeviceLifecycleStatus(d)
      if (out[status] !== undefined) out[status] += 1
    })
    return out
  }, [devices])

  const handleAddDeviceOpen = () => {
    setNewProductType('tv')
    setNewBrand('')
    setNewSize('')
    setNewColor('')
    setNewGpsId('')
    setNewMfgDate('')
    setNewInDate('')
    setNewModel('')
    setNewDeviceCode('')
    setNewHealth('ok')
    setShowAddBrand(false)
    setShowAddColor(false)
    setShowCustomSize(false)
    setCustomSizeInput('')
    setCodeEditMode(false)
    setShowAddDevice(true)
  }

  const handleProductTypeChange = (type) => {
    setNewProductType(type)
    setNewBrand('')
    setNewSize('')
    setNewDeviceCode('')    // Reset manual code when type changes so auto-code recalculates
    setCodeEditMode(false)  // Return to auto mode when type changes
  }

  // UPDATED: Modified to show barcode modal after adding device
  const handleAddDeviceSubmit = async () => {
    const code = effectiveCode
    // Use the already-computed codeValidation (handles custom types correctly)
    if (!codeValidation.valid) return
    
    setAddingDevice(true)
    
    try {
      const deviceData = {
        code: code.toUpperCase(),
        type: newProductType,
        brand: newBrand || undefined,
        size: newSize || undefined,
        color: newColor || undefined,
        gpsId: newGpsId.trim() || undefined,
        inDate: newInDate || undefined,
        model: newModel.trim() || undefined,
        healthStatus: newHealth || 'ok',
        location: 'Warehouse A',
        lifecycleStatus: 'warehouse',
      }
      
      // Backend will auto-generate barcode
      const newDevice = await addDevice(deviceData)
      
      // Show barcode modal with the newly created device
      setSelectedDeviceForBarcode(newDevice)
      setShowBarcodeModal(true)
      
      // Reset form
      setNewLifecycleStatus('warehouse')
      setShowAddDevice(false)
      
    } catch (error) {
      alert('Error adding device: ' + error.message)
    } finally {
      setAddingDevice(false)
    }
  }

  // NEW: Handle viewing barcode for existing devices
  const handleViewBarcode = (device) => {
    setSelectedDeviceForBarcode(device)
    setShowBarcodeModal(true)
  }

  // Bulk add handler
  const handleBulkAddOpen = () => {
    setBulkProductType('tv')
    setBulkBrand('')
    setBulkSize('')
    setBulkColor('')
    setBulkModel('')
    setBulkMfgDate('')
    setBulkInDate('')
    setBulkHealth('ok')
    setBulkLifecycleStatus('warehouse')
    setBulkQty(10)
    setBulkAddProgress(0)
    setShowBulkAddBrand(false)
    setShowBulkAddColor(false)
    setShowBulkCustomSize(false)
    setBulkCustomSizeInput('')
    setShowBulkAdd(true)
  }

  const handleBulkAddSubmit = async () => {
    if (!bulkQty || bulkQty < 1 || bulkQty > 500) return
    setBulkAdding(true)
    setBulkAddProgress(0)
    try {
      const result = await bulkAddDevices({
        type: bulkProductType,
        brand: bulkBrand || undefined,
        size: bulkSize || undefined,
        color: bulkColor || undefined,
        model: bulkModel || undefined,
        inDate: bulkInDate || undefined,
        healthStatus: bulkHealth || 'ok',
        lifecycleStatus: 'warehouse',
        location: 'Warehouse A',
        quantity: bulkQty,
      })
      setBulkCreatedDevices(result.devices)
      setShowBulkAdd(false)
      setShowBulkBarcodes(true)
    } catch (error) {
      alert('Bulk add failed: ' + error.message)
    } finally {
      setBulkAdding(false)
    }
  }

  const canAddDevice = codeValidation.valid && !!effectiveCode && !!newBrand && !!newSize && !!newColor && !!newModel && !!newInDate

  const hasActiveFilters = filterClientId || filterState || filterDistrict || filterPinpoint || filterBrand || filterSize || filterModel

  // Location dropdown
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [hoveredState, setHoveredState] = useState(null)
  const [hoveredDistrict, setHoveredDistrict] = useState(null)
  const locationDropdownRef = useRef(null)
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setLocationDropdownOpen(false)
        setHoveredState(null)
        setHoveredDistrict(null)
      }
    }
    if (locationDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [locationDropdownOpen])

  const locationLabel = useMemo(() => {
    if (filterState === 'Warehouse') return filterPinpoint ? filterPinpoint : 'Warehouse'
    if (filterPinpoint && filterState && filterDistrict) return `${filterState} → ${filterDistrict} → ${filterPinpoint}`
    if (filterDistrict && filterState) return `${filterState} → ${filterDistrict}`
    if (filterState) return filterState
    return 'All locations'
  }, [filterState, filterDistrict, filterPinpoint])

  const handleLocationSelect = (state, district, pinpoint) => {
    setFilterState(state || '')
    setFilterDistrict(district || '')
    setFilterPinpoint(pinpoint || '')
    setLocationDropdownOpen(false)
    setHoveredState(null)
    setHoveredDistrict(null)
  }

  // Make Set handlers
  const handleOpenMakeSetModal = () => {
    setShowMakeSetModal(true)
    setSelectedSetType(null)
    setSelectedComponents({})
    setSetName('')
  }

  const handleCloseMakeSetModal = () => {
    setShowMakeSetModal(false)
    setSelectedSetType(null)
    setSelectedComponents({})
    setSetName('')
  }

  const handleSetTypeSelect = (typeKey) => {
    setSelectedSetType(typeKey)
    setSelectedComponents({})
    setSetName('')
  }

  const handleComponentSelect = (componentKey, value) => {
    setSelectedComponents(prev => ({
      ...prev,
      [componentKey]: value
    }))
  }

  const canCreateSet = () => {
    if (!selectedSetType || !setName.trim()) return false
    
    const setType = SET_TYPES[selectedSetType]
    const allComponentsSelected = setType.components.every(
      comp => selectedComponents[comp.key]
    )
    
    return allComponentsSelected
  }

  const handleCreateSet = () => {
    if (!canCreateSet()) return

    const setType = SET_TYPES[selectedSetType]
    
    createDeviceSet({
      type: selectedSetType,
      name: setName.trim(),
      components: selectedComponents,
      setTypeLabel: setType.label,
    })

    handleCloseMakeSetModal()
  }

  const saveCustomType = () => {
    if (!newTypeName.trim() || !newTypeCode.trim()) return
    const code = newTypeCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const updated = [...customProductTypes, { key: `custom-${code}`, label: newTypeName.trim(), code }]
    setCustomProductTypes(updated)
    localStorage.setItem('customProductTypes', JSON.stringify(updated))
    setNewTypeName(''); setNewTypeCode(''); setShowAddTypeModal(false)
  }

  const deleteCustomType = (key) => {
    const updated = customProductTypes.filter(t => t.key !== key)
    setCustomProductTypes(updated)
    localStorage.setItem('customProductTypes', JSON.stringify(updated))
  }

  const saveCustomBrand = (val) => {
    if (!val.trim()) return
    const updated = [...new Set([...customBrands, val.trim()])]
    setCustomBrands(updated)
    localStorage.setItem('customBrands', JSON.stringify(updated))
  }

  const saveCustomColor = (val) => {
    if (!val.trim()) return
    const updated = [...new Set([...customColors, val.trim()])]
    setCustomColors(updated)
    localStorage.setItem('customColors', JSON.stringify(updated))
  }

  const allProductTypes = {
    ...Object.fromEntries(Object.entries(PRODUCT_TYPES).map(([k,v]) => [k,v])),
    ...Object.fromEntries(customProductTypes.map(t => [t.key, t.label]))
  }

  const handleDeleteSet = (setId) => {
    if (confirm('Are you sure you want to dismantle this set? Components will be returned to inventory.')) {
      deleteDeviceSet(setId)
    }
  }

  const getAvailableStock = (inventoryKey) => {
    return componentInventory[inventoryKey] || 0
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Smartphone className="w-7 h-7 md:w-8 md:h-8 text-primary-600" />
              Devices & Sets
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Manage devices, create sets, and track inventory
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium shadow-md text-sm"
            >
              <ScanBarcode className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Scan Barcode</span>
              <span className="sm:hidden">Scan</span>
            </button>
            <button
              type="button"
              onClick={handleBulkAddOpen}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm"
            >
              <PackagePlus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Bulk Add</span>
              <span className="sm:hidden">Bulk</span>
            </button>
            <button
              type="button"
              onClick={handleAddDeviceOpen}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 inline-flex gap-1">
          <button
            onClick={() => {}}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all bg-primary-600 text-white shadow-sm`}
          >
            <Smartphone className="w-4 h-4" />
            Devices
          </button>
          <button
            onClick={() => navigate('/dashboard/makesets')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all text-gray-600 hover:bg-gray-50`}
          >
            <Box className="w-4 h-4" />
            Make Sets
          </button>
        </div>
      </div>

      {/* Device list content */}
      <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">View by lifecycle</p>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex gap-3 flex-nowrap min-w-max">
            {LIFECYCLE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = lifecycleFilter === opt.value
              const total = lifecycleTotals[opt.value] ?? 0
              const style = isActive
                ? opt.value === 'deployed'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : opt.value === 'assigning'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                    : 'bg-slate-600 text-white border-slate-600 shadow-md'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              return (
                <button
                  key={opt.value}
                  onClick={() => setLifecycleFilter(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-5 py-3 text-left transition-all min-w-[160px] ${style}`}
                  title={opt.desc}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-white/20' : 'bg-gray-200/80'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className={`text-xl font-bold ${isActive ? 'text-white' : 'text-gray-700'}`}>{total}</p>
                  </div>
                </button>
              )
            })}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {lifecycleFilter === 'deployed' && 'Showing devices in use at client locations.'}
            {lifecycleFilter === 'assigning' && 'Showing devices assigned to clients but not yet at site.'}
            {lifecycleFilter === 'warehouse' && 'Showing devices in Warehouse A, B or C.'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary-600" />
            Filters & views
          </span>
          {hasActiveFilters && (
            <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
          )}
          <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
        </button>
        {showFilters && (
          <div className="border-t border-gray-200 p-4 space-y-6">
            <p className="text-sm text-gray-600">
              Counts below match your lifecycle view above. Click a card to filter by product type; use dropdowns for more filters.
            </p>

            {/* Individual items */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Box className="w-4 h-4" />
                Individual items
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {/* Registry-driven: all built-in + custom types, counts by canonical ID */
                getAllTypes().map((typeEntry) => {
                  const Icon = PRODUCT_TYPE_ICONS[typeEntry.id] || Box
                  const count = counts[typeEntry.id] ?? 0
                  const isSelected = selectedType === typeEntry.id
                  const colors = getColorClasses(typeEntry.color)
                  return (
                    <button
                      key={typeEntry.id}
                      type="button"
                      onClick={() => setSelectedType(isSelected ? null : typeEntry.id)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md shrink-0 ${typeEntry.isBuiltin ? 'bg-primary-100 text-primary-600' : 'bg-violet-100 text-violet-600'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{typeEntry.label}</p>
                          <p className={`text-base font-bold ${typeEntry.isBuiltin ? 'text-primary-600' : 'text-violet-600'}`}>{count}</p>
                          <p className="text-xs text-gray-400 font-mono">{typeEntry.id}</p>
                        </div>
                      </div>
                      {!typeEntry.isBuiltin && (
                        <span className="mt-1 inline-block text-xs bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded font-medium">Custom</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sets */}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Sets
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { typeKey: 'aStand',      label: 'A stand',  icon: LayoutGrid },
                  { typeKey: 'iStand',      label: 'I stand',  icon: Monitor },
                  { typeKey: 'tabletCombo', label: 'Tablet',   icon: TabletIcon },
                ].map(({ typeKey, label, icon: Icon }) => {
                  const setCount = deviceSets.filter(s => s.setType === typeKey).length
                  return (
                    <div
                      key={typeKey}
                      className="rounded-xl border-2 border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-primary-100 text-primary-600 shrink-0">
                          <Icon className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{label}</p>
                          <p className="text-xl font-bold text-primary-600">{setCount}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-gray-100">
              {lifecycleFilter !== 'warehouse' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                  <select
                    value={filterClientId}
                    onChange={(e) => setFilterClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All clients</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Location dropdown */}
              <div className="relative" ref={locationDropdownRef}>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</label>
                <button
                  type="button"
                  onClick={() => setLocationDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <span className="truncate">{locationLabel}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${locationDropdownOpen ? 'rotate-90' : ''}`} />
                </button>
                {locationDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 max-h-[320px] flex">
                    <div className="overflow-y-auto py-1 min-w-[180px]">
                      <button
                        type="button"
                        onClick={() => handleLocationSelect('', '', '')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${!filterState ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                      >
                        All locations
                      </button>
                      {locationHierarchy.states.map((state) => (
                        <div
                          key={state}
                          className="relative group"
                          onMouseEnter={() => { setHoveredState(state); setHoveredDistrict(null) }}
                          onMouseLeave={() => setHoveredState(null)}
                        >
                          <button
                            type="button"
                            onClick={() => handleLocationSelect(state, '', '')}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && !filterDistrict ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                          >
                            <span>{state}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          </button>
                          {hoveredState === state && (locationHierarchy.districtsByState[state]?.length > 0) && (
                            <div
                              className="absolute left-full top-0 ml-0 py-1 min-w-[180px] bg-white rounded-r-lg border border-gray-200 border-l-0 shadow-lg"
                              onMouseEnter={() => setHoveredState(state)}
                              onMouseLeave={() => setHoveredDistrict(null)}
                            >
                              {locationHierarchy.districtsByState[state].map((district) => (
                                <div
                                  key={district}
                                  className="relative group"
                                  onMouseEnter={() => setHoveredDistrict(`${state}|${district}`)}
                                  onMouseLeave={() => setHoveredDistrict(null)}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleLocationSelect(state, district, '')}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && filterDistrict === district && !filterPinpoint ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                                  >
                                    <span>{district}</span>
                                    {(locationHierarchy.locationsByStateDistrict[`${state}|${district}`]?.length > 0) && (
                                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                    )}
                                  </button>
                                  {hoveredDistrict === `${state}|${district}` && (locationHierarchy.locationsByStateDistrict[`${state}|${district}`]?.length > 0) && (
                                    <div className="absolute left-full top-0 ml-0 py-1 min-w-[180px] bg-white rounded-r-lg border border-gray-200 border-l-0 shadow-lg">
                                      {locationHierarchy.locationsByStateDistrict[`${state}|${district}`].map((loc) => (
                                        <button
                                          key={loc}
                                          type="button"
                                          onClick={() => handleLocationSelect(state, district, loc)}
                                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && filterDistrict === district && filterPinpoint === loc ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                                        >
                                          {loc}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {hoveredState === state && (locationHierarchy.districtsByState[state]?.length === 0) && (locationHierarchy.locationsByStateDistrict[`${state}|`]?.length > 0) && (
                            <div
                              className="absolute left-full top-0 ml-0 py-1 min-w-[180px] bg-white rounded-r-lg border border-gray-200 border-l-0 shadow-lg"
                              onMouseEnter={() => setHoveredState(state)}
                            >
                              {locationHierarchy.locationsByStateDistrict[`${state}|`].map((loc) => (
                                <button
                                  key={loc}
                                  type="button"
                                  onClick={() => handleLocationSelect(state, '', loc)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${filterState === state && !filterDistrict && filterPinpoint === loc ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                                >
                                  {loc}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Brand</label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All brands</option>
                  {filterOptions.brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Size</label>
                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All sizes</option>
                  {filterOptions.sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Box className="w-3.5 h-3.5" /> Model</label>
                <input
                  type="text"
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  placeholder="Search model..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Device list table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {lifecycleFilter === 'deployed' && <Truck className="w-5 h-5 text-emerald-600" />}
            {lifecycleFilter === 'assigning' && <Link2 className="w-5 h-5 text-amber-600" />}
            {lifecycleFilter === 'warehouse' && <Package className="w-5 h-5 text-slate-600" />}
            <h3 className="font-semibold text-gray-900">
              {selectedType ? getDeviceTypeLabel(selectedType) : 'All types'}
              <span className="text-gray-500 font-normal ml-1">
                — {filteredDevices.length} {lifecycleFilter === 'all' ? 'total' : lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'in warehouse'}
              </span>
            </h3>
            {selectedType && (
              <button type="button" onClick={() => setSelectedType(null)} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium hover:bg-primary-200 transition-colors">
                <X className="w-3 h-3" /> Clear type filter
              </button>
            )}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {selectedType && (
            <button
              type="button"
              onClick={() => setSelectedType(null)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Clear type filter"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Brand</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Model</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">In Set</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Lifecycle</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned to</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Subscription</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Health</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-500">
                    No {lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'warehouse'} devices
                    {selectedType || filterClientId || filterState || filterBrand || filterSize || filterModel || searchCode ? '. Try clearing filters.' : '.'}
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => {
                  const lifecycle = getDeviceLifecycleStatus(device)
                  const client = device.clientId ? getClientById(device.clientId) : null
                  const subStatus = device.subscriptionStart && device.subscriptionEnd
                    ? getSubscriptionStatus(device.subscriptionEnd)
                    : { type: 'active', label: '—' }
                  const filterStatus = getSubscriptionFilterStatus(device.subscriptionStart, device.subscriptionEnd)

                  // ── Exact granular step for display ──────────────────────
                  const exactStep  = device.lifecycleStatus || 'available'
                  const stepLabel  = LIFECYCLE_LABELS[exactStep] || exactStep
                  const stepColors = LIFECYCLE_COLORS[exactStep] || LIFECYCLE_COLORS.available
                  const hasPending = pendingDeviceIds.has(device.id)

                  // ── Location column logic ─────────────────────────────────
                  // deployed / under_maintenance → full site location
                  // return_initiated / return_transit → client name + "Returning"
                  // assigning → installed → client name + target location if known
                  // warehouse → warehouse name
                  const locationDisplay = (() => {
                    const s = exactStep
                    if (s === 'active' || s === 'under_maintenance' || s === 'deployed') {
                      return [device.state, device.district, device.location].filter(Boolean).join(' → ') || '—'
                    }
                    if (s === 'return_initiated' || s === 'return_transit') {
                      return client ? `${client.name} · Returning` : 'Returning'
                    }
                    if (['assigning','assign_requested','assigned','ready_to_deploy','deploy_requested','in_transit','received','installed'].includes(s)) {
                      const parts = []
                      if (client) parts.push(client.name)
                      // Only show state/district as target — device.location still holds
                      // the old warehouse name at this point, so we exclude it.
                      const loc = [device.state, device.district].filter(Boolean).join(' → ')
                      if (loc) parts.push(loc)
                      return parts.join(' · ') || '—'
                    }
                    // warehouse / returned / available
                    return device.location || 'Warehouse'
                  })()

                  const LifecycleIcon = lifecycle === 'deployed' ? Truck : lifecycle === 'assigning' ? Link2 : Package

                  return (
                    <>
                    <tr key={device.id} className={`hover:bg-gray-50 ${hasPending ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 font-mono font-medium text-gray-900">
                          <QrCode className="w-4 h-4 text-gray-400" />
                          {device.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{getDeviceTypeLabel(device.type)}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{device.brand || '—'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{device.size || '—'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{device.model || '—'}</td>
                      <td className="py-3 px-4 text-sm">
                        {device.setId ? (() => {
                          const set = deviceSets.find(s => s.id === device.setId || s.id === Number(device.setId))
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200">
                              <Layers className="w-3 h-3" />
                              {set ? (set.code || set.name || `Set #${device.setId}`) : `Set #${device.setId}`}
                            </span>
                          )
                        })() : (
                          <span className="text-gray-400 text-xs">Individual</span>
                        )}
                      </td>
                      {/* ── Lifecycle column: exact step + pending badge ── */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stepColors.bg} ${stepColors.text} border-transparent`}>
                            <LifecycleIcon className="w-3.5 h-3.5" />
                            {stepLabel}
                          </span>
                          {hasPending && (
                            <span
                              title="Awaiting manager approval"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300"
                            >
                              🕐 Pending
                            </span>
                          )}
                        </div>
                      </td>
                      {/* ── Location column ── */}
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {lifecycle === 'deployed' && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {locationDisplay}
                          </span>
                        )}
                        {lifecycle === 'assigning' && (
                          <span className="flex items-center gap-1 text-blue-700">
                            <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            {locationDisplay}
                          </span>
                        )}
                        {lifecycle === 'warehouse' && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {locationDisplay}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {client ? <span className="flex items-center gap-1 text-gray-700"><User className="w-3.5 h-3.5 text-gray-400" />{client.name}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {device.subscriptionStart && device.subscriptionEnd ? (
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{device.subscriptionStart} → {device.subscriptionEnd}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const hs = getHealthStyle(device.healthStatus)
                          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${hs.badge}`}>{hs.label}</span>
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {device.barcode && (
                            <button type="button" onClick={() => handleViewBarcode(device)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View barcode">
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Lifecycle history"
                            onClick={() => setExpandedTimeline(prev => prev === device.id ? null : device.id)}
                            className={`p-1.5 rounded transition-colors ${expandedTimeline === device.id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Request next lifecycle step"
                            onClick={() => setLifecycleActionDevice(device)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setDetailDevice(device)} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
                        </div>
                      </td>
                    </tr>
                    {expandedTimeline === device.id && (
                      <tr key={`timeline-${device.id}`}>
                        <td colSpan={12} className="p-0">
                          <DeviceTimeline
                            deviceId={device.id}
                            deviceCode={device.code}
                            onClose={() => setExpandedTimeline(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredDevices.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm px-4">
              No {lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'warehouse'} devices
              {selectedType || filterClientId || filterState || filterBrand || filterSize || filterModel || searchCode ? '. Try clearing filters.' : '.'}
            </div>
          ) : (
            filteredDevices.map((device) => {
              const lifecycle = getDeviceLifecycleStatus(device)
              const client = device.clientId ? getClientById(device.clientId) : null
              const exactStep  = device.lifecycleStatus || 'available'
              const stepLabel  = LIFECYCLE_LABELS[exactStep] || exactStep
              const stepColors = LIFECYCLE_COLORS[exactStep] || LIFECYCLE_COLORS.available
              const hasPending = pendingDeviceIds.has(device.id)

              const locationDisplay = (() => {
                const s = exactStep
                if (s === 'active' || s === 'under_maintenance' || s === 'deployed') {
                  return [device.state, device.district, device.location].filter(Boolean).join(' → ') || '—'
                }
                if (s === 'return_initiated' || s === 'return_transit') {
                  return client ? `${client.name} · Returning` : 'Returning'
                }
                if (['assigning','assign_requested','assigned','ready_to_deploy','deploy_requested','in_transit','received','installed'].includes(s)) {
                  const parts = []
                  if (client) parts.push(client.name)
                  // Only show state/district as target — device.location still holds
                  // the old warehouse name at this point, so we exclude it.
                  const loc = [device.state, device.district].filter(Boolean).join(' → ')
                  if (loc) parts.push(loc)
                  return parts.join(' · ') || '—'
                }
                return device.location || 'Warehouse'
              })()

              const LifecycleIcon = lifecycle === 'deployed' ? Truck : lifecycle === 'assigning' ? Link2 : Package
              const hs = getHealthStyle(device.healthStatus)
              const set = device.setId ? deviceSets.find(s => s.id === device.setId || s.id === Number(device.setId)) : null
              return (
                <div key={device.id} className={`p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors ${hasPending ? 'bg-amber-50/40' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono font-bold text-gray-900 text-base flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-gray-400" />
                        {device.code}
                      </span>
                      <p className="text-sm text-gray-600 mt-0.5">{getDeviceTypeLabel(device.type)}{device.brand ? ` · ${device.brand}` : ''}{device.size ? ` · ${device.size}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hs.badge}`}>{hs.label}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {/* Exact lifecycle step badge */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stepColors.bg} ${stepColors.text}`}>
                      <LifecycleIcon className="w-3 h-3" />
                      {stepLabel}
                    </span>
                    {hasPending && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                        🕐 Pending
                      </span>
                    )}
                    {set && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        <Layers className="w-3 h-3" />
                        {set.code || set.name || `Set #${device.setId}`}
                      </span>
                    )}
                    {client && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <User className="w-3 h-3" />
                        {client.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>{locationDisplay}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {device.barcode && (
                        <button type="button" onClick={() => handleViewBarcode(device)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Lifecycle history"
                        onClick={() => setExpandedTimeline(prev => prev === `mob-${device.id}` ? null : `mob-${device.id}`)}
                        className={`p-2 rounded-lg transition-colors ${expandedTimeline === `mob-${device.id}` ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Next lifecycle step"
                        onClick={() => setLifecycleActionDevice(device)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setDetailDevice(device)} className="px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        View
                      </button>
                    </div>
                  </div>
                  {expandedTimeline === `mob-${device.id}` && (
                    <DeviceTimeline
                      deviceId={device.id}
                      deviceCode={device.code}
                      onClose={() => setExpandedTimeline(null)}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Device detail modal */}
      {detailDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDetailDevice(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-100">
                  <QrCode className="w-8 h-8 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 font-mono">{detailDevice.code}</h2>
                  <p className="text-gray-600">{getDeviceTypeLabel(detailDevice.type)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDetailDevice(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{getDeviceTypeLabel(detailDevice.type)}</span></div>
              {detailDevice.setId && (() => {
                const set = deviceSets.find(s => s.id === detailDevice.setId || s.id === Number(detailDevice.setId))
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">In Set</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200">
                      <Layers className="w-3 h-3" />
                      {set ? (set.code || set.name || `Set #${detailDevice.setId}`) : `Set #${detailDevice.setId}`}
                    </span>
                  </div>
                )
              })()}

              {detailDevice.brand && <div className="flex justify-between"><span className="text-gray-500">Brand</span><span className="font-medium">{detailDevice.brand}</span></div>}
              {detailDevice.size && <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="font-medium">{detailDevice.size}</span></div>}
              {detailDevice.model && <div className="flex justify-between"><span className="text-gray-500">Model</span><span className="font-medium">{detailDevice.model}</span></div>}
              {detailDevice.color && <div className="flex justify-between"><span className="text-gray-500">Color</span><span className="font-medium">{detailDevice.color}</span></div>}
              {detailDevice.gpsId && <div className="flex justify-between"><span className="text-gray-500">GPS ID</span><span className="font-medium font-mono">{detailDevice.gpsId}</span></div>}
              {detailDevice.mfgDate && <div className="flex justify-between"><span className="text-gray-500">IN Date</span><span className="font-medium">{typeof detailDevice.mfgDate === 'string' ? detailDevice.mfgDate : new Date(detailDevice.mfgDate).toLocaleDateString('en-IN')}</span></div>}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Health</span>
                {(() => { const hs = getHealthStyle(detailDevice.healthStatus); return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${hs.badge}`}>{hs.label}</span> })()}
              </div>
              {getDeviceLifecycleStatus(detailDevice) === 'deployed' && (detailDevice.state || detailDevice.district || detailDevice.location) && (
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs font-medium mb-0.5">Deployment location</div>
                  {detailDevice.state && <div className="flex justify-between"><span className="text-gray-500">State</span><span className="font-medium">{detailDevice.state}</span></div>}
                  {detailDevice.district && <div className="flex justify-between"><span className="text-gray-500">District</span><span className="font-medium">{detailDevice.district}</span></div>}
                  {detailDevice.location && <div className="flex justify-between"><span className="text-gray-500">Site</span><span className="font-medium">{detailDevice.location}</span></div>}
                </div>
              )}
              {getDeviceLifecycleStatus(detailDevice) === 'warehouse' && detailDevice.location && (
                <div className="flex justify-between"><span className="text-gray-500">Warehouse</span><span className="font-medium">{detailDevice.location}</span></div>
              )}
              {detailDevice.clientId ? (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Assigned to</span><span className="font-medium">{getClientById(detailDevice.clientId)?.name ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Subscription</span><span className="font-medium">{detailDevice.subscriptionStart} → {detailDevice.subscriptionEnd}</span></div>
                  {detailDevice.subscriptionEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[getSubscriptionStatus(detailDevice.subscriptionEnd).type]}`}>
                        {getSubscriptionStatus(detailDevice.subscriptionEnd).label}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Assigned to</span>
                  <span className="text-gray-400">—</span>
                </div>
              )}
            </div>
            
            {/* NEW: Show barcode button if barcode exists */}
            {detailDevice.barcode && (
              <div className="pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={() => handleViewBarcode(detailDevice)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  View Barcode
                </button>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
              Device data is synced with Client and other modules.
            </p>
          </div>
        </div>
      )}

      {/* Add device modal */}
      {showAddDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAddDevice(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Add Product</h3>
            <p className="text-sm text-gray-500 mb-4">All fields marked * are required. Select N/A where not applicable. Barcode auto-generated.</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Product type *</label>
                  <button type="button" onClick={() => setShowAddTypeModal(true)} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add new type</button>
                </div>
                <select value={newProductType} onChange={(e) => handleProductTypeChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                  {Object.entries(allProductTypes).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Brand *</label>
                  <button type="button" onClick={() => { setShowAddBrand(true); setNewBrandInput('') }} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add new</button>
                </div>
                {showAddBrand ? (
                  <div className="flex gap-2">
                    <input autoFocus type="text" value={newBrandInput} onChange={(e) => setNewBrandInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newBrandInput.trim()) { saveCustomBrand(newBrandInput); setNewBrand(newBrandInput.trim()); setShowAddBrand(false) } if (e.key === 'Escape') setShowAddBrand(false) }} placeholder="Type brand name" className="flex-1 px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                    <button type="button" onClick={() => { if (newBrandInput.trim()) { saveCustomBrand(newBrandInput); setNewBrand(newBrandInput.trim()); setShowAddBrand(false) } }} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">Add</button>
                    <button type="button" onClick={() => setShowAddBrand(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">✕</button>
                  </div>
                ) : (
                  <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newBrand ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select brand *</option>
                    <option value="N/A">N/A — Not Applicable</option>
                    {[...brandsForNewProduct, ...customBrands.filter(b => !brandsForNewProduct.includes(b))].map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Size *</label>
                  <button type="button" onClick={() => { setShowCustomSize(!showCustomSize); setCustomSizeInput(''); if (!showCustomSize) setNewSize('') }} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Specify</button>
                </div>
                {showCustomSize ? (
                  <div className="flex gap-2 items-center">
                    <input autoFocus type="text" value={customSizeInput} onChange={(e) => { setCustomSizeInput(e.target.value); setNewSize(e.target.value) }} placeholder='e.g. 42" or 15cm or 10.5"' className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm ${!newSize ? 'border-red-300 bg-red-50' : 'border-primary-300'}`} />
                    <button type="button" onClick={() => { setShowCustomSize(false); setCustomSizeInput('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">✕</button>
                  </div>
                ) : (
                  <select value={newSize} onChange={(e) => setNewSize(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newSize ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select size *</option>
                    <option value="N/A">N/A — Not Applicable</option>
                    {sizesForNewProduct.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <div className="flex gap-2">
                  <input type="text" value={newModel === 'N/A' ? '' : newModel} onChange={(e) => setNewModel(e.target.value)} disabled={newModel === 'N/A'} placeholder="e.g. Tab S8, Frame 55" className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newModel ? 'border-red-300 bg-red-50' : 'border-gray-200'} disabled:bg-gray-100 disabled:text-gray-400`} />
                  <button type="button" onClick={() => setNewModel(newModel === 'N/A' ? '' : 'N/A')} className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${newModel === 'N/A' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>N/A</button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Color *</label>
                  <button type="button" onClick={() => { setShowAddColor(true); setNewColorInput('') }} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add new</button>
                </div>
                {showAddColor ? (
                  <div className="flex gap-2">
                    <input autoFocus type="text" value={newColorInput} onChange={(e) => setNewColorInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newColorInput.trim()) { saveCustomColor(newColorInput); setNewColor(newColorInput.trim()); setShowAddColor(false) } if (e.key === 'Escape') setShowAddColor(false) }} placeholder="Type color name" className="flex-1 px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                    <button type="button" onClick={() => { if (newColorInput.trim()) { saveCustomColor(newColorInput); setNewColor(newColorInput.trim()); setShowAddColor(false) } }} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">Add</button>
                    <button type="button" onClick={() => setShowAddColor(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">✕</button>
                  </div>
                ) : (
                  <select value={newColor} onChange={(e) => setNewColor(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newColor ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select color *</option>
                    <option value="N/A">N/A — Not Applicable</option>
                    {[...DEVICE_COLORS, ...customColors.filter(col => !DEVICE_COLORS.includes(col))].map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GPS ID</label>
                <input
                  type="text"
                  value={newGpsId}
                  onChange={(e) => setNewGpsId(e.target.value)}
                  placeholder="Optional tracking ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IN Date * <span className="text-xs text-gray-400 font-normal">(Date entered warehouse)</span></label>
                <input type="date" value={newInDate} onChange={(e) => setNewInDate(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${!newInDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health / Status *</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEVICE_HEALTH_STATUS.map((h) => (
                    <button key={h.value} type="button" onClick={() => setNewHealth(h.value)} className={`py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all ${newHealth === h.value ? h.value === 'ok' ? 'bg-emerald-500 text-white border-emerald-500' : h.value === 'repair' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {h.value === 'ok' ? '✓ OK' : h.value === 'repair' ? '🔧 Repair' : '⚠ Damage'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">In Warehouse</span>
                  <span className="ml-auto text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Fixed</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Unique code *
                  </label>
                  {codeEditMode ? (
                    <button
                      type="button"
                      onClick={() => { setCodeEditMode(false); setNewDeviceCode('') }}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                      ↩ Use auto-assigned
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCodeEditMode(true)}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                    >
                      ✏ Edit manually
                    </button>
                  )}
                </div>

                {codeEditMode ? (
                  <>
                    <input
                      type="text"
                      value={newDeviceCode}
                      onChange={(e) => setNewDeviceCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      placeholder={`e.g. ${getCodePrefix(newProductType)}-001`}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 font-mono text-sm ${
                        newDeviceCode && !codeValidation.valid
                          ? 'border-red-400 focus:ring-red-400 bg-red-50'
                          : newDeviceCode && codeValidation.valid
                            ? 'border-green-400 focus:ring-green-400 bg-green-50'
                            : 'border-gray-200 focus:ring-primary-500'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must start with <span className="font-mono font-semibold text-gray-700">{getCodePrefix(newProductType)}-</span> followed by a number.
                      Tip: <button type="button" onClick={() => setNewDeviceCode(suggestedCode)} className="text-primary-600 hover:underline font-mono">{suggestedCode}</button>
                    </p>
                    {newDeviceCode && codeValidation.error && (
                      <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                        <span className="shrink-0">⚠</span> {codeValidation.error}
                      </p>
                    )}
                    {newDeviceCode && codeValidation.valid && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <span>✓</span> Code is unique and valid.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                    <span className="font-mono font-semibold text-primary-800 text-sm">{suggestedCode}</span>
                    <span className="ml-auto text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Auto-assigned</span>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-1.5">
                  Codes like <span className="font-mono">{getCodePrefix(newProductType)}-1</span>, <span className="font-mono">{getCodePrefix(newProductType)}-01</span>, <span className="font-mono">{getCodePrefix(newProductType)}-001</span> are treated as identical — no duplicates allowed.
                </p>
              </div>
              
              {/* NEW: Barcode info */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <QrCode className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium">Barcode will be auto-generated</p>
                    <p className="text-xs mt-1">You can print/download the barcode after adding the device.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddDevice(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDeviceSubmit}
                disabled={!canAddDevice || addingDevice}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addingDevice ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </>

      {/* Add New Product Type Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAddTypeModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Product Type</h3>
              <button type="button" onClick={() => setShowAddTypeModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input type="text" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="e.g. Mouse, Keyboard, Router" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code Prefix * <span className="text-gray-400 font-normal text-xs">(2–4 uppercase letters, used in device codes)</span></label>
                <input type="text" value={newTypeCode} onChange={(e) => setNewTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))} placeholder="e.g. MSE, KBD, RTR" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm font-mono" />
                <p className="text-xs text-gray-400 mt-1">Codes: {newTypeCode || 'XXX'}-001, {newTypeCode || 'XXX'}-002...</p>
              </div>
              {customProductTypes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Custom types:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {customProductTypes.map(t => (
                      <span key={t.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs">
                        {t.label} <span className="font-mono opacity-60">({t.code})</span>
                        <button type="button" onClick={() => deleteCustomType(t.key)} className="text-primary-400 hover:text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowAddTypeModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm">Cancel</button>
              <button type="button" onClick={saveCustomType} disabled={!newTypeName.trim() || !newTypeCode.trim()} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">Add Type</button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner 
          onClose={() => setShowBarcodeScanner(false)}
          onDeviceFound={(device) => {
            setShowBarcodeScanner(false)
            // Optionally show the device's barcode
            if (device.barcode) {
              handleViewBarcode(device)
            }
          }}
        />
      )}

      {/* Unified Barcode / Lifecycle Card */}
      {showBarcodeModal && selectedDeviceForBarcode && (
        <BarcodeResultCard
          device={{ ...selectedDeviceForBarcode, _isSet: false }}
          onClose={() => {
            setShowBarcodeModal(false)
            setSelectedDeviceForBarcode(null)
          }}
          onDeviceUpdated={(fresh) => {
            setSelectedDeviceForBarcode(fresh)
          }}
        />
      )}

      {/* BULK ADD MODAL */}
      {showBulkAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !bulkAdding && setShowBulkAdd(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-100 rounded-lg">
                <PackagePlus className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Bulk Add Products</h3>
                <p className="text-sm text-gray-500">All fields required. Codes and barcodes auto-generated.</p>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {/* Quantity — most important field, shown first */}
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                <label className="block text-sm font-semibold text-violet-900 mb-2">
                  How many devices? *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={bulkQty}
                    onChange={(e) => setBulkQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                    className="w-28 px-3 py-2 border border-violet-300 rounded-lg focus:ring-2 focus:ring-violet-500 text-center font-bold text-lg"
                  />
                  <div className="text-sm text-violet-700">
                    <p>Will create <span className="font-bold">{bulkQty}</span> device{bulkQty !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-violet-500">Max 500 at a time</p>
                  </div>
                </div>
                {/* Quick-pick buttons */}
                <div className="flex gap-2 mt-3">
                  {[5, 10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBulkQty(n)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        bulkQty === n
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product type *</label>
                <select value={bulkProductType} onChange={(e) => { setBulkProductType(e.target.value); setBulkBrand(''); setBulkSize('') }} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500">
                  {Object.entries(allProductTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              {/* Shared fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Brand *</label>
                    <button type="button" onClick={() => { setShowBulkAddBrand(true); setBulkNewBrandInput('') }} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add new</button>
                  </div>
                  {showBulkAddBrand ? (
                    <div className="flex gap-2">
                      <input autoFocus type="text" value={bulkNewBrandInput} onChange={(e) => setBulkNewBrandInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && bulkNewBrandInput.trim()) { saveCustomBrand(bulkNewBrandInput); setBulkBrand(bulkNewBrandInput.trim()); setShowBulkAddBrand(false) } if (e.key === 'Escape') setShowBulkAddBrand(false) }} placeholder="Brand name" className="flex-1 px-2 py-1.5 border border-violet-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
                      <button type="button" onClick={() => { if (bulkNewBrandInput.trim()) { saveCustomBrand(bulkNewBrandInput); setBulkBrand(bulkNewBrandInput.trim()); setShowBulkAddBrand(false) } }} className="px-2 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium">Add</button>
                      <button type="button" onClick={() => setShowBulkAddBrand(false)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
                    </div>
                  ) : (
                    <select value={bulkBrand} onChange={(e) => setBulkBrand(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkBrand ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <option value="">Select brand *</option>
                      <option value="N/A">N/A — Not Applicable</option>
                      {[...getBrandsForProductType(bulkProductType), ...customBrands.filter(b => !getBrandsForProductType(bulkProductType).includes(b))].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Size *</label>
                    <button type="button" onClick={() => { setShowBulkCustomSize(!showBulkCustomSize); setBulkCustomSizeInput(''); if (!showBulkCustomSize) setBulkSize('') }} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Specify</button>
                  </div>
                  {showBulkCustomSize ? (
                    <div className="flex gap-2">
                      <input autoFocus type="text" value={bulkCustomSizeInput} onChange={(e) => { setBulkCustomSizeInput(e.target.value); setBulkSize(e.target.value) }} placeholder='e.g. 42" or 15cm' className={`flex-1 px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 ${!bulkSize ? 'border-red-300 bg-red-50' : 'border-violet-300'}`} />
                      <button type="button" onClick={() => { setShowBulkCustomSize(false); setBulkCustomSizeInput('') }} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
                    </div>
                  ) : (
                    <select value={bulkSize} onChange={(e) => setBulkSize(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkSize ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <option value="">Select size *</option>
                      <option value="N/A">N/A — Not Applicable</option>
                      {getSizesForProductType(bulkProductType).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <div className="flex gap-2">
                  <input type="text" value={bulkModel === 'N/A' ? '' : bulkModel} onChange={(e) => setBulkModel(e.target.value)} disabled={bulkModel === 'N/A'} placeholder="e.g. Tab S8, Frame 55" className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 ${!bulkModel ? 'border-red-300 bg-red-50' : 'border-gray-200'} disabled:bg-gray-100`} />
                  <button type="button" onClick={() => setBulkModel(bulkModel === 'N/A' ? '' : 'N/A')} className={`px-3 py-2 text-xs font-semibold rounded-lg border ${bulkModel === 'N/A' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>N/A</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Color *</label>
                    <button type="button" onClick={() => { setShowBulkAddColor(true); setBulkNewColorInput('') }} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add new</button>
                  </div>
                  {showBulkAddColor ? (
                    <div className="flex gap-1">
                      <input autoFocus type="text" value={bulkNewColorInput} onChange={(e) => setBulkNewColorInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && bulkNewColorInput.trim()) { saveCustomColor(bulkNewColorInput); setBulkColor(bulkNewColorInput.trim()); setShowBulkAddColor(false) } if (e.key === 'Escape') setShowBulkAddColor(false) }} placeholder="Color name" className="flex-1 px-2 py-1.5 border border-violet-300 rounded-lg text-sm" />
                      <button type="button" onClick={() => { if (bulkNewColorInput.trim()) { saveCustomColor(bulkNewColorInput); setBulkColor(bulkNewColorInput.trim()); setShowBulkAddColor(false) } }} className="px-2 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium">Add</button>
                      <button type="button" onClick={() => setShowBulkAddColor(false)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
                    </div>
                  ) : (
                    <select value={bulkColor} onChange={(e) => setBulkColor(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkColor ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <option value="">Select color *</option>
                      <option value="N/A">N/A — Not Applicable</option>
                      {[...DEVICE_COLORS, ...customColors.filter(col => !DEVICE_COLORS.includes(col))].map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IN Date *</label>
                  <input type="date" value={bulkInDate} onChange={(e) => setBulkInDate(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-sm ${!bulkInDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health / Status *</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEVICE_HEALTH_STATUS.map((h) => (
                    <button key={h.value} type="button" onClick={() => setBulkHealth(h.value)} className={`py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all ${bulkHealth === h.value ? h.value === 'ok' ? 'bg-emerald-500 text-white border-emerald-500' : h.value === 'repair' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {h.value === 'ok' ? '✓ OK' : h.value === 'repair' ? '🔧 Repair' : '⚠ Damage'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">In Warehouse</span>
                  <span className="ml-auto text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Fixed</span>
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <p className="font-medium text-gray-700 mb-1">What will be created:</p>
                <ul className="text-gray-600 space-y-0.5 text-xs">
                  <li>• <span className="font-semibold">{bulkQty}</span> {PRODUCT_TYPES[bulkProductType] || bulkProductType} devices</li>
                  <li>• Codes: <span className="font-mono">{getCodePrefix(bulkProductType)}-XXX</span> (auto-assigned, sequential)</li>
                  <li>• <span className="font-semibold">{bulkQty}</span> unique barcodes auto-generated</li>
                  <li>• All logged to database in one operation</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowBulkAdd(false)}
                disabled={bulkAdding}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAddSubmit}
                disabled={bulkAdding || bulkQty < 1 || !bulkBrand || !bulkSize || !bulkColor || !bulkModel || !bulkInDate}
                className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {bulkAdding ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating {bulkQty} devices...
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-5 h-5" />
                    Create {bulkQty} Device{bulkQty !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK BARCODE VIEWER — shown after bulk add completes */}
      {showBulkBarcodes && bulkCreatedDevices.length > 0 && (
        <BulkBarcodeGenerator
          devices={bulkCreatedDevices}
          onClose={() => {
            setShowBulkBarcodes(false)
            setBulkCreatedDevices([])
          }}
        />
      )}

      {/* LIFECYCLE ACTION MODAL — request next step for a device */}
      {lifecycleActionDevice && (
        <LifecycleActionModal
          device={lifecycleActionDevice}
          onClose={() => setLifecycleActionDevice(null)}
          onSuccess={() => {
            setLifecycleActionDevice(null)
            if (expandedTimeline === lifecycleActionDevice.id) {
              setExpandedTimeline(null)
              setTimeout(() => setExpandedTimeline(lifecycleActionDevice.id), 100)
            }
          }}
        />
      )}
    </div>
  )
}

export default Devices