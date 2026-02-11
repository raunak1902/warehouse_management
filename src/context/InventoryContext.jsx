import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

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
  // NEW: Check lifecycleStatus field first if it exists
  if (device.lifecycleStatus) {
    return device.lifecycleStatus
  }
  
  // LEGACY: Fallback to old logic for existing devices
  if (!device.clientId) return 'warehouse'
  const hasDeploymentLocation = !!(device.state || '').trim() && !!(device.location || '').trim()
  return hasDeploymentLocation ? 'deployed' : 'assigning'
}

// Device shape: id, code, type, clientId, subscriptionStart, subscriptionEnd,
// plus optional: brand, size, model, color, gpsId, mfgDate, state, district, location (pinpoint)
// Lifecycle: warehouse (no client, location = Warehouse A/B/C) | assigning (client set, not yet at site) | deployed (client + location)
const defaultDevices = [
  { id: 1, code: 'ATV-001', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01', brand: 'Samsung', size: '55"', model: 'Frame 55', color: 'Black', gpsId: 'GPS-001', mfgDate: '2023-01-15', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 2, code: 'ATV-002', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01', brand: 'LG', size: '43"', model: '43UP75', color: 'Black', gpsId: 'GPS-002', mfgDate: '2023-03-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 3, code: 'ATV-003', type: 'stand', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'Samsung', size: '65"', model: 'QB65B', color: 'Silver', gpsId: '', mfgDate: '2023-06-10', state: '', district: '', location: 'Warehouse B', lifecycleStatus: 'warehouse' },
  { id: 4, code: 'ITV-001', type: 'istand', clientId: 2, subscriptionStart: '2024-12-01', subscriptionEnd: '2025-02-15', brand: 'EDSignage', size: 'Standard', model: 'IS-1', color: 'Black', gpsId: 'GPS-004', mfgDate: '2023-02-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 5, code: 'ITV-002', type: 'istand', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'EDSignage', size: 'Large', model: 'IS-2', color: 'White', gpsId: '', mfgDate: '2023-04-01', state: '', district: '', location: 'Warehouse B', lifecycleStatus: 'warehouse' },
  { id: 6, code: 'ITV-003', type: 'istand', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'Generic', size: 'Standard', model: 'GEN-I', color: 'Gray', gpsId: 'GPS-006', mfgDate: '2022-11-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 7, code: 'TAB-001', type: 'tablet', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'Samsung', size: '10.5"', model: 'Tab S6 Lite', color: 'Gray', gpsId: 'GPS-007', mfgDate: '2023-01-20', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 8, code: 'TAB-002', type: 'tablet', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'Samsung', size: '10"', model: 'Tab A8', color: 'Black', gpsId: 'GPS-008', mfgDate: '2023-05-01', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse A', lifecycleStatus: 'deployed' },
  { id: 9, code: 'TAB-003', type: 'tablet', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'Apple', size: '10.9"', model: 'iPad Air', color: 'Space Gray', gpsId: '', mfgDate: '2023-07-01', state: '', district: '', location: 'Warehouse C', lifecycleStatus: 'warehouse' },
  { id: 10, code: 'ATV-004', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'LG', size: '50"', model: '50NANO76', color: 'Black', gpsId: 'GPS-010', mfgDate: '2023-02-15', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse B', lifecycleStatus: 'deployed' },
  { id: 11, code: 'ATV-005', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '43"', model: 'Crystal 43', color: 'Black', gpsId: 'GPS-011', mfgDate: '2023-04-10', state: 'Tamil Nadu', district: 'Chennai', location: 'Anna Nagar Godown A', lifecycleStatus: 'deployed' },
  { id: 12, code: 'ATV-006', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'TCL', size: '55"', model: '55S546', color: 'Black', gpsId: 'GPS-012', mfgDate: '2023-01-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 13, code: 'ITV-004', type: 'istand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'EDSignage', size: 'Standard', model: 'IS-1', color: 'Black', gpsId: 'GPS-013', mfgDate: '2023-03-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 14, code: 'ITV-005', type: 'istand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'EDSignage', size: 'Large', model: 'IS-2', color: 'Black', gpsId: 'GPS-014', mfgDate: '2023-05-01', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse B', lifecycleStatus: 'deployed' },
  { id: 15, code: 'TAB-004', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '10.5"', model: 'Tab S7', color: 'Silver', gpsId: 'GPS-015', mfgDate: '2023-02-01', state: 'Delhi', district: 'Central Delhi', location: 'Connaught Place Store 101', lifecycleStatus: 'deployed' },
  { id: 16, code: 'TAB-005', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Lenovo', size: '10"', model: 'Tab M10', color: 'Gray', gpsId: 'GPS-016', mfgDate: '2023-06-01', state: 'Karnataka', district: 'Bengaluru', location: 'Whitefield Godown B', lifecycleStatus: 'deployed' },
  { id: 17, code: 'TAB-006', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '11"', model: 'Tab S8', color: 'Pink Gold', gpsId: 'GPS-017', mfgDate: '2023-08-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A', lifecycleStatus: 'deployed' },
  { id: 18, code: 'TAB-007', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '10"', model: 'Tab A8', color: 'Gray', gpsId: 'GPS-018', mfgDate: '2023-04-01', state: 'Tamil Nadu', district: 'Chennai', location: 'Anna Nagar Godown B', lifecycleStatus: 'deployed' },
  { id: 19, code: 'TAB-008', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Apple', size: '10.9"', model: 'iPad Air', color: 'Blue', gpsId: 'GPS-019', mfgDate: '2023-07-15', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse B', lifecycleStatus: 'deployed' },
  // Haryana / Gurgaon — for Location module demo (e.g. "how many devices in Gurgaon")
  { id: 20, code: 'ATV-007', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01', brand: 'Samsung', size: '55"', model: 'Frame 55', color: 'Black', gpsId: 'GPS-020', mfgDate: '2023-02-01', state: 'Haryana', district: 'Gurgaon', location: 'DLF Cyber City Tower A', lifecycleStatus: 'deployed' },
  { id: 21, code: 'ITV-006', type: 'istand', clientId: 2, subscriptionStart: '2024-12-01', subscriptionEnd: '2025-02-15', brand: 'EDSignage', size: 'Standard', model: 'IS-1', color: 'Black', gpsId: 'GPS-021', mfgDate: '2023-03-01', state: 'Haryana', district: 'Gurgaon', location: 'DLF Cyber City Tower A', lifecycleStatus: 'deployed' },
  { id: 22, code: 'TAB-009', type: 'tablet', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'Samsung', size: '10.5"', model: 'Tab S6 Lite', color: 'Gray', gpsId: '', mfgDate: '2023-05-01', state: '', district: '', location: 'Warehouse A', lifecycleStatus: 'warehouse' },
  { id: 23, code: 'ATV-008', type: 'stand', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'LG', size: '43"', model: '43UP75', color: 'Black', gpsId: 'GPS-023', mfgDate: '2023-01-10', state: 'Haryana', district: 'Gurgaon', location: 'MG Road Mall Unit 12', lifecycleStatus: 'deployed' },
  { id: 24, code: 'TAB-010', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '10.5"', model: 'Tab S7', color: 'Gray', gpsId: '', mfgDate: '2023-02-01', state: '', district: '', location: '', lifecycleStatus: 'deployed' },
]

// Component-level stock for dashboard "available sets" calculation.
// Tablet combo = tablet + battery + fabrication (stand). A frame = TV + media box + A stand. I frame = TV + media box + I stand.
const defaultComponentInventory = {
  tablets: 15,
  batteries: 18,
  fabricationTablet: 14,
  tvs: 8,
  mediaBoxes: 5,
  aFrameStands: 6,
  iFrameStands: 5,
}

const InventoryContext = createContext(undefined)

export function InventoryProvider({ children }) {
  const [clients, setClients] = useState(defaultClients)
  const [devices, setDevices] = useState(defaultDevices)
  const [componentInventoryState, setComponentInventoryState] = useState(defaultComponentInventory)
  
  // NEW: Reminders state
  const [reminders, setReminders] = useState([])
  const [dismissedReminders, setDismissedReminders] = useState([])
  
  // NEW: Device Sets state
  const [deviceSets, setDeviceSets] = useState([])

  // NEW: Auto-generate reminders for subscription expiry
  useEffect(() => {
    const generateReminders = () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const newReminders = []
      
      devices.forEach(device => {
        if (device.clientId && device.subscriptionEnd) {
          const endDate = new Date(device.subscriptionEnd)
          endDate.setHours(0, 0, 0, 0)
          
          const diffTime = endDate - today
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          
          const client = clients.find(c => c.id === device.clientId)
          const reminderId = `${device.id}-${device.subscriptionEnd}`
          
          // Skip if already dismissed
          if (dismissedReminders.includes(reminderId)) {
            return
          }
          
          if (diffDays === 3) {
            newReminders.push({
              id: reminderId,
              type: 'warning',
              priority: 'medium',
              message: `Subscription ending in 3 days for ${client?.name || 'Unknown Client'}`,
              deviceCode: device.code,
              clientName: client?.name,
              clientId: device.clientId,
              deviceId: device.id,
              endDate: device.subscriptionEnd,
              daysRemaining: 3,
            })
          } else if (diffDays === 1) {
            newReminders.push({
              id: reminderId,
              type: 'urgent',
              priority: 'high',
              message: `Subscription ending tomorrow for ${client?.name || 'Unknown Client'}`,
              deviceCode: device.code,
              clientName: client?.name,
              clientId: device.clientId,
              deviceId: device.id,
              endDate: device.subscriptionEnd,
              daysRemaining: 1,
            })
          } else if (diffDays === 0) {
            newReminders.push({
              id: reminderId,
              type: 'critical',
              priority: 'critical',
              message: `Subscription ends TODAY for ${client?.name || 'Unknown Client'}`,
              deviceCode: device.code,
              clientName: client?.name,
              clientId: device.clientId,
              deviceId: device.id,
              endDate: device.subscriptionEnd,
              daysRemaining: 0,
            })
          } else if (diffDays < 0) {
            newReminders.push({
              id: reminderId,
              type: 'expired',
              priority: 'critical',
              message: `Subscription EXPIRED for ${client?.name || 'Unknown Client'}`,
              deviceCode: device.code,
              clientName: client?.name,
              clientId: device.clientId,
              deviceId: device.id,
              endDate: device.subscriptionEnd,
              daysRemaining: diffDays,
            })
          }
        }
      })
      
      setReminders(newReminders)
    }
    
    generateReminders()
    const interval = setInterval(generateReminders, 60 * 60 * 1000) // Every hour
    return () => clearInterval(interval)
  }, [devices, clients, dismissedReminders])

  const componentInventory = useMemo(() => componentInventoryState, [componentInventoryState])

  const getClientById = useCallback((id) => clients.find((c) => c.id === id), [clients])

  const getDevicesByClientId = useCallback((clientId) => devices.filter((d) => d.clientId === clientId), [devices])

  const getDevicesByType = useCallback((type) => devices.filter((d) => d.type === type), [devices])

  // NEW: Get devices by lifecycle status
  const getDevicesByLifecycle = useCallback((lifecycle) => {
    return devices.filter((d) => getDeviceLifecycleStatus(d) === lifecycle)
  }, [devices])

  const getUniqueDeviceFilterOptions = useCallback(() => {
    const states = [...new Set(devices.map((d) => d.state).filter(Boolean))]
    const districts = [...new Set(devices.map((d) => d.district).filter(Boolean))]
    const brands = [...new Set(devices.map((d) => d.brand).filter(Boolean))]
    const sizes = [...new Set(devices.map((d) => d.size).filter(Boolean))]
    const models = [...new Set(devices.map((d) => d.model).filter(Boolean))]
    return { states, districts, brands, sizes, models }
  }, [devices])

  const getLocationHierarchy = useCallback(() => {
    const structure = {}
    devices.forEach((d) => {
      const state = d.state || '—'
      const district = d.district || '—'
      const location = d.location || '—'
      if (!structure[state]) structure[state] = {}
      if (!structure[state][district]) structure[state][district] = {}
      if (!structure[state][district][location]) structure[state][district][location] = 0
      structure[state][district][location]++
    })
    return structure
  }, [devices])

  const getDevicesByLocation = useCallback((state, district, location) => {
    return devices.filter((d) => {
      if (state && d.state !== state) return false
      if (district && d.district !== district) return false
      if (location && d.location !== location) return false
      return true
    })
  }, [devices])

  const getLocationSummary = useCallback(() => {
    const keyToRow = {}
    devices.forEach((d) => {
      const isWarehouse = !d.clientId
      const state = isWarehouse ? 'Warehouse' : (d.state || '—')
      const district = isWarehouse ? '—' : (d.district || '—')
      const location = (d.location || '—').trim() || '—'
      const key = isWarehouse ? `Warehouse|—|${d.location}` : `${d.state || '—'}|${d.district || '—'}|${location}`
      if (!keyToRow[key]) {
        keyToRow[key] = { state, district, location, total: 0, inStock: 0, deployed: 0, isWarehouse: !!isWarehouse }
      }
      const row = keyToRow[key]
      row.total += 1
      if (d.clientId) row.deployed += 1
      else row.inStock += 1
    })
    return Object.values(keyToRow).sort((a, b) =>
      [a.state, a.district, a.location].join(' ').localeCompare([b.state, b.district, b.location].join(' '))
    )
  }, [devices])

  const addClient = useCallback((client) => {
    const id = Math.max(0, ...clients.map((c) => c.id)) + 1
    setClients((prev) => [...prev, { ...client, id }])
    return id
  }, [clients])

  const updateClient = useCallback((id, updates) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    
    // NEW: If subscription dates updated, update all devices for this client
    if (updates.subscriptionStart || updates.subscriptionEnd) {
      setDevices((prev) => prev.map((d) => 
        d.clientId === id 
          ? { 
              ...d, 
              subscriptionStart: updates.subscriptionStart || d.subscriptionStart,
              subscriptionEnd: updates.subscriptionEnd || d.subscriptionEnd 
            } 
          : d
      ))
    }
  }, [])

  const removeClient = useCallback((id) => {
    setClients((prev) => prev.filter((c) => c.id !== id))
    // NEW: Return devices to warehouse when client is deleted
    setDevices((prev) =>
      prev.map((d) => (d.clientId === id 
        ? { ...d, clientId: null, subscriptionStart: null, subscriptionEnd: null, lifecycleStatus: 'warehouse' } 
        : d
      ))
    )
  }, [])

  const addDevice = useCallback((device) => {
    const id = Math.max(0, ...devices.map((d) => d.id)) + 1
    const defaults = { 
      clientId: null, 
      subscriptionStart: null, 
      subscriptionEnd: null, 
      brand: '', 
      size: '', 
      model: '', 
      color: '', 
      gpsId: '', 
      mfgDate: '', 
      state: '', 
      district: '', 
      location: device.location || 'Warehouse A',
      lifecycleStatus: device.lifecycleStatus || 'warehouse' // NEW: Default to warehouse
    }
    setDevices((prev) => [...prev, { id, ...defaults, ...device }])
    return id
  }, [devices])

  const updateDevice = useCallback((id, updates) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)))
  }, [])

  const assignDevicesToClient = useCallback((clientId, deviceIds, subscriptionStart, subscriptionEnd) => {
    setDevices((prev) =>
      prev.map((d) =>
        deviceIds.includes(d.id)
          ? { 
              ...d, 
              clientId, 
              subscriptionStart, 
              subscriptionEnd,
              lifecycleStatus: 'deployed' // NEW: Automatically set to deployed
            }
          : d
      )
    )
  }, [])

  const unassignDevice = useCallback((deviceId) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId 
          ? { 
              ...d, 
              clientId: null, 
              subscriptionStart: null, 
              subscriptionEnd: null,
              lifecycleStatus: 'warehouse' // NEW: Return to warehouse
            } 
          : d
      )
    )
  }, [])

  // NEW: Reminder operations
  const dismissReminder = useCallback((reminderId) => {
    setDismissedReminders((prev) => [...prev, reminderId])
    setReminders((prev) => prev.filter((r) => r.id !== reminderId))
  }, [])

  const extendSubscription = useCallback((deviceId, newEndDate) => {
    const device = devices.find((d) => d.id === deviceId)
    if (device && device.clientId) {
      updateDevice(deviceId, { subscriptionEnd: newEndDate })
      
      // Also update client if needed
      const client = clients.find((c) => c.id === device.clientId)
      if (client) {
        updateClient(client.id, { subscriptionEnd: newEndDate })
      }
      
      // Remove related reminders
      const reminderId = `${deviceId}-${device.subscriptionEnd}`
      dismissReminder(reminderId)
    }
  }, [devices, clients, updateDevice, updateClient, dismissReminder])

  const returnDeviceFromClient = useCallback((deviceId) => {
    const device = devices.find((d) => d.id === deviceId)
    unassignDevice(deviceId)
    
    // Remove related reminders
    if (device && device.subscriptionEnd) {
      const reminderId = `${deviceId}-${device.subscriptionEnd}`
      dismissReminder(reminderId)
    }
  }, [devices, unassignDevice, dismissReminder])

  // Component inventory: updated from Devices module; used for dashboard "available sets".
  const updateComponentInventory = useCallback((updates) => {
    setComponentInventoryState((prev) => ({ ...prev, ...updates }))
  }, [])

  // When assigning a set to a client, deduct components (1 set = 3 components per type).
  const deductComponentsForAssignment = useCallback((type, count = 1) => {
    if (type === 'tablet') {
      setComponentInventoryState((prev) => ({
        ...prev,
        tablets: Math.max(0, prev.tablets - count),
        batteries: Math.max(0, prev.batteries - count),
        fabricationTablet: Math.max(0, prev.fabricationTablet - count),
      }))
    } else if (type === 'stand') {
      setComponentInventoryState((prev) => ({
        ...prev,
        tvs: Math.max(0, prev.tvs - count),
        mediaBoxes: Math.max(0, prev.mediaBoxes - count),
        aFrameStands: Math.max(0, prev.aFrameStands - count),
      }))
    } else if (type === 'istand') {
      setComponentInventoryState((prev) => ({
        ...prev,
        tvs: Math.max(0, prev.tvs - count),
        mediaBoxes: Math.max(0, prev.mediaBoxes - count),
        iFrameStands: Math.max(0, prev.iFrameStands - count),
      }))
    }
  }, [])

  // Assign devices to a client. Available (dashboard) = unassigned devices; Deployed = assigned. Assigning moves device from available to deployed.
  const setClientDevices = useCallback((clientId, deviceIds, subscriptionStart, subscriptionEnd) => {
    setDevices((prev) =>
      prev.map((d) => {
        const assigned = deviceIds.includes(d.id)
        return {
          ...d,
          clientId: assigned ? clientId : d.clientId === clientId ? null : d.clientId,
          subscriptionStart: assigned ? subscriptionStart : d.clientId === clientId ? null : d.subscriptionStart,
          subscriptionEnd: assigned ? subscriptionEnd : d.clientId === clientId ? null : d.subscriptionEnd,
          lifecycleStatus: assigned ? 'deployed' : d.clientId === clientId ? 'warehouse' : d.lifecycleStatus, // NEW
        }
      })
    )
  }, [])

  // NEW: Get available devices for component selection (not assigned to client, not in a set)
  const getAvailableDevicesForComponent = useCallback((componentType) => {
    // Map component types to device types
    const typeMapping = {
      'stand': 'stand',        // A-Frame stand
      'istand': 'istand',      // I-Frame stand
      'tv': 'tv',              // TV (for both A and I frames)
      'tablet': 'tablet',      // Tablet
      'mediaBox': 'mediaBox',  // Media box
      'battery': 'battery',    // Battery
      'fabrication': 'fabrication', // Tablet stand
    }
    
    const deviceType = typeMapping[componentType]
    if (!deviceType) return []
    
    // Return devices that are:
    // 1. Not assigned to any client
    // 2. Not already in a set
    // 3. Match the component type
    // 4. In warehouse
    return devices.filter(device => 
      !device.clientId && 
      !device.setId &&
      device.type === deviceType &&
      getDeviceLifecycleStatus(device) === 'warehouse'
    )
  }, [devices])

  // NEW: Device Sets Management
  const createDeviceSet = useCallback((setData) => {
    const newSet = {
      id: Math.max(0, ...deviceSets.map(s => s.id)) + 1,
      ...setData,
      createdAt: new Date().toISOString(),
    }
    
    setDeviceSets(prev => [...prev, newSet])
    
    // Mark devices as used in a set (set their setId)
    const componentDeviceIds = Object.values(setData.components).filter(Boolean)
    setDevices(prev => prev.map(device => {
      if (componentDeviceIds.includes(device.id.toString()) || componentDeviceIds.includes(device.id)) {
        return { ...device, setId: newSet.id }
      }
      return device
    }))
    
    // Deduct components from inventory
    const setType = setData.type
    const componentUpdates = {}
    
    if (setType === 'aStand') {
      componentUpdates.aFrameStands = -1
      componentUpdates.tvs = -1
      componentUpdates.mediaBoxes = -1
    } else if (setType === 'iStand') {
      componentUpdates.iFrameStands = -1
      componentUpdates.tvs = -1
      componentUpdates.mediaBoxes = -1
    } else if (setType === 'tabletCombo') {
      componentUpdates.tablets = -1
      componentUpdates.batteries = -1
      componentUpdates.fabricationTablet = -1
    }
    
    setComponentInventoryState(prev => {
      const updated = { ...prev }
      Object.entries(componentUpdates).forEach(([key, delta]) => {
        updated[key] = Math.max(0, (updated[key] || 0) + delta)
      })
      return updated
    })
  }, [deviceSets])

  const deleteDeviceSet = useCallback((setId) => {
    const set = deviceSets.find(s => s.id === setId)
    if (!set) return
    
    // Remove setId from devices that were in this set
    const componentDeviceIds = Object.values(set.components).filter(Boolean)
    setDevices(prev => prev.map(device => {
      if (componentDeviceIds.includes(device.id.toString()) || componentDeviceIds.includes(device.id)) {
        const { setId: _, ...rest } = device
        return rest
      }
      return device
    }))
    
    // Return components to inventory
    const setType = set.type
    const componentUpdates = {}
    
    if (setType === 'aStand') {
      componentUpdates.aFrameStands = 1
      componentUpdates.tvs = 1
      componentUpdates.mediaBoxes = 1
    } else if (setType === 'iStand') {
      componentUpdates.iFrameStands = 1
      componentUpdates.tvs = 1
      componentUpdates.mediaBoxes = 1
    } else if (setType === 'tabletCombo') {
      componentUpdates.tablets = 1
      componentUpdates.batteries = 1
      componentUpdates.fabricationTablet = 1
    }
    
    setComponentInventoryState(prev => {
      const updated = { ...prev }
      Object.entries(componentUpdates).forEach(([key, delta]) => {
        updated[key] = (updated[key] || 0) + delta
      })
      return updated
    })
    
    setDeviceSets(prev => prev.filter(s => s.id !== setId))
  }, [deviceSets])

  // NEW: Statistics
  const statistics = useMemo(() => {
    return {
      totalClients: clients.length,
      totalDevices: devices.length,
      deployedDevices: devices.filter((d) => getDeviceLifecycleStatus(d) === 'deployed').length,
      warehouseDevices: devices.filter((d) => getDeviceLifecycleStatus(d) === 'warehouse').length,
      outOfWarehouse: devices.filter((d) => getDeviceLifecycleStatus(d) === 'out_of_warehouse').length,
      assignedDevices: devices.filter((d) => d.clientId).length,
      availableDevices: devices.filter((d) => !d.clientId).length,
      activeReminders: reminders.length,
      criticalReminders: reminders.filter((r) => r.priority === 'critical').length,
    }
  }, [clients, devices, reminders])

  const value = {
    // Existing state
    clients,
    devices,
    componentInventory,
    
    // NEW: Reminders
    reminders,
    statistics,
    deviceSets,
    
    // Existing functions
    updateComponentInventory,
    deductComponentsForAssignment,
    getClientById,
    getDevicesByClientId,
    getDevicesByType,
    getUniqueDeviceFilterOptions,
    getLocationHierarchy,
    getDevicesByLocation,
    getLocationSummary,
    addClient,
    updateClient,
    removeClient,
    addDevice,
    updateDevice,
    assignDevicesToClient,
    unassignDevice,
    setClientDevices,
    
    // NEW: Additional functions
    getDevicesByLifecycle,
    dismissReminder,
    extendSubscription,
    returnDeviceFromClient,
    createDeviceSet,
    deleteDeviceSet,
    getAvailableDevicesForComponent,
    
    // Constants
    DEVICE_TYPES,
    DEVICE_LIFECYCLE,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider')
  return ctx
}