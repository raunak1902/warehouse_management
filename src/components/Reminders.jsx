import { useState } from 'react'
import { 
  Bell, 
  X, 
  AlertTriangle, 
  AlertCircle, 
  Calendar,
  User,
  Package,
  CheckCircle,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import { useInventory } from '../context/InventoryContext'

const Reminders = () => {
  const { 
    reminders, 
    dismissReminder, 
    extendSubscription,
    returnDeviceFromClient,
    getClientById,
  } = useInventory()

  const [expandedReminder, setExpandedReminder] = useState(null)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState(null)
  const [newEndDate, setNewEndDate] = useState('')

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

  if (reminders.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-orange-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Subscription Reminders</h3>
              <p className="text-sm text-gray-600">
                {reminders.length} subscription{reminders.length !== 1 ? 's' : ''} requiring attention
              </p>
            </div>
            <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">
              {reminders.filter(r => r.priority === 'critical').length}
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {reminders.map(reminder => {
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
                        <div className="flex items-center gap-4 text-sm text-gray-700">
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
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedReminder(reminder)
                              setNewEndDate('')
                              setShowExtendModal(true)
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Extend Subscription
                          </button>
                          
                          <button
                            onClick={() => handleReturn(reminder)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
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
          })}
        </div>
      </div>

      {/* Extend Subscription Modal */}
      {showExtendModal && selectedReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
    </div>
  )
}

export default Reminders
