import { createContext, useContext, useState, useCallback } from 'react'

// Product types we rent
export const DEVICE_TYPES = {
  stand: 'A stand',
  istand: 'I stand',
  tablet: 'Tablet',
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

// Each device has unique code (alphanumeric), type, and when assigned: clientId + dates
const defaultDevices = [
  { id: 1, code: 'ATV-001', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01' },
  { id: 2, code: 'ATV-002', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01' },
  { id: 3, code: 'ATV-003', type: 'stand', clientId: null, subscriptionStart: null, subscriptionEnd: null },
  { id: 4, code: 'ITV-001', type: 'istand', clientId: 2, subscriptionStart: '2024-12-01', subscriptionEnd: '2025-02-15' },
  { id: 5, code: 'ITV-002', type: 'istand', clientId: null, subscriptionStart: null, subscriptionEnd: null },
  { id: 6, code: 'ITV-003', type: 'istand', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20' },
  { id: 7, code: 'TAB-001', type: 'tablet', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20' },
  { id: 8, code: 'TAB-002', type: 'tablet', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20' },
  { id: 9, code: 'TAB-003', type: 'tablet', clientId: null, subscriptionStart: null, subscriptionEnd: null },
  // Mac D: 3 A stand, 2 I stand, 5 tablets
  { id: 10, code: 'ATV-004', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 11, code: 'ATV-005', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 12, code: 'ATV-006', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 13, code: 'ITV-004', type: 'istand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 14, code: 'ITV-005', type: 'istand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 15, code: 'TAB-004', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 16, code: 'TAB-005', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 17, code: 'TAB-006', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 18, code: 'TAB-007', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
  { id: 19, code: 'TAB-008', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01' },
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

const InventoryContext = createContext(null)

export function InventoryProvider({ children }) {
  const [clients, setClients] = useState(defaultClients)
  const [devices, setDevices] = useState(defaultDevices)
  const [componentInventory, setComponentInventoryState] = useState(defaultComponentInventory)

  const getClientById = useCallback(
    (id) => clients.find((c) => c.id === id),
    [clients]
  )

  const getDevicesByClientId = useCallback(
    (clientId) => devices.filter((d) => d.clientId === clientId),
    [devices]
  )

  const getDevicesByType = useCallback(
    (type) => devices.filter((d) => d.type === type),
    [devices]
  )

  const addClient = useCallback((client) => {
    const id = Math.max(0, ...clients.map((c) => c.id)) + 1
    setClients((prev) => [...prev, { ...client, id }])
    return id
  }, [clients])

  const updateClient = useCallback((id, updates) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }, [])

  const removeClient = useCallback((id) => {
    setClients((prev) => prev.filter((c) => c.id !== id))
    setDevices((prev) =>
      prev.map((d) => (d.clientId === id ? { ...d, clientId: null, subscriptionStart: null, subscriptionEnd: null } : d))
    )
  }, [])

  const addDevice = useCallback((device) => {
    const id = Math.max(0, ...devices.map((d) => d.id)) + 1
    setDevices((prev) => [...prev, { id, clientId: null, subscriptionStart: null, subscriptionEnd: null, ...device }])
    return id
  }, [devices])

  const updateDevice = useCallback((id, updates) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)))
  }, [])

  const assignDevicesToClient = useCallback((clientId, deviceIds, subscriptionStart, subscriptionEnd) => {
    setDevices((prev) =>
      prev.map((d) =>
        deviceIds.includes(d.id)
          ? { ...d, clientId, subscriptionStart, subscriptionEnd }
          : d
      )
    )
  }, [])

  const unassignDevice = useCallback((deviceId) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId ? { ...d, clientId: null, subscriptionStart: null, subscriptionEnd: null } : d
      )
    )
  }, [])

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
        }
      })
    )
  }, [])

  const value = {
    clients,
    devices,
    componentInventory,
    updateComponentInventory,
    deductComponentsForAssignment,
    getClientById,
    getDevicesByClientId,
    getDevicesByType,
    addClient,
    updateClient,
    removeClient,
    addDevice,
    updateDevice,
    assignDevicesToClient,
    unassignDevice,
    setClientDevices,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider')
  return ctx
}
