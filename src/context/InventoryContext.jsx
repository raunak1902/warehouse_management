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

// Device lifecycle: In warehouse (Warehouse A/B/C) | Assigning (ordered, not yet deployed) | Deployed (at client location)
export const getDeviceLifecycleStatus = (device) => {
  if (!device.clientId) return 'warehouse'
  const hasDeploymentLocation = !!(device.state || '').trim() && !!(device.location || '').trim()
  return hasDeploymentLocation ? 'deployed' : 'assigning'
}

// Device shape: id, code, type, clientId, subscriptionStart, subscriptionEnd,
// plus optional: brand, size, model, color, gpsId, mfgDate, state, district, location (pinpoint)
// Lifecycle: warehouse (no client, location = Warehouse A/B/C) | assigning (client set, not yet at site) | deployed (client + location)
const defaultDevices = [
  { id: 1, code: 'ATV-001', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01', brand: 'Samsung', size: '55"', model: 'Frame 55', color: 'Black', gpsId: 'GPS-001', mfgDate: '2023-01-15', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 2, code: 'ATV-002', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01', brand: 'LG', size: '43"', model: '43UP75', color: 'Black', gpsId: 'GPS-002', mfgDate: '2023-03-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 3, code: 'ATV-003', type: 'stand', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'Samsung', size: '65"', model: 'QB65B', color: 'Silver', gpsId: '', mfgDate: '2023-06-10', state: '', district: '', location: 'Warehouse B' },
  { id: 4, code: 'ITV-001', type: 'istand', clientId: 2, subscriptionStart: '2024-12-01', subscriptionEnd: '2025-02-15', brand: 'EDSignage', size: 'Standard', model: 'IS-1', color: 'Black', gpsId: 'GPS-004', mfgDate: '2023-02-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 5, code: 'ITV-002', type: 'istand', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'EDSignage', size: 'Large', model: 'IS-2', color: 'White', gpsId: '', mfgDate: '2023-04-01', state: '', district: '', location: 'Warehouse B' },
  { id: 6, code: 'ITV-003', type: 'istand', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'Generic', size: 'Standard', model: 'GEN-I', color: 'Gray', gpsId: 'GPS-006', mfgDate: '2022-11-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 7, code: 'TAB-001', type: 'tablet', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'Samsung', size: '10.5"', model: 'Tab S6 Lite', color: 'Gray', gpsId: 'GPS-007', mfgDate: '2023-01-20', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 8, code: 'TAB-002', type: 'tablet', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'Samsung', size: '10"', model: 'Tab A8', color: 'Black', gpsId: 'GPS-008', mfgDate: '2023-05-01', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse A' },
  { id: 9, code: 'TAB-003', type: 'tablet', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'Apple', size: '10.9"', model: 'iPad Air', color: 'Space Gray', gpsId: '', mfgDate: '2023-07-01', state: '', district: '', location: 'Warehouse C' },
  { id: 10, code: 'ATV-004', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'LG', size: '50"', model: '50NANO76', color: 'Black', gpsId: 'GPS-010', mfgDate: '2023-02-15', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse B' },
  { id: 11, code: 'ATV-005', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '43"', model: 'Crystal 43', color: 'Black', gpsId: 'GPS-011', mfgDate: '2023-04-10', state: 'Tamil Nadu', district: 'Chennai', location: 'Anna Nagar Godown A' },
  { id: 12, code: 'ATV-006', type: 'stand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'TCL', size: '55"', model: '55S546', color: 'Black', gpsId: 'GPS-012', mfgDate: '2023-01-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 13, code: 'ITV-004', type: 'istand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'EDSignage', size: 'Standard', model: 'IS-1', color: 'Black', gpsId: 'GPS-013', mfgDate: '2023-03-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 14, code: 'ITV-005', type: 'istand', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'EDSignage', size: 'Large', model: 'IS-2', color: 'Black', gpsId: 'GPS-014', mfgDate: '2023-05-01', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse B' },
  { id: 15, code: 'TAB-004', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '10.5"', model: 'Tab S7', color: 'Silver', gpsId: 'GPS-015', mfgDate: '2023-02-01', state: 'Delhi', district: 'Central Delhi', location: 'Connaught Place Store 101' },
  { id: 16, code: 'TAB-005', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Lenovo', size: '10"', model: 'Tab M10', color: 'Gray', gpsId: 'GPS-016', mfgDate: '2023-06-01', state: 'Karnataka', district: 'Bengaluru', location: 'Whitefield Godown B' },
  { id: 17, code: 'TAB-006', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '11"', model: 'Tab S8', color: 'Pink Gold', gpsId: 'GPS-017', mfgDate: '2023-08-01', state: 'Maharashtra', district: 'Mumbai', location: 'Andheri Godown A' },
  { id: 18, code: 'TAB-007', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '10"', model: 'Tab A8', color: 'Gray', gpsId: 'GPS-018', mfgDate: '2023-04-01', state: 'Tamil Nadu', district: 'Chennai', location: 'Anna Nagar Godown B' },
  { id: 19, code: 'TAB-008', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Apple', size: '10.9"', model: 'iPad Air', color: 'Blue', gpsId: 'GPS-019', mfgDate: '2023-07-15', state: 'Maharashtra', district: 'Pune', location: 'Hinjewadi Warehouse B' },
  // Haryana / Gurgaon — for Location module demo (e.g. "how many devices in Gurgaon")
  { id: 20, code: 'ATV-007', type: 'stand', clientId: 1, subscriptionStart: '2024-06-01', subscriptionEnd: '2025-06-01', brand: 'Samsung', size: '55"', model: 'Frame 55', color: 'Black', gpsId: 'GPS-020', mfgDate: '2023-02-01', state: 'Haryana', district: 'Gurgaon', location: 'DLF Cyber City Tower A' },
  { id: 21, code: 'ITV-006', type: 'istand', clientId: 2, subscriptionStart: '2024-12-01', subscriptionEnd: '2025-02-15', brand: 'EDSignage', size: 'Standard', model: 'IS-1', color: 'Black', gpsId: 'GPS-021', mfgDate: '2023-03-01', state: 'Haryana', district: 'Gurgaon', location: 'DLF Cyber City Tower A' },
  { id: 22, code: 'TAB-009', type: 'tablet', clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: 'Samsung', size: '10.5"', model: 'Tab S6 Lite', color: 'Gray', gpsId: '', mfgDate: '2023-05-01', state: '', district: '', location: 'Warehouse A' },
  { id: 23, code: 'ATV-008', type: 'stand', clientId: 3, subscriptionStart: '2024-09-01', subscriptionEnd: '2025-01-20', brand: 'LG', size: '43"', model: '43UP75', color: 'Black', gpsId: 'GPS-023', mfgDate: '2023-01-10', state: 'Haryana', district: 'Gurgaon', location: 'MG Road Mall Unit 12' },
  { id: 24, code: 'TAB-010', type: 'tablet', clientId: 4, subscriptionStart: '2024-11-01', subscriptionEnd: '2025-05-01', brand: 'Samsung', size: '10.5"', model: 'Tab S7', color: 'Gray', gpsId: '', mfgDate: '2023-02-01', state: '', district: '', location: '' },
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

  // Unique values from devices for filter dropdowns (brand, size, model)
  const getUniqueDeviceFilterOptions = useCallback(() => {
    const brands = [...new Set(devices.map((d) => d.brand).filter(Boolean))].sort()
    const sizes = [...new Set(devices.map((d) => d.size).filter(Boolean))].sort()
    const models = [...new Set(devices.map((d) => d.model).filter(Boolean))].sort()
    return { brands, sizes, models }
  }, [devices])

  // Location hierarchy for multilevel filter: State → District → Pinpoint. Warehouse = no state/district, just Warehouse A/B/C.
  const getLocationHierarchy = useCallback(() => {
    const states = [...new Set(devices.map((d) => d.state).filter(Boolean))].sort()
    const districtsByState = {}
    const locationsByStateDistrict = {}
    devices.forEach((d) => {
      if (!d.state) {
        if (d.location) {
          if (!districtsByState['Warehouse']) districtsByState['Warehouse'] = new Set()
          const key = 'Warehouse|'
          if (!locationsByStateDistrict[key]) locationsByStateDistrict[key] = new Set()
          locationsByStateDistrict[key].add(d.location)
        }
        return
      }
      if (!districtsByState[d.state]) districtsByState[d.state] = new Set()
      if (d.district) districtsByState[d.state].add(d.district)
      if (d.district && d.location) {
        const key = `${d.state}|${d.district}`
        if (!locationsByStateDistrict[key]) locationsByStateDistrict[key] = new Set()
        locationsByStateDistrict[key].add(d.location)
      }
    })
    if (districtsByState['Warehouse']) {
      districtsByState['Warehouse'] = new Set()
      if (!states.includes('Warehouse')) states.push('Warehouse')
      states.sort()
    }
    return {
      states,
      districtsByState: Object.fromEntries(Object.entries(districtsByState).map(([s, set]) => [s, [...set].sort()])),
      locationsByStateDistrict: Object.fromEntries(
        Object.entries(locationsByStateDistrict).map(([k, set]) => [k, [...set].sort()])
      ),
    }
  }, [devices])

  // Devices at a given location (state, district, pinpoint). Warehouse: state='Warehouse', no district, location=Warehouse A/B/C.
  const getDevicesByLocation = useCallback(
    (state, district, location) => {
      return devices.filter((d) => {
        if (state === 'Warehouse') {
          if (district) return false
          return (d.location || '') === (location || '')
        }
        if (state && (d.state || '') !== state) return false
        if (district && (d.district || '') !== district) return false
        if (location && (d.location || '') !== location) return false
        return true
      })
    },
    [devices]
  )

  // Summary per location: { state, district, location, total, inStock, deployed }. Warehouse = no state/district, display as "Warehouse" + Warehouse A/B/C. Skip assigning (no location).
  const getLocationSummary = useCallback(() => {
    const keyToRow = {}
    devices.forEach((d) => {
      const hasLocation = !!(d.state || '').trim() || !!(d.location || '').trim()
      if (!hasLocation) return
      const isWarehouse = !d.state && d.location
      const state = isWarehouse ? 'Warehouse' : (d.state || '—')
      const district = isWarehouse ? '—' : (d.district || '—')
      const location = d.location || '—'
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
  }, [])

  const removeClient = useCallback((id) => {
    setClients((prev) => prev.filter((c) => c.id !== id))
    setDevices((prev) =>
      prev.map((d) => (d.clientId === id ? { ...d, clientId: null, subscriptionStart: null, subscriptionEnd: null } : d))
    )
  }, [])

  const addDevice = useCallback((device) => {
    const id = Math.max(0, ...devices.map((d) => d.id)) + 1
    const defaults = { clientId: null, subscriptionStart: null, subscriptionEnd: null, brand: '', size: '', model: '', color: '', gpsId: '', mfgDate: '', state: '', district: '', location: device.location || 'Warehouse A' }
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
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider')
  return ctx
}
