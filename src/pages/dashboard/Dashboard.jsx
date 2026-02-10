import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInventory } from '../../context/InventoryContext'
import { 
  ChevronDown, 
  MapPin, 
  TrendingUp,
  Package,
  Box,
  Tv,
  Smartphone,
  Battery,
  Monitor,
  Layout as LayoutIcon,
  ArrowUpRight,
  Sparkles,
  Bell,
  X,
  AlertCircle,
  AlertTriangle,
  Calendar,
  User,
  CheckCircle,
  RotateCcw,
} from 'lucide-react'

const Dashboard = ({ userRole }) => {
  const { 
    devices, 
    componentInventory, 
    statistics,
    reminders,
    dismissReminder,
    extendSubscription,
    returnDeviceFromClient,
    getClientById,
  } = useInventory()
  
  const navigate = useNavigate()
  const [selectedLocation, setSelectedLocation] = useState('Warehouse 1')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [showIndividualItems, setShowIndividualItems] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [expandedReminder, setExpandedReminder] = useState(null)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState(null)
  const [newEndDate, setNewEndDate] = useState('')

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalDevices = devices.length
    const deployedDevices = statistics?.deployedDevices || devices.filter(d => d.clientId).length
    const availableDevices = statistics?.availableDevices || (totalDevices - deployedDevices)
    
    const totalComponents = Object.values(componentInventory).reduce((sum, val) => sum + val, 0)
    const totalItems = totalDevices + totalComponents
    const estimatedCapacity = 1000
    
    const stockPercentage = Math.min(Math.round((totalItems / estimatedCapacity) * 100), 100)
    const utilizationRate = totalDevices > 0 ? Math.round((deployedDevices / totalDevices) * 100) : 0
    
    const avgDeviceCost = 500
    const avgComponentCost = 50
    const totalCost = (totalDevices * avgDeviceCost) + (totalComponents * avgComponentCost)
    
    return {
      stockPercentage,
      utilizationRate,
      totalCost,
      availableDevices,
      deployedDevices,
      totalDevices,
      totalComponents,
    }
  }, [devices, componentInventory, statistics])

  // Location options
  const locations = ['Warehouse 1', 'Warehouse 2']

  // Material categories for stock overview with clickable navigation
  const materialCategories = [
    { icon: Smartphone, label: 'Tablets', count: componentInventory.tablets, color: 'text-orange-500', bgColor: 'bg-orange-50', hoverBg: 'hover:bg-orange-100' },
    { icon: Battery, label: 'Batteries', count: componentInventory.batteries, color: 'text-blue-500', bgColor: 'bg-blue-50', hoverBg: 'hover:bg-blue-100' },
    { icon: Monitor, label: 'TVs', count: componentInventory.tvs, color: 'text-purple-500', bgColor: 'bg-purple-50', hoverBg: 'hover:bg-purple-100' },
    { icon: Tv, label: 'Media Boxes', count: componentInventory.mediaBoxes, color: 'text-green-500', bgColor: 'bg-green-50', hoverBg: 'hover:bg-green-100' },
    { icon: LayoutIcon, label: 'Stands', count: componentInventory.aFrameStands + componentInventory.iFrameStands, color: 'text-amber-500', bgColor: 'bg-amber-50', hoverBg: 'hover:bg-amber-100' },
  ]

  const individualItems = [
    { key: 'tablets', label: 'Tablets', value: componentInventory.tablets, icon: Smartphone },
    { key: 'batteries', label: 'Batteries', value: componentInventory.batteries, icon: Battery },
    { key: 'fabricationTablet', label: 'Fabrication (Tablet stand)', value: componentInventory.fabricationTablet, icon: LayoutIcon },
    { key: 'tvs', label: 'LEDs / TVs (43" or more)', value: componentInventory.tvs, icon: Monitor },
    { key: 'mediaBoxes', label: 'Media box', value: componentInventory.mediaBoxes, icon: Tv },
    { key: 'aFrameStands', label: 'A stand (fabrication)', value: componentInventory.aFrameStands, icon: LayoutIcon },
    { key: 'iFrameStands', label: 'I stand (fabrication)', value: componentInventory.iFrameStands, icon: LayoutIcon },
  ]

  const handleDeviceClick = () => {
    navigate('/dashboard/devices')
  }

  const getPriorityStyles = (priority) => {
    switch(priority) {
      case 'critical':
        return 'bg-red-50 border-red-300 text-red-900'
      case 'high':
        return 'bg-orange-50 border-orange-300 text-orange-900'
      case 'medium':
        return 'bg-yellow-50 border-yellow-300 text-yellow-900'
      default:
        return 'bg-blue-50 border-blue-300 text-blue-900'
    }
  }

  const getPriorityIcon = (priority) => {
    switch(priority) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'high':
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />
      default:
        return <Bell className="w-5 h-5 text-blue-600" />
    }
  }

  const handleExtend = () => {
    if (selectedReminder && newEndDate) {
      extendSubscription(selectedReminder.deviceId, newEndDate)
      setShowExtendModal(false)
      setSelectedReminder(null)
      setNewEndDate('')
    }
  }

  const handleReturn = (reminder) => {
    if (confirm(`Return device ${reminder.deviceCode} from ${reminder.clientName}?`)) {
      returnDeviceFromClient(reminder.deviceId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Dashboard Overview
            <Sparkles className="w-6 h-6 text-orange-500 animate-pulse" />
          </h1>
          <p className="text-gray-600 mt-1">Welcome back, {userRole}!</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Subscription Reminders Button */}
          <button
            onClick={() => setShowReminders(!showReminders)}
            className="relative flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all shadow-sm"
          >
            <Bell className={`w-5 h-5 ${reminders.length > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-500'}`} />
            <span className="text-sm font-medium text-gray-700">Reminders</span>
            {reminders.length > 0 && (
              <span className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                {reminders.length}
              </span>
            )}
          </button>

          {/* Location Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all shadow-sm"
            >
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-700">{selectedLocation}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showLocationDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                {locations.map((location) => (
                  <button
                    key={location}
                    onClick={() => {
                      setSelectedLocation(location)
                      setShowLocationDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      selectedLocation === location 
                        ? 'bg-orange-50 text-orange-600 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {location}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reminders Modal */}
      {showReminders && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-orange-600" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Subscription Reminders</h3>
                    <p className="text-sm text-gray-600">
                      {reminders.length} subscription{reminders.length !== 1 ? 's' : ''} requiring attention
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReminders(false)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-200 max-h-[calc(90vh-120px)] overflow-y-auto">
              {reminders.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No reminders at this time</p>
                </div>
              ) : (
                reminders.map(reminder => {
                  const isExpanded = expandedReminder === reminder.id
                  const client = getClientById(reminder.clientId)
                  
                  return (
                    <div 
                      key={reminder.id} 
                      className={`p-4 ${getPriorityStyles(reminder.priority)} border-l-4 transition-all`}
                    >
                      <div className="flex items-start gap-3">
                        {getPriorityIcon(reminder.priority)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">
                                {reminder.message}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-700 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Package className="w-4 h-4" />
                                  <span>{reminder.deviceCode}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <User className="w-4 h-4" />
                                  <span>{reminder.clientName}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>Ends: {new Date(reminder.endDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => setExpandedReminder(isExpanded ? null : reminder.id)}
                              className="ml-2 p-1 hover:bg-white/50 rounded transition-colors"
                            >
                              <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-300">
                              {client && (
                                <div className="mb-3 p-3 bg-white/70 rounded-lg">
                                  <p className="text-sm font-medium text-gray-900 mb-2">Client Details</p>
                                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                                    <div>Phone: {client.phone}</div>
                                    <div>Email: {client.email}</div>
                                    {client.company && <div className="col-span-2">Company: {client.company}</div>}
                                    {client.address && <div className="col-span-2">Address: {client.address}</div>}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => {
                                    setSelectedReminder(reminder)
                                    setNewEndDate('')
                                    setShowExtendModal(true)
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors min-w-[180px]"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Extend Subscription
                                </button>
                                
                                <button
                                  onClick={() => handleReturn(reminder)}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors min-w-[180px]"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  Return Device
                                </button>
                                
                                <button
                                  onClick={() => dismissReminder(reminder.id)}
                                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal */}
      {showExtendModal && selectedReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Extend Subscription</h3>
                <button
                  onClick={() => {
                    setShowExtendModal(false)
                    setSelectedReminder(null)
                    setNewEndDate('')
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Device:</span> {selectedReminder.deviceCode}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Client:</span> {selectedReminder.clientName}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Current End Date:</span> {new Date(selectedReminder.endDate).toLocaleDateString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New End Date *
                </label>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowExtendModal(false)
                    setSelectedReminder(null)
                    setNewEndDate('')
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtend}
                  disabled={!newEndDate}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Extend Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats Grid - Reorganized */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Materials in Stock - Enhanced with clickable icons */}
        <div className="lg:col-span-2 bg-gradient-to-br from-orange-50 to-white rounded-xl shadow-lg border border-orange-100 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-2 font-medium uppercase tracking-wide">Materials in Stock</p>
              <div className="flex items-baseline gap-3">
                <h3 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
                  {metrics.stockPercentage}%
                </h3>
                <span className="text-sm text-gray-500">capacity</span>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Package className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          {/* Progress Bar with Animation */}
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-6 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 transition-all duration-1000 ease-out animate-pulse"
              style={{ width: `${metrics.stockPercentage}%` }}
            />
          </div>

          {/* Clickable Device Icons */}
          <div className="grid grid-cols-5 gap-3">
            {materialCategories.map((cat, idx) => {
              const Icon = cat.icon
              return (
                <button
                  key={idx}
                  onClick={handleDeviceClick}
                  className={`${cat.bgColor} ${cat.hoverBg} rounded-xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-md border border-transparent hover:border-gray-200 group cursor-pointer`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={`w-6 h-6 ${cat.color} group-hover:scale-110 transition-transform`} />
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">{cat.count}</p>
                      <p className="text-xs text-gray-600 mt-1">{cat.label}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-3 h-3 text-gray-500" />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-orange-100">
            <p className="text-xs text-gray-500 italic">Click on any device type to view details</p>
          </div>
        </div>

        {/* Available Sets - Enhanced */}
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-lg border border-blue-100 p-6 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -mr-16 -mt-16 opacity-50"></div>
          
          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium uppercase tracking-wide">Available Sets</p>
                <h3 className="text-5xl font-bold text-blue-600">{metrics.availableDevices}</h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Box className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-gray-600">Ready to deploy</p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total devices</span>
                  <span className="text-2xl font-bold text-gray-900">{metrics.totalDevices}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total components</span>
                  <span className="text-lg font-semibold text-blue-600">{metrics.totalComponents}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deployed Sets - Full Width with Stats */}
      <div className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-lg border border-green-100 p-6 hover:shadow-xl transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Deployed Count */}
          <div className="md:col-span-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium uppercase tracking-wide">Deployed Sets</p>
                <h3 className="text-5xl font-bold text-green-600">{metrics.deployedDevices}</h3>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">Currently assigned to clients</p>
            
            <div className="pt-4 border-t border-green-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Utilization Rate</span>
                <span className="text-2xl font-bold text-green-600">{metrics.utilizationRate}%</span>
              </div>
            </div>
          </div>

          {/* Utilization Progress Bar */}
          <div className="md:col-span-2 flex flex-col justify-center">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Deployment Progress</span>
                  <span className="text-sm font-semibold text-green-600">{metrics.utilizationRate}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000 ease-out relative overflow-hidden"
                    style={{ width: `${metrics.utilizationRate}%` }}
                  >
                    <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Available</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.availableDevices}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">In Use</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.deployedDevices}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Combinations Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="text-lg font-semibold text-gray-900">Device Combinations</h3>
          <p className="text-sm text-gray-500 mt-1">Available device sets ready for deployment</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-100">
          {[
            { label: 'Tablet Combo', available: devices.filter(d => d.type === 'tablet' && !d.clientId).length, deployed: devices.filter(d => d.type === 'tablet' && d.clientId).length, color: 'orange' },
            { label: 'A-Frame Standee', available: devices.filter(d => d.type === 'stand' && !d.clientId).length, deployed: devices.filter(d => d.type === 'stand' && d.clientId).length, color: 'blue' },
            { label: 'I-Frame Standee', available: devices.filter(d => d.type === 'istand' && !d.clientId).length, deployed: devices.filter(d => d.type === 'istand' && d.clientId).length, color: 'purple' },
          ].map((combo, idx) => (
            <div key={idx} className="p-6 hover:bg-gray-50 transition-colors group">
              <p className="text-sm text-gray-600 mb-3 font-medium">{combo.label}</p>
              <div className="flex items-baseline gap-3 mb-4">
                <h3 className={`text-4xl font-bold text-${combo.color}-600 group-hover:scale-105 transition-transform`}>
                  {combo.available}
                </h3>
                <span className="text-sm text-gray-500">available</span>
              </div>
              <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Deployed</span>
                <span className={`font-bold text-${combo.color}-600 text-lg`}>{combo.deployed}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Components - Collapsible */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
        <button
          onClick={() => setShowIndividualItems(!showIndividualItems)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
        >
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Individual Components Stock</h3>
            <p className="text-sm text-gray-500 mt-1">Raw inventory breakdown</p>
          </div>
          <ChevronDown 
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${showIndividualItems ? 'rotate-180' : ''}`} 
          />
        </button>
        
        {showIndividualItems && (
          <div className="border-t border-gray-100 p-6 bg-gradient-to-b from-gray-50 to-white animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {individualItems.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.key}
                    className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-orange-400 hover:shadow-lg transition-all duration-300 hover:scale-105 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                        <Icon className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">units</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">{item.value}</p>
                    <p className="text-xs text-gray-600 truncate">{item.label}</p>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-6 flex items-center gap-4 flex-wrap">
              <Link
                to="/dashboard/devices"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium shadow-md hover:shadow-lg"
              >
                <Package className="w-4 h-4" />
                Manage Inventory
              </Link>
              <Link
                to="/dashboard/client"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-orange-300 transition-all font-medium"
              >
                <TrendingUp className="w-4 h-4" />
                Assign to Client
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard