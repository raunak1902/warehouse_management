import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { deviceApi } from '../api/deviceApi'

// Product types we rent
export const DEVICE_TYPES = {
  stand: 'A stand',
  istand: 'I stand',
  tablet: 'Tablet',
}

// Lifecycle statuses
export const DEVICE_LIFECYCLE = {
  warehouse: 'In Warehouse',
  deployed: 'Deployed',
  out_of_warehouse: 'Out of Warehouse',
}

// Subscription filter: Active (current), Expired (past), Upcoming (future)
export const getSubscriptionFilterStatus = (startStr, endStr) => {
  if (!startStr || !endStr) return 'active'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startStr)
  const end = new Date(endStr)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (today > end) return 'expired'
  if (today < start) return 'upcoming'
  return 'active'
}

// For alerts: days until end
export const getDaysUntilEnd = (endDateStr) => {
  const end = new Date(endDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24))
}

export const getSubscriptionStatus = (endDateStr) => {
  const days = getDaysUntilEnd(endDateStr)
  if (days < 0) return { label: 'Expired', type: 'expired', days }
  if (days <= 7) return { label: 'Expiring soon', type: 'urgent', days }
  if (days <= 30) return { label: 'Expiring in 30 days', type: 'warning', days }
  return { label: 'Active', type: 'active', days }
}

// Demo clients data (keep this for now until clients are also in backend)
const defaultClients = [
  {
    id: 1,
    name: 'Acme Corp',
    phone: '+1 555-0101',
    email: 'contact@acme.com',
    company: 'Acme Corporation',
    address: '123 Business Ave, City',
    notes: 'Premium plan',
    subscriptionStart: '2024-06-01',
    subscriptionEnd: '2025-06-01',
  },
  {
    id: 2,
    name: 'John Smith',
    phone: '+1 555-0202',
    email: 'john@example.com',
    company: 'Smith & Co',
    address: '456 Main St',
    notes: '',
    subscriptionStart: '2024-12-01',
    subscriptionEnd: '2025-02-15',
  },
  {
    id: 3,
    name: 'Retail Plus',
    phone: '+1 555-0303',
    email: 'info@retailplus.com',
    company: 'Retail Plus Ltd',
    address: '789 Mall Road',
    notes: 'Bulk devices',
    subscriptionStart: '2024-09-01',
    subscriptionEnd: '2025-01-20',
  },
  {
    id: 4,
    name: 'Mac D',
    phone: '+1 555-0404',
    email: 'orders@macd.com',
    company: 'Mac D',
    address: '100 Food Lane',
    notes: '',
    subscriptionStart: '2024-11-01',
    subscriptionEnd: '2025-05-01',
  },
]

// Code prefixes: A stand (TV) = ATV, I stand (TV) = ITV, Tablet = TAB
export const DEVICE_CODE_PREFIX = { stand: 'ATV', istand: 'ITV', tablet: 'TAB' }

// Device lifecycle: In warehouse (Warehouse A/B/C) | Assigning (ordered, not yet deployed) | Deployed (at client location)
export const getDeviceLifecycleStatus = (device) => {
  // Check lifecycleStatus field from database
  if (device.lifecycleStatus) {
    return device.lifecycleStatus
  }
  
  // Fallback logic for backward compatibility
  if (!device.clientId) return 'warehouse'
  if (device.clientId && !device.state && !device.district && !device.pinpoint) return 'assigning'
  if (device.clientId && (device.state || device.district || device.pinpoint)) return 'deployed'
  return 'warehouse'
}

const InventoryContext = createContext()

export const useInventory = () => {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider')
  }
  return context
}

