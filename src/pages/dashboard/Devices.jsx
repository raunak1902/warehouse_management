import { useState } from 'react'
import {
  Smartphone,
  LayoutGrid,
  Monitor,
  Tablet as TabletIcon,
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
} from 'lucide-react'
import {
  useInventory,
  DEVICE_TYPES,
  DEVICE_CODE_PREFIX,
  getSubscriptionFilterStatus,
  getSubscriptionStatus,
} from '../../context/InventoryContext'

const FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'upcoming', label: 'Upcoming' },
]

const TYPE_CONFIG = {
  stand: { icon: LayoutGrid, label: 'A stand', key: 'stand' },
  istand: { icon: Monitor, label: 'I stand', key: 'istand' },
  tablet: { icon: TabletIcon, label: 'Tablet', key: 'tablet' },
}

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  upcoming: 'bg-sky-100 text-sky-800 border-sky-200',
}

const COMPONENT_LABELS = {
  tablets: 'Tablets',
  batteries: 'Batteries',
  fabricationTablet: 'Fabrication (Tablet stand)',
  tvs: 'LEDs / TVs (43" or more)',
  mediaBoxes: 'Media box',
  aFrameStands: 'A stand (fabrication)',
  iFrameStands: 'I stand (fabrication)',
}

const Devices = () => {
  const { devices, getClientById, getDevicesByType, addDevice, componentInventory, updateComponentInventory } = useInventory()
  const [statusFilter, setStatusFilter] = useState('active')
  const [showComponentStock, setShowComponentStock] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [searchCode, setSearchCode] = useState('')
  const [detailDevice, setDetailDevice] = useState(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [newDeviceCode, setNewDeviceCode] = useState('')
  const [newDeviceType, setNewDeviceType] = useState('stand')

  const suggestedCode = (() => {
    const prefix = DEVICE_CODE_PREFIX[newDeviceType]
    const existing = devices.filter((d) => d.type === newDeviceType && d.code.startsWith(prefix))
    const nums = existing.map((d) => parseInt(d.code.replace(prefix + '-', ''), 10)).filter((n) => !isNaN(n))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `${prefix}-${String(next).padStart(3, '0')}`
  })()

  const getDevicesForFilter = (type) => {
    const list = type ? getDevicesByType(type) : devices
    return list.filter((d) => {
      const status = getSubscriptionFilterStatus(d.subscriptionStart, d.subscriptionEnd)
      if (d.clientId) return status === statusFilter
      if (statusFilter === 'active') return true
      return false
    })
  }

  const counts = {
    stand: getDevicesByType('stand').length,
    istand: getDevicesByType('istand').length,
    tablet: getDevicesByType('tablet').length,
  }

  const filteredDevices = selectedType
    ? getDevicesForFilter(selectedType).filter((d) =>
        d.code.toLowerCase().includes(searchCode.toLowerCase())
      )
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-8 h-8 text-primary-600" />
            Devices
          </h1>
          <p className="text-gray-600 mt-1">
            Track devices by unique code (QR/alphanumeric). A stand, I stand, Tablet — click a type to see details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddDevice(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {/* Component stock (drives dashboard available sets) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowComponentStock(!showComponentStock)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-900">Component stock (for dashboard sets)</span>
          <ChevronRight
            className={`w-5 h-5 text-gray-500 transition-transform ${showComponentStock ? 'rotate-90' : ''}`}
          />
        </button>
        {showComponentStock && (
          <div className="border-t border-gray-200 p-4 bg-gray-50/50">
            <p className="text-sm text-gray-600 mb-4">
              Update individual item counts. Dashboard &quot;Available&quot; sets are calculated from these (min of components per combination).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Object.entries(COMPONENT_LABELS).map(([key, label]) => (
                <div key={key} className="bg-white rounded-lg border border-gray-200 p-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={componentInventory[key] ?? 0}
                    onChange={(e) =>
                      updateComponentInventory({ [key]: Math.max(0, parseInt(e.target.value, 10) || 0) })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter: Active / Expired / Upcoming */}
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-sm font-medium text-gray-700">Subscription:</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === opt.value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3 product types with counts — click to show details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.entries(TYPE_CONFIG)).map(([typeKey, config]) => {
          const Icon = config.icon
          const count = counts[typeKey] || 0
          const isSelected = selectedType === typeKey
          const matchingCount = getDevicesForFilter(typeKey).length
          return (
            <button
              key={typeKey}
              type="button"
              onClick={() => setSelectedType(isSelected ? null : typeKey)}
              className={`rounded-xl border-2 p-6 text-left transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary-100 text-primary-600">
                    <Icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{config.label}</h2>
                    <p className="text-2xl font-bold text-primary-600">{count}</p>
                    <p className="text-xs text-gray-500">
                      {matchingCount} {statusFilter}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-6 h-6 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Device list when a type is selected */}
      {selectedType && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
            <h3 className="font-semibold text-gray-900">
              {TYPE_CONFIG[selectedType].label} — device list
            </h3>
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
            <button
              type="button"
              onClick={() => setSelectedType(null)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned to</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Subscription</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No devices match. Try another filter or product type.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => {
                    const client = device.clientId ? getClientById(device.clientId) : null
                    const subStatus = device.subscriptionStart && device.subscriptionEnd
                      ? getSubscriptionStatus(device.subscriptionEnd)
                      : { type: 'active', label: 'Available' }
                    const filterStatus = getSubscriptionFilterStatus(
                      device.subscriptionStart,
                      device.subscriptionEnd
                    )
                    const statusLabel =
                      !device.clientId
                        ? 'Available'
                        : filterStatus === 'upcoming'
                        ? 'Upcoming'
                        : subStatus.label
                    const statusType = !device.clientId ? 'active' : subStatus.type === 'expired' ? 'expired' : filterStatus === 'upcoming' ? 'upcoming' : subStatus.type
                    return (
                      <tr key={device.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 font-mono font-medium text-gray-900">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            {device.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {DEVICE_TYPES[device.type]}
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
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusStyles[statusType] || statusStyles.active}`}
                          >
                            {statusType === 'active' && (statusLabel === 'Available' ? null : <CheckCircle className="w-3.5 h-3.5" />)}
                            {(statusType === 'warning' || statusType === 'urgent') && <AlertTriangle className="w-3.5 h-3.5" />}
                            {statusType === 'expired' && <XCircle className="w-3.5 h-3.5" />}
                            {statusType === 'upcoming' && <Clock className="w-3.5 h-3.5" />}
                            {statusLabel}
                          </span>
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
      )}

      {/* Device detail modal — same data as in Client */}
      {detailDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDetailDevice(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-100">
                  <QrCode className="w-8 h-8 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 font-mono">{detailDevice.code}</h2>
                  <p className="text-gray-600">{DEVICE_TYPES[detailDevice.type]}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailDevice(null)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium">{DEVICE_TYPES[detailDevice.type]}</span>
              </div>
              {detailDevice.clientId ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assigned to</span>
                    <span className="font-medium">
                      {getClientById(detailDevice.clientId)?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subscription</span>
                    <span className="font-medium">
                      {detailDevice.subscriptionStart} → {detailDevice.subscriptionEnd}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Status</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        statusStyles[
                          getSubscriptionStatus(detailDevice.subscriptionEnd).type
                        ]
                      }`}
                    >
                      {getSubscriptionStatus(detailDevice.subscriptionEnd).label}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Available
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
              This device is linked with the same details shown in the Client module.
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
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add device</h3>
            <p className="text-sm text-gray-500 mb-4">Each device has a unique alphanumeric code for tracking.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product type *</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => {
                    setNewDeviceType(e.target.value)
                    setNewDeviceCode('')
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="stand">A stand (ATV-xxx)</option>
                  <option value="istand">I stand (ITV-xxx)</option>
                  <option value="tablet">Tablet (TAB-xxx)</option>
                </select>
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
                {devices.some((d) => d.code === newDeviceCode) && newDeviceCode && (
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
                onClick={() => {
                  const code = newDeviceCode.trim()
                  if (!code || devices.some((d) => d.code === code)) return
                  addDevice({ code, type: newDeviceType })
                  setNewDeviceCode('')
                  setNewDeviceType('stand')
                  setShowAddDevice(false)
                }}
                disabled={!newDeviceCode.trim() || devices.some((d) => d.code === newDeviceCode.trim())}
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
