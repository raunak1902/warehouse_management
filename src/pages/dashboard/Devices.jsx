import { useState, useMemo, useRef, useEffect } from 'react'
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
} from 'lucide-react'
import {
  useInventory,
  getDeviceLifecycleStatus,
  getSubscriptionFilterStatus,
  getSubscriptionStatus,
} from '../../context/InventoryContext'
import {
  ALL_PRODUCT_TYPES,
  PRODUCT_TYPES,
  getSizesForProductType,
  getBrandsForProductType,
  getCodePrefix,
  DEVICE_COLORS,
  getIndianLocationHierarchyForFilter,
} from '../../config/deviceConfig'

const LIFECYCLE_OPTIONS = [
  { value: 'deployed', label: 'Deployed', icon: Truck, desc: 'In use by client at location' },
  { value: 'assigning', label: 'Assigning', icon: Link2, desc: 'Ordered, not yet deployed' },
  { value: 'warehouse', label: 'In Warehouse', icon: Package, desc: 'In Warehouse A, B or C' },
]

const PRODUCT_TYPE_ICONS = {
  tv: Tv,
  tablet: TabletIcon,
  'touch-tv': Tv,
  'a-stand': LayoutGrid,
  'i-stand': Monitor,
  'tablet-stand': TabletIcon,
  stand: LayoutGrid,
  istand: Monitor,
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
  return ALL_PRODUCT_TYPES[type] || type || '—'
}

