import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin,
  Search,
  Filter,
  Package,
  Truck,
  LayoutGrid,
  Monitor,
  Tablet,
  Users,
  Smartphone,
  ChevronRight,
  X,
  Building2,
  MapPinned,
} from 'lucide-react'
import {
  useInventory,
  getSubscriptionFilterStatus,
  getSubscriptionStatus,
} from '../../context/InventoryContext'
import { LEGACY_DEVICE_TYPES } from '../../config/deviceConfig'

const VIEW_OPTIONS = [
  { value: 'all', label: 'All', icon: MapPinned },
  { value: 'stock', label: 'In Stock', icon: Package },
  { value: 'deployed', label: 'Deployed', icon: Truck },
]

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  upcoming: 'bg-sky-100 text-sky-800 border-sky-200',
  warehouse: 'bg-slate-100 text-slate-800 border-slate-200',
}

function getDeviceTypeLabel(type) {
  return LEGACY_DEVICE_TYPES[type] || type || '—'
}

const DeviceTypeIcon = ({ type }) => {
  if (type === 'stand') return <LayoutGrid className="w-4 h-4" />
  if (type === 'istand') return <Monitor className="w-4 h-4" />
  return <Tablet className="w-4 h-4" />
}

const Location = () => {
  const {
    getLocationHierarchy,
    getLocationSummary,
    getDevicesByLocation,
    getClientById,
  } = useInventory()

  const [filterState, setFilterState] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterPinpoint, setFilterPinpoint] = useState('')
  const [viewMode, setViewMode] = useState('all') // all | stock | deployed
  const [selectedLocation, setSelectedLocation] = useState(null) // { state, district, location }
  const [searchLocation, setSearchLocation] = useState('')

  // Transform the hierarchy data into the format we need
  const hierarchy = useMemo(() => {
    const rawHierarchy = getLocationHierarchy()
    
    // Build the proper structure
    const states = Object.keys(rawHierarchy).sort()
    const districtsByState = {}
    const locationsByStateDistrict = {}
    
    states.forEach(state => {
      const districts = Object.keys(rawHierarchy[state]).sort()
      districtsByState[state] = districts
      
      districts.forEach(district => {
        const key = `${state}|${district}`
        locationsByStateDistrict[key] = Object.keys(rawHierarchy[state][district]).sort()
      })
    })
    
    return {
      states,
      districtsByState,
      locationsByStateDistrict
    }
  }, [getLocationHierarchy])

  const fullSummary = useMemo(() => getLocationSummary(), [getLocationSummary])

  const filteredSummary = useMemo(() => {
    let list = fullSummary
    if (filterState) list = list.filter((r) => r.state === filterState)
    if (filterDistrict) list = list.filter((r) => r.district === filterDistrict)
    if (filterPinpoint) list = list.filter((r) => r.location === filterPinpoint)
    if (viewMode === 'stock') list = list.filter((r) => r.inStock > 0)
    if (viewMode === 'deployed') list = list.filter((r) => r.deployed > 0)
    if (searchLocation) {
      const q = searchLocation.toLowerCase()
      list = list.filter(
        (r) =>
          (r.state && r.state.toLowerCase().includes(q)) ||
          (r.district && r.district.toLowerCase().includes(q)) ||
          (r.location && r.location.toLowerCase().includes(q))
      )
    }
    return list
  }, [fullSummary, filterState, filterDistrict, filterPinpoint, viewMode, searchLocation])

  const isWarehouseFilter = filterState === 'Warehouse'
  const districts = filterState ? (hierarchy.districtsByState[filterState] || []) : []
  const locationsKey = isWarehouseFilter ? 'Warehouse|' : (filterState && filterDistrict ? `${filterState}|${filterDistrict}` : '')
  const pinpoints = locationsKey ? (hierarchy.locationsByStateDistrict[locationsKey] || []) : []

  const devicesAtSelected = useMemo(() => {
    if (!selectedLocation) return []
    return getDevicesByLocation(
      selectedLocation.state,
      selectedLocation.district,
      selectedLocation.location
    )
  }, [selectedLocation, getDevicesByLocation])

  const selectedLocationLabel = selectedLocation
    ? selectedLocation.state === 'Warehouse'
      ? selectedLocation.location
      : [selectedLocation.state, selectedLocation.district, selectedLocation.location].filter(Boolean).join(' → ')
    : ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-8 h-8 text-primary-600" />
          Location
        </h1>
        <p className="text-gray-600 mt-1">
          View inventory by location: filter by state, district, or site. See what’s in stock vs deployed and drill down to devices and clients.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
          <Filter className="w-5 h-5 text-primary-600" />
          Filters
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex items-center gap-2 min-w-[200px]">
            <label className="text-sm text-gray-600 whitespace-nowrap">State</label>
            <select
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value)
                setFilterDistrict('')
                setFilterPinpoint('')
              }}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All states</option>
              {hierarchy.states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {!isWarehouseFilter && (
            <div className="flex items-center gap-2 min-w-[180px]">
              <label className="text-sm text-gray-600 whitespace-nowrap">District</label>
              <select
                value={filterDistrict}
                onChange={(e) => {
                  setFilterDistrict(e.target.value)
                  setFilterPinpoint('')
                }}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 min-w-[200px]">
            <label className="text-sm text-gray-600 whitespace-nowrap">{isWarehouseFilter ? 'Warehouse' : 'Site / Pinpoint'}</label>
            <select
              value={filterPinpoint}
              onChange={(e) => setFilterPinpoint(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All {isWarehouseFilter ? 'warehouses' : 'sites'}</option>
              {pinpoints.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">View:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              {VIEW_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setViewMode(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                      viewMode === opt.value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex-1 min-w-[180px] flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search state, district, or site..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Location summary table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            Inventory by location
          </h2>
          <span className="text-sm text-gray-500">
            {filteredSummary.length} location{filteredSummary.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">State</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">District</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Site / Location</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Total</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">In stock</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Deployed</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No locations match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSummary.map((row) => {
                  const key = `${row.state}|${row.district}|${row.location}`
                  const isSelected =
                    selectedLocation &&
                    selectedLocation.state === row.state &&
                    selectedLocation.district === row.district &&
                    selectedLocation.location === row.location
                  return (
                    <tr
                      key={key}
                      className={`border-b border-gray-100 hover:bg-gray-50/80 ${
                        isSelected ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.state}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.district}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.location}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{row.total}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                          <Package className="w-3.5 h-3.5" />
                          {row.inStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                          <Truck className="w-3.5 h-3.5" />
                          {row.deployed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedLocation({
                              state: row.state,
                              district: row.state === 'Warehouse' || row.district === '—' ? '' : row.district,
                              location: row.location,
                            })
                          }
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          View devices
                          <ChevronRight className="w-4 h-4" />
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

      {/* Selected location: devices and client info */}
      {selectedLocation && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
              <MapPinned className="w-5 h-5 text-primary-600" />
              Devices at: {selectedLocationLabel}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedLocation(null)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Code</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Brand / Model</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Subscription</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devicesAtSelected.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No devices at this location.
                    </td>
                  </tr>
                ) : (
                  devicesAtSelected.map((d) => {
                    const client = d.clientId ? getClientById(d.clientId) : null
                    const subStatus = d.subscriptionEnd
                      ? getSubscriptionStatus(d.subscriptionEnd)
                      : { label: 'In warehouse', type: 'warehouse' }
                    return (
                      <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-gray-900">{d.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                            <DeviceTypeIcon type={d.type} />
                            {getDeviceTypeLabel(d.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {[d.brand, d.model].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {client ? (
                            <Link
                              to="/dashboard/client"
                              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                              <Users className="w-4 h-4" />
                              {client.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {d.subscriptionStart && d.subscriptionEnd
                            ? `${d.subscriptionStart} → ${d.subscriptionEnd}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[subStatus.type] || statusStyles.warehouse}`}
                          >
                            {subStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to="/dashboard/devices"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                          >
                            <Smartphone className="w-4 h-4" />
                            Open in Devices
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedLocation && filteredSummary.length > 0 && (
        <p className="text-sm text-gray-500">
          Click &quot;View devices&quot; on a row to see all devices at that location and their linked clients.
        </p>
      )}
    </div>
  )
}

export default Location