export const InventoryProvider = ({ children }) => {
  // State
  const [devices, setDevices] = useState([])
  const [clients, setClients] = useState(defaultClients)
  const [reminders, setReminders] = useState([])
  const [deviceSets, setDeviceSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Component inventory (static for now - can be moved to backend later)
  const [componentInventory] = useState({
    tvs: 50,
    mediaBoxes: 50,
    aFrameStands: 25,
    iFrameStands: 25,
    tablets: 30,
    batteries: 30,
    fabricationTablet: 30,
  })

  // ==========================================
  // LOAD DEVICES FROM BACKEND ON MOUNT
  // ==========================================
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true)
        setError(null)
        const fetchedDevices = await deviceApi.getAll()
        setDevices(fetchedDevices)
      } catch (err) {
        console.error('Error loading devices:', err)
        setError('Failed to load devices. Please check your connection.')
      } finally {
        setLoading(false)
      }
    }

    loadDevices()
  }, [])

  // ==========================================
  // DEVICE CRUD OPERATIONS
  // ==========================================

  // Add new device
  const addDevice = useCallback(async (deviceData) => {
    try {
      const newDevice = await deviceApi.create({
        code: deviceData.code.toUpperCase(),
        type: deviceData.type,
        brand: deviceData.brand || null,
        size: deviceData.size || null,
        model: deviceData.model || null,
        color: deviceData.color || null,
        gpsId: deviceData.gpsId || null,
        mfgDate: deviceData.mfgDate || null,
        lifecycleStatus: deviceData.lifecycleStatus || 'warehouse',
        location: deviceData.location || null,
        state: deviceData.state || null,
        district: deviceData.district || null,
        pinpoint: deviceData.pinpoint || null,
        clientId: deviceData.clientId || null,
      })

      // Update local state
      setDevices(prev => [...prev, newDevice])
      return newDevice
    } catch (err) {
      console.error('Error adding device:', err)
      throw new Error(err.response?.data?.error || 'Failed to add device')
    }
  }, [])

  // Bulk add devices — same type, shared fields, system auto-generates N codes + barcodes
  const bulkAddDevices = useCallback(async (bulkData) => {
    try {
      const result = await deviceApi.bulkCreate(bulkData)
      // Append all new devices to local state
      setDevices(prev => [...prev, ...result.devices])
      return result
    } catch (err) {
      console.error('Error bulk adding devices:', err)
      throw new Error(err.response?.data?.error || 'Failed to bulk add devices')
    }
  }, [])

  // Update device
  const updateDevice = useCallback(async (deviceId, updates) => {
    try {
      const updatedDevice = await deviceApi.update(deviceId, updates)
      
      // Update local state
      setDevices(prev => 
        prev.map(d => d.id === deviceId ? updatedDevice : d)
      )
      return updatedDevice
    } catch (err) {
      console.error('Error updating device:', err)
      throw new Error(err.response?.data?.error || 'Failed to update device')
    }
  }, [])

  // Delete device
  const removeDevice = useCallback(async (deviceId) => {
    try {
      await deviceApi.delete(deviceId)
      
      // Update local state
      setDevices(prev => prev.filter(d => d.id !== deviceId))
    } catch (err) {
      console.error('Error deleting device:', err)
      throw new Error(err.response?.data?.error || 'Failed to delete device')
    }
  }, [])

  // Assign device to client
  const assignDeviceToClient = useCallback(async (deviceId, clientId, deploymentData = {}) => {
    try {
      const updates = {
        clientId: clientId,
        lifecycleStatus: deploymentData.lifecycleStatus || 'assigning',
        state: deploymentData.state || null,
        district: deploymentData.district || null,
        pinpoint: deploymentData.pinpoint || null,
      }

      return await updateDevice(deviceId, updates)
    } catch (err) {
      console.error('Error assigning device:', err)
      throw err
    }
  }, [updateDevice])

  // Unassign device from client
  const unassignDevice = useCallback(async (deviceId) => {
    try {
      const updates = {
        clientId: null,
        lifecycleStatus: 'warehouse',
        state: null,
        district: null,
        pinpoint: null,
      }

      return await updateDevice(deviceId, updates)
    } catch (err) {
      console.error('Error unassigning device:', err)
      throw err
    }
  }, [updateDevice])

  // Bulk assign devices to client
  const bulkAssignDevices = useCallback(async (deviceIds, clientId) => {
    try {
      await deviceApi.bulkAssign(deviceIds, clientId)
      
      // Reload devices to get updated data
      const fetchedDevices = await deviceApi.getAll()
      setDevices(fetchedDevices)
    } catch (err) {
      console.error('Error bulk assigning devices:', err)
      throw new Error(err.response?.data?.error || 'Failed to assign devices')
    }
  }, [])

  // ==========================================
  // CLIENT OPERATIONS (Local for now)
  // ==========================================

  const addClient = useCallback((clientData) => {
    const newClient = {
      id: clients.length > 0 ? Math.max(...clients.map(c => c.id)) + 1 : 1,
      ...clientData,
    }
    setClients(prev => [...prev, newClient])
    return newClient
  }, [clients])

  const updateClient = useCallback((clientId, updates) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c))
  }, [])

  const removeClient = useCallback((clientId) => {
    // Unassign all devices from this client
    setDevices(prev => prev.map(d => 
      d.clientId === clientId 
        ? { ...d, clientId: null, lifecycleStatus: 'warehouse', state: null, district: null, pinpoint: null }
        : d
    ))
    setClients(prev => prev.filter(c => c.id !== clientId))
  }, [])

  const getClientById = useCallback((clientId) => {
    return clients.find(c => c.id === clientId)
  }, [clients])

  // ==========================================
  // DEVICE QUERY FUNCTIONS
  // ==========================================

  const getDevicesByType = useCallback((type) => {
    return devices.filter(d => d.type === type)
  }, [devices])

  const getDevicesByClientId = useCallback((clientId) => {
    return devices.filter(d => d.clientId === clientId)
  }, [devices])

  const getDevicesByLifecycle = useCallback((lifecycleStatus) => {
    return devices.filter(d => getDeviceLifecycleStatus(d) === lifecycleStatus)
  }, [devices])

  const getUniqueDeviceFilterOptions = useCallback(() => {
    const brands = [...new Set(devices.map(d => d.brand).filter(Boolean))]
    const sizes = [...new Set(devices.map(d => d.size).filter(Boolean))]
    const models = [...new Set(devices.map(d => d.model).filter(Boolean))]
    const states = [...new Set(devices.map(d => d.state).filter(Boolean))]
    const districts = [...new Set(devices.map(d => d.district).filter(Boolean))]

    return { brands, sizes, models, states, districts }
  }, [devices])

  // ==========================================
  // DEVICE SETS (Local for now)
  // ==========================================

  const createDeviceSet = useCallback((setType, selectedComponents, name) => {
    const newSet = {
      id: deviceSets.length > 0 ? Math.max(...deviceSets.map(s => s.id)) + 1 : 1,
      type: setType,
      name: name || `${setType} Set ${deviceSets.length + 1}`,
      components: selectedComponents,
      createdAt: new Date().toISOString(),
    }
    setDeviceSets(prev => [...prev, newSet])
    return newSet
  }, [deviceSets])

  const deleteDeviceSet = useCallback((setId) => {
    setDeviceSets(prev => prev.filter(s => s.id !== setId))
  }, [])

  const getAvailableDevicesForComponent = useCallback((deviceType) => {
    return devices.filter(d => 
      d.type === deviceType && 
      getDeviceLifecycleStatus(d) === 'warehouse' &&
      !d.clientId
    )
  }, [devices])

  // ==========================================
  // REMINDERS (Local for now)
  // ==========================================

  const generateReminders = useCallback(() => {
    const newReminders = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    clients.forEach(client => {
      const clientDevices = devices.filter(d => d.clientId === client.id)
      if (clientDevices.length === 0) return

      const endDate = new Date(client.subscriptionEnd)
      endDate.setHours(0, 0, 0, 0)
      const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))

      let priority = 'low'
      let message = ''

      if (daysUntilEnd < 0) {
        priority = 'critical'
        message = `Subscription expired ${Math.abs(daysUntilEnd)} days ago`
      } else if (daysUntilEnd <= 7) {
        priority = 'critical'
        message = `Subscription expiring in ${daysUntilEnd} days`
      } else if (daysUntilEnd <= 30) {
        priority = 'high'
        message = `Subscription expiring in ${daysUntilEnd} days`
      }

      if (priority !== 'low') {
        clientDevices.forEach(device => {
          newReminders.push({
            id: `${client.id}-${device.id}`,
            clientId: client.id,
            clientName: client.name,
            deviceId: device.id,
            deviceCode: device.code,
            endDate: client.subscriptionEnd,
            priority,
            message,
          })
        })
      }
    })

    setReminders(newReminders)
  }, [clients, devices])

  useEffect(() => {
    generateReminders()
  }, [generateReminders])

  const dismissReminder = useCallback((reminderId) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId))
  }, [])

  const extendSubscription = useCallback((deviceId, newEndDate) => {
    const device = devices.find(d => d.id === deviceId)
    if (device && device.clientId) {
      updateClient(device.clientId, { subscriptionEnd: newEndDate })
    }
  }, [devices, updateClient])

  const returnDeviceFromClient = useCallback(async (deviceId) => {
    try {
      await unassignDevice(deviceId)
    } catch (err) {
      console.error('Error returning device:', err)
      throw err
    }
  }, [unassignDevice])

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const value = {
    // State
    devices,
    clients,
    reminders,
    deviceSets,
    componentInventory,
    loading,
    error,

    // Device operations
    addDevice,
    bulkAddDevices,
    updateDevice,
    removeDevice,
    assignDeviceToClient,
    unassignDevice,
    bulkAssignDevices,

    // Client operations
    addClient,
    updateClient,
    removeClient,
    getClientById,

    // Device queries
    getDevicesByType,
    getDevicesByClientId,
    getDevicesByLifecycle,
    getUniqueDeviceFilterOptions,

    // Device sets
    createDeviceSet,
    deleteDeviceSet,
    getAvailableDevicesForComponent,

    // Reminders
    dismissReminder,
    extendSubscription,
    returnDeviceFromClient,
  }

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}