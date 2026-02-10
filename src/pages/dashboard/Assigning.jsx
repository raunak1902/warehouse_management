import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Link2,
  User,
  MapPin,
  Package,
  Calendar,
  CheckCircle,
  AlertCircle,
  Search,
  Monitor,
  Tablet as TabletIcon,
  Clock,
  Building2,
  Phone,
  Mail,
  Tag,
  Eye,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  Filter,
  X,
  Layers,
} from 'lucide-react'
import { useInventory, DEVICE_TYPES } from '../../context/InventoryContext'

const DeviceTypeIcon = ({ type }) => {
  if (type === 'stand') return <Monitor className="w-4 h-4" />
  if (type === 'istand') return <Monitor className="w-4 h-4" />
  return <TabletIcon className="w-4 h-4" />
}

const Assigning = () => {
  const {
    clients,
    devices,
    getDevicesByClientId,
    assignDevicesToClient,
    getClientById,
    unassignDevice,
  } = useInventory()

  // Tab state
  const [activeTab, setActiveTab] = useState('assign') // 'assign' or 'assigned'

  // ========== ASSIGN DEVICES TAB STATE ==========
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [selectedDevices, setSelectedDevices] = useState([])
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('')
  const [selectedDeviceType, setSelectedDeviceType] = useState('all')
  const [showSuccess, setShowSuccess] = useState(false)

  // ========== ASSIGNED DEVICES TAB STATE ==========
  const [assignedSearchTerm, setAssignedSearchTerm] = useState('')
  const [assignedClientFilter, setAssignedClientFilter] = useState('all')
  const [assignedTypeFilter, setAssignedTypeFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [detailDevice, setDetailDevice] = useState(null)

  // Get available devices (not assigned to any client)
  const availableDevices = useMemo(() => {
    return devices.filter(d => !d.clientId)
  }, [devices])

  // Get assigned devices
  const assignedDevices = useMemo(() => {
    return devices.filter(d => d.clientId)
  }, [devices])

  // Filter devices based on type and search (for assignment)
  const filteredAvailableDevices = useMemo(() => {
    let filtered = availableDevices

    if (selectedDeviceType !== 'all') {
      filtered = filtered.filter(d => d.type === selectedDeviceType)
    }

    if (deviceSearchTerm.trim()) {
      const search = deviceSearchTerm.toLowerCase()
      filtered = filtered.filter(d => 
        d.code.toLowerCase().includes(search) ||
        (d.brand && d.brand.toLowerCase().includes(search)) ||
        (d.model && d.model.toLowerCase().includes(search))
      )
    }

    return filtered
  }, [availableDevices, selectedDeviceType, deviceSearchTerm])

  // Filter assigned devices
  const filteredAssignedDevices = useMemo(() => {
    let filtered = assignedDevices

    if (assignedClientFilter !== 'all') {
      filtered = filtered.filter(d => d.clientId === Number(assignedClientFilter))
    }

    if (assignedTypeFilter !== 'all') {
      filtered = filtered.filter(d => d.type === assignedTypeFilter)
    }

    if (assignedSearchTerm.trim()) {
      const search = assignedSearchTerm.toLowerCase()
      filtered = filtered.filter(d => {
        const client = getClientById(d.clientId)
        return (
          d.code.toLowerCase().includes(search) ||
          (d.brand && d.brand.toLowerCase().includes(search)) ||
          (d.model && d.model.toLowerCase().includes(search)) ||
          (client && client.name.toLowerCase().includes(search))
        )
      })
    }

    return filtered
  }, [assignedDevices, assignedClientFilter, assignedTypeFilter, assignedSearchTerm, getClientById])

  // Get unique locations from available devices
  const availableStates = useMemo(() => {
    const states = new Set()
    availableDevices.forEach(d => {
      if (d.state && d.state.trim()) {
        states.add(d.state)
      }
    })
    return Array.from(states).sort()
  }, [availableDevices])

  const availableDistricts = useMemo(() => {
    if (!selectedState) return []
    const districts = new Set()
    availableDevices.forEach(d => {
      if (d.state === selectedState && d.district && d.district.trim()) {
        districts.add(d.district)
      }
    })
    return Array.from(districts).sort()
  }, [availableDevices, selectedState])

  const availableLocations = useMemo(() => {
    if (!selectedState || !selectedDistrict) return []
    const locations = new Set()
    availableDevices.forEach(d => {
      if (d.state === selectedState && d.district === selectedDistrict && d.location && d.location.trim()) {
        locations.add(d.location)
      }
    })
    return Array.from(locations).sort()
  }, [availableDevices, selectedState, selectedDistrict])

  // Get selected client
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === Number(selectedClientId)) || null
  }, [clients, selectedClientId])

  // Toggle device selection
  const toggleDevice = (deviceId) => {
    setSelectedDevices(prev => {
      if (prev.includes(deviceId)) {
        return prev.filter(id => id !== deviceId)
      } else {
        return [...prev, deviceId]
      }
    })
  }

  // Select all filtered devices
  const selectAllFiltered = () => {
    const allIds = filteredAvailableDevices.map(d => d.id)
    setSelectedDevices(allIds)
  }

  // Clear all selections
  const clearSelection = () => {
    setSelectedDevices([])
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault()

    if (!selectedClientId || selectedDevices.length === 0 || !deliveryDate) {
      alert('Please fill all required fields')
      return
    }

    const client = clients.find(c => c.id === Number(selectedClientId))
    if (!client) {
      alert('Invalid client selected')
      return
    }

    // Assign devices to client
    assignDevicesToClient(
      Number(selectedClientId),
      selectedDevices,
      client.subscriptionStart,
      client.subscriptionEnd
    )

    // Show success message
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      // Reset form
      setSelectedClientId('')
      setSelectedState('')
      setSelectedDistrict('')
      setSelectedLocation('')
      setDeliveryDate('')
      setSelectedDevices([])
      setDeviceSearchTerm('')
      setSelectedDeviceType('all')
    }, 2000)
  }

  // Handle unassign device
  const handleUnassign = (deviceId) => {
    const device = devices.find(d => d.id === deviceId)
    const client = device ? getClientById(device.clientId) : null
    
    if (confirm(`Unassign device ${device?.code} from ${client?.name}?`)) {
      unassignDevice(deviceId)
    }
  }

  // Get device count by type
  const getDeviceCountByType = (deviceList) => {
    const counts = { stand: 0, istand: 0, tablet: 0 }
    deviceList.forEach(d => {
      if (counts[d.type] !== undefined) counts[d.type]++
    })
    return counts
  }

  const selectedDeviceObjects = devices.filter(d => selectedDevices.includes(d.id))
  const selectedCounts = getDeviceCountByType(selectedDeviceObjects)

  // Group assigned devices by client
  const devicesByClient = useMemo(() => {
    const grouped = {}
    filteredAssignedDevices.forEach(device => {
      if (!grouped[device.clientId]) {
        grouped[device.clientId] = []
      }
      grouped[device.clientId].push(device)
    })
    return grouped
  }, [filteredAssignedDevices])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 className="w-8 h-8 text-primary-600" />
          Device Assignment
        </h1>
        <p className="text-gray-600 mt-1">Assign available devices to clients and manage assigned devices</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('assign')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'assign'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-5 h-5" />
              <span>Assign Devices</span>
              <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                {availableDevices.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'assigned'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Layers className="w-5 h-5" />
              <span>Assigned Devices</span>
              <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">
                {assignedDevices.length}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Devices Assigned Successfully!</p>
              <p className="text-sm text-green-800">The devices have been assigned to the client.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ASSIGN DEVICES */}
      {activeTab === 'assign' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Client */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                1
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Select Client</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Client *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
                >
                  <option value="">Select a client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.company && `(${client.company})`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>

              {selectedClient && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span className="text-gray-700">{selectedClient.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="text-gray-700">{selectedClient.email}</span>
                    </div>
                    {selectedClient.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-700">{selectedClient.company}</span>
                      </div>
                    )}
                    {selectedClient.subscriptionStart && selectedClient.subscriptionEnd && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-700">
                          {new Date(selectedClient.subscriptionStart).toLocaleDateString()} - {new Date(selectedClient.subscriptionEnd).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Location (Optional) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">Deployment Location</h2>
                <p className="text-sm text-gray-500 mt-0.5">Optional - Can be set later</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value)
                    setSelectedDistrict('')
                    setSelectedLocation('')
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select state...</option>
                  {availableStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value)
                    setSelectedLocation('')
                  }}
                  disabled={!selectedState}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select district...</option>
                  {availableDistricts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={!selectedDistrict}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select location...</option>
                  {availableLocations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Select Devices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                3
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Select Devices</h2>
            </div>

            {/* Search and Filter */}
            <div className="space-y-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={deviceSearchTerm}
                  onChange={(e) => setDeviceSearchTerm(e.target.value)}
                  placeholder="Search by code, brand, or model..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedDeviceType('all')}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedDeviceType === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({availableDevices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDeviceType('stand')}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedDeviceType === 'stand'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  A Stand ({availableDevices.filter(d => d.type === 'stand').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDeviceType('istand')}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedDeviceType === 'istand'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  I Stand ({availableDevices.filter(d => d.type === 'istand').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDeviceType('tablet')}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedDeviceType === 'tablet'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tablet ({availableDevices.filter(d => d.type === 'tablet').length})
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="text-sm text-gray-600">
                {selectedDevices.length} device{selectedDevices.length !== 1 ? 's' : ''} selected
                {selectedDevices.length > 0 && (
                  <span className="ml-2">
                    ({selectedCounts.stand > 0 && `${selectedCounts.stand} A stand${selectedCounts.stand > 1 ? 's' : ''}`}
                    {selectedCounts.istand > 0 && `${selectedCounts.stand > 0 ? ', ' : ''}${selectedCounts.istand} I stand${selectedCounts.istand > 1 ? 's' : ''}`}
                    {selectedCounts.tablet > 0 && `${(selectedCounts.stand > 0 || selectedCounts.istand > 0) ? ', ' : ''}${selectedCounts.tablet} tablet${selectedCounts.tablet > 1 ? 's' : ''}`})
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Select All Filtered
                </button>
                {selectedDevices.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            {/* Device List */}
            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
              {filteredAvailableDevices.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No available devices found</p>
                  {deviceSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceSearchTerm('')
                        setSelectedDeviceType('all')
                      }}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredAvailableDevices.map(device => (
                    <label
                      key={device.id}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDevices.includes(device.id)}
                        onChange={() => toggleDevice(device.id)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <DeviceTypeIcon type={device.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-semibold text-gray-900">{device.code}</p>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            {DEVICE_TYPES[device.type]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {device.brand} {device.model} {device.size && `(${device.size})`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Current location: {device.location || 'Not specified'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Delivery Date */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                4
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Delivery Date</h2>
            </div>

            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Delivery Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Review Assignment</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  {selectedClient ? (
                    <>
                      <p>• Client: <span className="font-medium">{selectedClient.name}</span></p>
                      <p>• Devices: <span className="font-medium">{selectedDevices.length} selected</span></p>
                      {selectedState && selectedDistrict && selectedLocation && (
                        <p>• Location: <span className="font-medium">{selectedState}, {selectedDistrict}, {selectedLocation}</span></p>
                      )}
                      {deliveryDate && (
                        <p>• Delivery: <span className="font-medium">{new Date(deliveryDate).toLocaleDateString()}</span></p>
                      )}
                    </>
                  ) : (
                    <p className="text-amber-600">Please complete all required fields</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setSelectedClientId('')
                  setSelectedState('')
                  setSelectedDistrict('')
                  setSelectedLocation('')
                  setDeliveryDate('')
                  setSelectedDevices([])
                  setDeviceSearchTerm('')
                  setSelectedDeviceType('all')
                }}
                className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Reset Form
              </button>
              <button
                type="submit"
                disabled={!selectedClientId || selectedDevices.length === 0 || !deliveryDate}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Assign Devices to Client
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: ASSIGNED DEVICES */}
      {activeTab === 'assigned' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilters && (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={assignedSearchTerm}
                    onChange={(e) => setAssignedSearchTerm(e.target.value)}
                    placeholder="Search by device code, brand, model, or client name..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Filter dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Client</label>
                    <select
                      value={assignedClientFilter}
                      onChange={(e) => setAssignedClientFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Clients</option>
                      {clients.filter(c => getDevicesByClientId(c.id).length > 0).map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({getDevicesByClientId(client.id).length} devices)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
                    <select
                      value={assignedTypeFilter}
                      onChange={(e) => setAssignedTypeFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Types</option>
                      <option value="stand">A Stand</option>
                      <option value="istand">I Stand</option>
                      <option value="tablet">Tablet</option>
                    </select>
                  </div>
                </div>

                {/* Clear filters */}
                {(assignedSearchTerm || assignedClientFilter !== 'all' || assignedTypeFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setAssignedSearchTerm('')
                      setAssignedClientFilter('all')
                      setAssignedTypeFilter('all')
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

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">Total Assigned</div>
              <div className="text-2xl font-bold text-gray-900">{assignedDevices.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">A Stands</div>
              <div className="text-2xl font-bold text-gray-900">{assignedDevices.filter(d => d.type === 'stand').length}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">I Stands</div>
              <div className="text-2xl font-bold text-gray-900">{assignedDevices.filter(d => d.type === 'istand').length}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">Tablets</div>
              <div className="text-2xl font-bold text-gray-900">{assignedDevices.filter(d => d.type === 'tablet').length}</div>
            </div>
          </div>

          {/* Devices List */}
          {filteredAssignedDevices.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No assigned devices found</p>
              {(assignedSearchTerm || assignedClientFilter !== 'all' || assignedTypeFilter !== 'all') ? (
                <button
                  onClick={() => {
                    setAssignedSearchTerm('')
                    setAssignedClientFilter('all')
                    setAssignedTypeFilter('all')
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear filters
                </button>
              ) : (
                <p className="text-sm text-gray-400">Start by assigning devices in the "Assign Devices" tab</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(devicesByClient).map(([clientId, clientDevices]) => {
                const client = getClientById(Number(clientId))
                if (!client) return null
                
                const counts = getDeviceCountByType(clientDevices)
                
                return (
                  <div key={clientId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Client Header */}
                    <div className="bg-gradient-to-r from-primary-50 to-blue-50 p-6 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{client.name}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                            {client.company && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span>{client.company}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{client.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span>{client.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                            {clientDevices.length} device{clientDevices.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      
                      {/* Device count summary */}
                      <div className="mt-4 flex items-center gap-4 text-sm text-gray-700">
                        {counts.stand > 0 && (
                          <div className="flex items-center gap-1">
                            <Monitor className="w-4 h-4" />
                            <span>{counts.stand} A stand{counts.stand > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {counts.istand > 0 && (
                          <div className="flex items-center gap-1">
                            <Monitor className="w-4 h-4" />
                            <span>{counts.istand} I stand{counts.istand > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {counts.tablet > 0 && (
                          <div className="flex items-center gap-1">
                            <TabletIcon className="w-4 h-4" />
                            <span>{counts.tablet} tablet{counts.tablet > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Devices Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Device
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Details
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Location
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Subscription
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {clientDevices.map(device => (
                            <tr key={device.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <DeviceTypeIcon type={device.type} />
                                  <span className="font-mono font-semibold text-gray-900">{device.code}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                                  {DEVICE_TYPES[device.type]}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">{device.brand} {device.model}</div>
                                {device.size && <div className="text-xs text-gray-500">{device.size}</div>}
                              </td>
                              <td className="px-6 py-4">
                                {device.state && device.district ? (
                                  <div className="text-sm">
                                    <div className="text-gray-900">{device.state}, {device.district}</div>
                                    {device.location && <div className="text-xs text-gray-500">{device.location}</div>}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Not set</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {device.subscriptionStart && device.subscriptionEnd ? (
                                  <div className="text-xs">
                                    <div className="text-gray-700">{new Date(device.subscriptionStart).toLocaleDateString()}</div>
                                    <div className="text-gray-500">to {new Date(device.subscriptionEnd).toLocaleDateString()}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Not set</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setDetailDevice(device)}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleUnassign(device.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Unassign device"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Device Detail Modal */}
      {detailDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Device Details</h2>
                <button
                  onClick={() => setDetailDevice(null)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Device Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Device Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Device Code</p>
                    <p className="font-mono font-semibold text-gray-900">{detailDevice.code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="text-gray-900">{DEVICE_TYPES[detailDevice.type]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Brand</p>
                    <p className="text-gray-900">{detailDevice.brand || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Model</p>
                    <p className="text-gray-900">{detailDevice.model || '—'}</p>
                  </div>
                  {detailDevice.size && (
                    <div>
                      <p className="text-xs text-gray-500">Size</p>
                      <p className="text-gray-900">{detailDevice.size}</p>
                    </div>
                  )}
                  {detailDevice.color && (
                    <div>
                      <p className="text-xs text-gray-500">Color</p>
                      <p className="text-gray-900">{detailDevice.color}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Info */}
              {detailDevice.clientId && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Assigned To</h3>
                  {(() => {
                    const client = getClientById(detailDevice.clientId)
                    return client ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900 mb-2">{client.name}</p>
                        <div className="space-y-1 text-sm text-gray-600">
                          {client.company && <p>Company: {client.company}</p>}
                          <p>Phone: {client.phone}</p>
                          <p>Email: {client.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">Client not found</p>
                    )
                  })()}
                </div>
              )}

              {/* Location Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Location</h3>
                {detailDevice.state && detailDevice.district ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">State</p>
                      <p className="text-gray-900">{detailDevice.state}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">District</p>
                      <p className="text-gray-900">{detailDevice.district}</p>
                    </div>
                    {detailDevice.location && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Specific Location</p>
                        <p className="text-gray-900">{detailDevice.location}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Location not set</p>
                )}
              </div>

              {/* Subscription Info */}
              {detailDevice.subscriptionStart && detailDevice.subscriptionEnd && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Subscription Period</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Start Date</p>
                      <p className="text-gray-900">{new Date(detailDevice.subscriptionStart).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">End Date</p>
                      <p className="text-gray-900">{new Date(detailDevice.subscriptionEnd).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              {(detailDevice.gpsId || detailDevice.mfgDate) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Additional Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {detailDevice.gpsId && (
                      <div>
                        <p className="text-xs text-gray-500">GPS ID</p>
                        <p className="text-gray-900">{detailDevice.gpsId}</p>
                      </div>
                    )}
                    {detailDevice.mfgDate && (
                      <div>
                        <p className="text-xs text-gray-500">Manufacturing Date</p>
                        <p className="text-gray-900">{new Date(detailDevice.mfgDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setDetailDevice(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleUnassign(detailDevice.id)
                    setDetailDevice(null)
                  }}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Unassign Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Assigning