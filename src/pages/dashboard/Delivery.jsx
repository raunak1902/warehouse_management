import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Truck,
  Package,
  Calendar,
  MapPin,
  User,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Edit,
  Navigation,
  Building2,
  Mail,
  ClipboardCheck,
  PackageCheck,
  TrendingUp,
  Timer,
  X,
  Monitor,
  Tablet as TabletIcon,
} from 'lucide-react'
import { useInventory, DEVICE_TYPES } from '../../context/InventoryContext'

const DELIVERY_STATUS = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_transit: { label: 'In Transit', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 border-red-200' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 border-gray-200' },
}

const DeviceTypeIcon = ({ type }) => {
  if (type === 'stand') return <Monitor className="w-4 h-4" />
  if (type === 'istand') return <Monitor className="w-4 h-4" />
  return <TabletIcon className="w-4 h-4" />
}

const Delivery = () => {
  const {
    devices,
    clients,
    getClientById,
    getDevicesByClientId,
  } = useInventory()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Generate mock delivery data from assigned devices
  const deliveries = useMemo(() => {
    const assignedDevices = devices.filter(d => d.clientId)
    const deliveryMap = new Map()

    assignedDevices.forEach(device => {
      const clientId = device.clientId
      if (!deliveryMap.has(clientId)) {
        const client = getClientById(clientId)
        if (client) {
          const statuses = ['pending', 'scheduled', 'in_transit', 'delivered']
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]
          
          const baseDate = new Date()
          const daysOffset = Math.floor(Math.random() * 14) - 7
          const deliveryDate = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000)
          
          deliveryMap.set(clientId, {
            id: clientId,
            client: client,
            devices: [],
            status: randomStatus,
            scheduledDate: deliveryDate.toISOString().split('T')[0],
            deliveryTime: '10:00 AM - 12:00 PM',
            address: client.address || 'Address not specified',
            notes: '',
            trackingNumber: `TRK${String(clientId).padStart(6, '0')}`,
            driverName: randomStatus === 'in_transit' || randomStatus === 'delivered' ? 'John Doe' : null,
            driverPhone: randomStatus === 'in_transit' || randomStatus === 'delivered' ? '+1 555-0123' : null,
            deliveredAt: randomStatus === 'delivered' ? new Date(deliveryDate.getTime() - 2 * 60 * 60 * 1000).toISOString() : null,
          })
        }
      }
      
      if (deliveryMap.has(clientId)) {
        deliveryMap.get(clientId).devices.push(device)
      }
    })

    return Array.from(deliveryMap.values())
  }, [devices, getClientById])

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    let filtered = deliveries

    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter)
    }

    if (dateFilter !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      filtered = filtered.filter(d => {
        const deliveryDate = new Date(d.scheduledDate)
        deliveryDate.setHours(0, 0, 0, 0)
        
        if (dateFilter === 'today') {
          return deliveryDate.getTime() === today.getTime()
        } else if (dateFilter === 'week') {
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          return deliveryDate >= today && deliveryDate <= weekFromNow
        } else if (dateFilter === 'month') {
          const monthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
          return deliveryDate >= today && deliveryDate <= monthFromNow
        }
        return true
      })
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(d =>
        d.client.name.toLowerCase().includes(search) ||
        d.trackingNumber.toLowerCase().includes(search) ||
        (d.client.company && d.client.company.toLowerCase().includes(search)) ||
        d.address.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [deliveries, statusFilter, dateFilter, searchTerm])

  // Statistics
  const stats = useMemo(() => {
    return {
      total: deliveries.length,
      pending: deliveries.filter(d => d.status === 'pending').length,
      scheduled: deliveries.filter(d => d.status === 'scheduled').length,
      in_transit: deliveries.filter(d => d.status === 'in_transit').length,
      delivered: deliveries.filter(d => d.status === 'delivered').length,
      failed: deliveries.filter(d => d.status === 'failed').length,
      totalDevices: deliveries.reduce((sum, d) => sum + d.devices.length, 0),
    }
  }, [deliveries])

  // Get device count by type
  const getDeviceCountByType = (deviceList) => {
    const counts = { stand: 0, istand: 0, tablet: 0 }
    deviceList.forEach(d => {
      if (counts[d.type] !== undefined) counts[d.type]++
    })
    return counts
  }

  // Format delivery date
  const formatDeliveryDate = (dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deliveryDate = new Date(date)
    deliveryDate.setHours(0, 0, 0, 0)
    
    const diffDays = Math.floor((deliveryDate - today) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-600" />
      case 'scheduled': return <Calendar className="w-5 h-5 text-blue-600" />
      case 'in_transit': return <Truck className="w-5 h-5 text-purple-600" />
      case 'delivered': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />
      default: return <Package className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-8 h-8 text-primary-600" />
          Delivery Management
        </h1>
        <p className="text-gray-600 mt-1">Track and manage device deliveries to clients</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-gray-600" />
            <span className="text-xs text-gray-500">Total</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">{stats.totalDevices} devices</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-xs text-gray-500">Pending</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-gray-500">Scheduled</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <span className="text-xs text-gray-500">In Transit</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{stats.in_transit}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-xs text-gray-500">Delivered</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-xs text-gray-500">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters & Search</h3>
          </div>
          <ChevronDown 
            className={`w-5 h-5 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>

        {showFilters && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by client name, tracking number, company, or address..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">Next 7 Days</option>
                  <option value="month">Next 30 Days</option>
                </select>
              </div>
            </div>

            {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setDateFilter('all')
                }}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <X className="w-4 h-4" />
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Deliveries List */}
      {filteredDeliveries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No deliveries found</p>
          {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') ? (
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setDateFilter('all')
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear filters
            </button>
          ) : (
            <p className="text-sm text-gray-400">Devices assigned to clients will appear here</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeliveries.map((delivery) => {
            const counts = getDeviceCountByType(delivery.devices)
            
            return (
              <div key={delivery.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{delivery.client.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${DELIVERY_STATUS[delivery.status].color}`}>
                          {DELIVERY_STATUS[delivery.status].label}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{delivery.trackingNumber}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatDeliveryDate(delivery.scheduledDate)} • {delivery.deliveryTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{delivery.client.phone}</span>
                        </div>
                      </div>

                      {delivery.address && (
                        <div className="flex items-start gap-2 text-sm text-gray-600 mt-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span>{delivery.address}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedDelivery(delivery)
                        setShowDetailModal(true)
                      }}
                      className="ml-4 p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 py-3 px-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Package className="w-4 h-4" />
                      <span className="font-medium">{delivery.devices.length} device{delivery.devices.length !== 1 ? 's' : ''}</span>
                    </div>
                    {counts.stand > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Monitor className="w-4 h-4" />
                        <span>{counts.stand} A stand{counts.stand > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {counts.istand > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Monitor className="w-4 h-4" />
                        <span>{counts.istand} I stand{counts.istand > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {counts.tablet > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <TabletIcon className="w-4 h-4" />
                        <span>{counts.tablet} tablet{counts.tablet > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {delivery.driverName && (
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>Driver: <span className="font-medium">{delivery.driverName}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{delivery.driverPhone}</span>
                      </div>
                    </div>
                  )}

                  {delivery.deliveredAt && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-green-900">
                        <CheckCircle className="w-4 h-4" />
                        <span>Delivered on {new Date(delivery.deliveredAt).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Delivery Details</h2>
                  <p className="text-sm text-gray-600 mt-1">Tracking #{selectedDelivery.trackingNumber}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedDelivery(null)
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Delivery Status</h3>
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedDelivery.status)}
                  <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${DELIVERY_STATUS[selectedDelivery.status].color}`}>
                    {DELIVERY_STATUS[selectedDelivery.status].label}
                  </span>
                </div>
              </div>

              {/* Client Information */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Client Information</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-900 mb-3">{selectedDelivery.client.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {selectedDelivery.client.company && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span>{selectedDelivery.client.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span>{selectedDelivery.client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>{selectedDelivery.client.email}</span>
                    </div>
                    <div className="flex items-start gap-2 text-gray-700 col-span-2">
                      <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>{selectedDelivery.address}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Schedule */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Delivery Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Scheduled Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{new Date(selectedDelivery.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Time Slot</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{selectedDelivery.deliveryTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Driver Information */}
              {selectedDelivery.driverName && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Driver Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Driver Name</p>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{selectedDelivery.driverName}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact Number</p>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{selectedDelivery.driverPhone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Devices */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Devices ({selectedDelivery.devices.length})</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand & Model</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedDelivery.devices.map(device => (
                        <tr key={device.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <DeviceTypeIcon type={device.type} />
                              <span className="font-mono text-sm font-medium text-gray-900">{device.code}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {DEVICE_TYPES[device.type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {device.brand} {device.model}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {device.size || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivered Info */}
              {selectedDelivery.deliveredAt && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Delivery Confirmation</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">Successfully Delivered</p>
                        <p className="text-sm text-green-700 mt-1">
                          {new Date(selectedDelivery.deliveredAt).toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedDelivery(null)
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Track on Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Delivery