const Devices = () => {
  const {
    devices,
    clients,
    getClientById,
    getDevicesByType,
    getUniqueDeviceFilterOptions,
    addDevice,
  } = useInventory()

  const [lifecycleFilter, setLifecycleFilter] = useState('deployed')
  const [selectedType, setSelectedType] = useState(null)
  const [searchCode, setSearchCode] = useState('')
  const [detailDevice, setDetailDevice] = useState(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Filters: status, client, location (multilevel), brand, size, model
  const [filterClientId, setFilterClientId] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterPinpoint, setFilterPinpoint] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterModel, setFilterModel] = useState('')

  // Add device form state (all dropdowns + synced by product type)
  const [newProductType, setNewProductType] = useState('tv')
  const [newBrand, setNewBrand] = useState('')
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')
  const [newGpsId, setNewGpsId] = useState('')
  const [newMfgDate, setNewMfgDate] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newDeviceCode, setNewDeviceCode] = useState('')

  const filterOptions = useMemo(() => getUniqueDeviceFilterOptions(), [getUniqueDeviceFilterOptions])
  // Use static Indian states/places so Location dropdown always has options when opened
  const locationHierarchy = useMemo(() => getIndianLocationHierarchyForFilter(), [])

  const sizesForNewProduct = useMemo(() => getSizesForProductType(newProductType), [newProductType])
  const brandsForNewProduct = useMemo(() => getBrandsForProductType(newProductType), [newProductType])

  const suggestedCode = useMemo(() => {
    const prefix = getCodePrefix(newProductType)
    const existing = devices.filter((d) => d.type === newProductType && d.code.startsWith(prefix))
    const nums = existing.map((d) => parseInt(d.code.replace(prefix + '-', ''), 10)).filter((n) => !isNaN(n))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `${prefix}-${String(next).padStart(3, '0')}`
  }, [devices, newProductType])

  const getDevicesForLifecycle = (list) => {
    return list.filter((d) => getDeviceLifecycleStatus(d) === lifecycleFilter)
  }

  const filteredDevices = useMemo(() => {
    let list = selectedType ? getDevicesByType(selectedType) : devices
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

  // Counts per type for the current lifecycle only (in sync with lifecycle toggle)
  const counts = useMemo(() => {
    const types = Object.keys(ALL_PRODUCT_TYPES)
    const out = {}
    types.forEach((t) => {
      const list = getDevicesByType(t).filter((d) => getDeviceLifecycleStatus(d) === lifecycleFilter)
      out[t] = list.length
    })
    return out
  }, [devices, getDevicesByType, lifecycleFilter])

  // Total per lifecycle (for display on lifecycle tabs)
  const lifecycleTotals = useMemo(() => {
    const out = { deployed: 0, assigning: 0, warehouse: 0 }
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
    setNewModel('')
    setNewDeviceCode('')
    setShowAddDevice(true)
  }

  const handleProductTypeChange = (type) => {
    setNewProductType(type)
    setNewBrand('')
    setNewSize('')
  }

  const handleAddDeviceSubmit = () => {
    const code = (newDeviceCode || suggestedCode).trim()
    if (!code || devices.some((d) => d.code === code)) return
    addDevice({
      code,
      type: newProductType,
      brand: newBrand || undefined,
      size: newSize || undefined,
      color: newColor || undefined,
      gpsId: newGpsId.trim() || undefined,
      mfgDate: newMfgDate || undefined,
      model: newModel.trim() || undefined,
    })
    setShowAddDevice(false)
  }

  const canAddDevice = (newDeviceCode.trim() || suggestedCode) && !devices.some((d) => d.code === (newDeviceCode.trim() || suggestedCode))

  const hasActiveFilters = filterClientId || filterState || filterDistrict || filterPinpoint || filterBrand || filterSize || filterModel

  // Single Location dropdown with nested hover flyouts
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [hoveredState, setHoveredState] = useState(null)
  const [hoveredDistrict, setHoveredDistrict] = useState(null) // format: 'State|District'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-8 h-8 text-primary-600" />
            Devices
          </h1>
          <p className="text-gray-600 mt-1">
            Track devices by product type, brand, size, model. Filter by status, client, location, and more.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddDeviceOpen}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {/* Lifecycle view — single source of truth; all counts and list sync to selected view */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">View by lifecycle</p>
          <div className="flex flex-wrap gap-3">
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
          <p className="text-sm text-gray-500 mt-2">
            {lifecycleFilter === 'deployed' && 'Showing devices in use at client locations.'}
            {lifecycleFilter === 'assigning' && 'Showing devices assigned to clients but not yet at site.'}
            {lifecycleFilter === 'warehouse' && 'Showing devices in Warehouse A, B or C.'}
          </p>
        </div>
      </div>

      {/* Filters: Product type (cards) + Client, Location, Brand, Size, Model */}
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

            {/* Individual items — smaller icons (counts = current lifecycle) */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Box className="w-4 h-4" />
                Individual items
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {Object.entries(PRODUCT_TYPES).map(([typeKey, label]) => {
                  const Icon = PRODUCT_TYPE_ICONS[typeKey] || Box
                  const count = counts[typeKey] ?? 0
                  const isSelected = selectedType === typeKey
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => setSelectedType(isSelected ? null : typeKey)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary-100 text-primary-600 shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{label}</p>
                          <p className="text-base font-bold text-primary-600">{count}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sets — bigger icons, separate section */}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Sets
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { typeKey: 'stand', label: 'A stand' },
                  { typeKey: 'istand', label: 'I stand' },
                  { typeKey: 'tablet', label: 'Tablet' },
                ].map(({ typeKey, label }) => {
                  const Icon = PRODUCT_TYPE_ICONS[typeKey] || Box
                  const count = counts[typeKey] ?? 0
                  const isSelected = selectedType === typeKey
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => setSelectedType(isSelected ? null : typeKey)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-primary-100 text-primary-600 shrink-0">
                          <Icon className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{label}</p>
                          <p className="text-xl font-bold text-primary-600">{count}</p>
                        </div>
                      </div>
                    </button>
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
              {/* Location: single dropdown with hover flyouts (State → District → Pinpoint) */}
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

      {/* Device list table — in sync with lifecycle view */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {lifecycleFilter === 'deployed' && <Truck className="w-5 h-5 text-emerald-600" />}
            {lifecycleFilter === 'assigning' && <Link2 className="w-5 h-5 text-amber-600" />}
            {lifecycleFilter === 'warehouse' && <Package className="w-5 h-5 text-slate-600" />}
            <h3 className="font-semibold text-gray-900">
              {selectedType ? getDeviceTypeLabel(selectedType) : 'All types'}
              <span className="text-gray-500 font-normal ml-1">
                — {filteredDevices.length} {lifecycleFilter === 'deployed' ? 'deployed' : lifecycleFilter === 'assigning' ? 'assigning' : 'in warehouse'}
              </span>
            </h3>
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Brand</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Model</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Lifecycle</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned to</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Subscription</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-500">
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
                  const statusLabel =
                    !device.clientId
                      ? '—'
                      : filterStatus === 'upcoming'
                        ? 'Upcoming'
                        : subStatus.label
                  const statusType = !device.clientId ? 'active' : subStatus.type === 'expired' ? 'expired' : filterStatus === 'upcoming' ? 'upcoming' : subStatus.type
                  const locationDisplay =
                    lifecycle === 'deployed'
                      ? [device.state, device.district, device.location].filter(Boolean).join(' → ')
                      : lifecycle === 'assigning'
                        ? 'Assigning'
                        : (device.location || '—')
                  const lifecycleStyles = {
                    deployed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    assigning: 'bg-amber-100 text-amber-800 border-amber-200',
                    warehouse: 'bg-slate-100 text-slate-800 border-slate-200',
                  }
                  const LifecycleIcon = lifecycle === 'deployed' ? Truck : lifecycle === 'assigning' ? Link2 : Package
                  return (
                    <tr key={device.id} className="hover:bg-gray-50">
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
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${lifecycleStyles[lifecycle]}`}>
                          <LifecycleIcon className="w-3.5 h-3.5" />
                          {lifecycle === 'deployed' ? 'Deployed' : lifecycle === 'assigning' ? 'Assigning' : 'In Warehouse'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {lifecycle === 'deployed' && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {locationDisplay}
                          </span>
                        )}
                        {lifecycle === 'assigning' && (
                          <span className="text-amber-700">Ordered, not yet at site</span>
                        )}
                        {lifecycle === 'warehouse' && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-gray-400" />
                            {locationDisplay}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {client ? (
                          <span className="flex items-center gap-1 text-gray-700">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            {client.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {device.subscriptionStart && device.subscriptionEnd ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {device.subscriptionStart} → {device.subscriptionEnd}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {device.clientId && device.subscriptionEnd ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[statusType] || statusStyles.active}`}
                          >
                            {statusType === 'active' && statusLabel !== 'Upcoming' && <CheckCircle className="w-3.5 h-3.5" />}
                            {(statusType === 'warning' || statusType === 'urgent') && <AlertTriangle className="w-3.5 h-3.5" />}
                            {statusType === 'expired' && <XCircle className="w-3.5 h-3.5" />}
                            {statusType === 'upcoming' && <Clock className="w-3.5 h-3.5" />}
                            {statusLabel}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailDevice(device)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
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
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Lifecycle</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  getDeviceLifecycleStatus(detailDevice) === 'deployed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                  getDeviceLifecycleStatus(detailDevice) === 'assigning' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  'bg-slate-100 text-slate-800 border-slate-200'
                }`}>
                  {getDeviceLifecycleStatus(detailDevice) === 'deployed' ? 'Deployed' : getDeviceLifecycleStatus(detailDevice) === 'assigning' ? 'Assigning' : 'In Warehouse'}
                </span>
              </div>
              {detailDevice.brand && <div className="flex justify-between"><span className="text-gray-500">Brand</span><span className="font-medium">{detailDevice.brand}</span></div>}
              {detailDevice.size && <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="font-medium">{detailDevice.size}</span></div>}
              {detailDevice.model && <div className="flex justify-between"><span className="text-gray-500">Model</span><span className="font-medium">{detailDevice.model}</span></div>}
              {detailDevice.color && <div className="flex justify-between"><span className="text-gray-500">Color</span><span className="font-medium">{detailDevice.color}</span></div>}
              {detailDevice.gpsId && <div className="flex justify-between"><span className="text-gray-500">GPS ID</span><span className="font-medium font-mono">{detailDevice.gpsId}</span></div>}
              {detailDevice.mfgDate && <div className="flex justify-between"><span className="text-gray-500">MFG date</span><span className="font-medium">{detailDevice.mfgDate}</span></div>}
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
            <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
              Device data is synced with Client and other modules.
            </p>
          </div>
        </div>
      )}

      {/* Add device modal — multiple dropdowns, synced by product type */}
      {showAddDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAddDevice(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Add device</h3>
            <p className="text-sm text-gray-500 mb-4">Product type drives available brands and sizes. All fields can be linked to other modules.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product type *</label>
                <select
                  value={newProductType}
                  onChange={(e) => handleProductTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {Object.entries(PRODUCT_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <select
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select brand</option>
                  {brandsForNewProduct.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <select
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select size</option>
                  {sizesForNewProduct.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Sizes shown match selected product type.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="e.g. Tab S8, Frame 55"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <select
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select color</option>
                  {DEVICE_COLORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">MFG date</label>
                <input
                  type="date"
                  value={newMfgDate}
                  onChange={(e) => setNewMfgDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unique code *</label>
                <input
                  type="text"
                  value={newDeviceCode}
                  onChange={(e) => setNewDeviceCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  placeholder={suggestedCode}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Suggested: <button type="button" onClick={() => setNewDeviceCode(suggestedCode)} className="text-primary-600 hover:underline font-mono">{suggestedCode}</button>
                </p>
                {newDeviceCode && devices.some((d) => d.code === newDeviceCode.trim()) && (
                  <p className="text-xs text-red-600 mt-1">This code is already used.</p>
                )}
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
                disabled={!canAddDevice}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Devices
