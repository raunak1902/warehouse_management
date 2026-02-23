import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { deviceApi } from '../api/deviceApi'
import { setApi } from '../api/setApi'
import { clientApi } from '../api/clientApi'
import { assignmentRequestApi } from '../api/assignmentRequestApi'
import { normalizeDeviceType } from '../config/deviceConfig'

// ─────────────────────────────────────────────────────────────
// LIFECYCLE CONSTANTS
// ─────────────────────────────────────────────────────────────
export const LIFECYCLE = {
  WAREHOUSE:        'warehouse',
  ASSIGN_REQUESTED: 'assign_requested',
  ASSIGNED:         'assigned',
  DEPLOY_REQUESTED: 'deploy_requested',
  DEPLOYED:         'deployed',
  RETURN_REQUESTED: 'return_requested',
  RETURNED:         'returned',
}

export const LIFECYCLE_LABELS = {
  warehouse:        'In Warehouse',
  assign_requested: 'Assignment Requested',
  assigned:         'Assigned to Client',
  deploy_requested: 'Deployment Requested',
  deployed:         'Deployed',
  return_requested: 'Return Requested',
  returned:         'Returned',
}

export const LIFECYCLE_COLORS = {
  warehouse:        { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  assign_requested: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  assigned:         { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  deploy_requested: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  deployed:         { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  return_requested: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  returned:         { bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

export const HEALTH_COLORS = {
  ok:     { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Healthy' },
  repair: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Needs Repair' },
  damage: { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500',   label: 'Damaged' },
}

// ─────────────────────────────────────────────────────────────
// LEGACY EXPORTS (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────
export const DEVICE_TYPES = {
  stand: 'A stand',
  istand: 'I stand',
  tablet: 'Tablet',
}

export const DEVICE_CODE_PREFIX = { stand: 'ATV', istand: 'ITV', tablet: 'TAB' }

// getSubscriptionFilterStatus: returns filter bucket for a subscription
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

export const getDaysUntilEnd = (endDateStr) => {
  const end = new Date(endDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24))
}

// getSubscriptionStatus: returns label/type based on subscription end date
export const getSubscriptionStatus = (endDateStr) => {
  const days = getDaysUntilEnd(endDateStr)
  if (days < 0) return { label: 'Expired', type: 'expired', days }
  if (days <= 7) return { label: 'Expiring soon', type: 'urgent', days }
  if (days <= 30) return { label: 'Expiring in 30 days', type: 'warning', days }
  return { label: 'Active', type: 'active', days }
}

// getDeviceLifecycleStatus: kept for any existing code that uses it
export const getDeviceLifecycleStatus = (device) => {
  if (device.lifecycleStatus) return device.lifecycleStatus
  if (!device.clientId) return 'warehouse'
  if (device.clientId && !device.state && !device.district && !device.pinpoint) return 'assign_requested'
  if (device.clientId && (device.state || device.district || device.pinpoint)) return 'deployed'
  return 'warehouse'
}

// ─────────────────────────────────────────────────────────────
// LIFECYCLE WORKFLOW API HELPER
// ─────────────────────────────────────────────────────────────
const API_BASE = '/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' }
}

const lifecycleApi = {
  requestAssign:  (id, clientId)   => fetch(`${API_BASE}/devices/${id}/request-assign`,  { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ clientId }) }).then(r => r.json()),
  approveAssign:  (id)             => fetch(`${API_BASE}/devices/${id}/approve-assign`,  { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),
  rejectAssign:   (id, note)       => fetch(`${API_BASE}/devices/${id}/reject-assign`,   { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ note }) }).then(r => r.json()),
  requestDeploy:  (id, data)       => fetch(`${API_BASE}/devices/${id}/request-deploy`,  { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) }).then(r => r.json()),
  approveDeploy:  (id)             => fetch(`${API_BASE}/devices/${id}/approve-deploy`,  { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),
  rejectDeploy:   (id, note)       => fetch(`${API_BASE}/devices/${id}/reject-deploy`,   { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ note }) }).then(r => r.json()),
  requestReturn:  (id, note)       => fetch(`${API_BASE}/devices/${id}/request-return`,  { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ note }) }).then(r => r.json()),
  approveReturn:  (id)             => fetch(`${API_BASE}/devices/${id}/approve-return`,  { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),
  rejectReturn:   (id, note)       => fetch(`${API_BASE}/devices/${id}/reject-return`,   { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ note }) }).then(r => r.json()),
  getPending:     ()               => fetch(`${API_BASE}/devices/pending-approvals`,     { headers: getAuthHeaders() }).then(r => r.json()),
  getHistory:     (id)             => fetch(`${API_BASE}/devices/${id}/history`,         { headers: getAuthHeaders() }).then(r => r.json()),
}

// ─────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────
const InventoryContext = createContext()

export const useInventory = () => {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('useInventory must be used within InventoryProvider')
  return context
}

export const InventoryProvider = ({ children }) => {
  const [devices, setDevices]         = useState([])
  const [clients, setClients]         = useState([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [reminders, setReminders]     = useState([])
  const [deviceSets, setDeviceSets]   = useState([])
  const [setsLoading, setSetsLoading] = useState(false)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  // ── Core fetch functions ──────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const fetched = await deviceApi.getAll()
      setDevices(fetched)
    } catch (err) {
      console.error('Error fetching devices:', err)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      setClientsLoading(true)
      const fetched = await clientApi.getAll()
      setClients(fetched)
    } catch (err) {
      console.error('Error loading clients:', err)
    } finally {
      setClientsLoading(false)
    }
  }, [])

  const fetchSets = useCallback(async () => {
    try {
      setSetsLoading(true)
      const fetched = await setApi.getAll()
      setDeviceSets(fetched)
    } catch (err) {
      console.error('Error loading sets:', err)
    } finally {
      setSetsLoading(false)
    }
  }, [])

  // ── Full refresh — call after ANY mutation ────────────────
  // This is the key fix for Bug 2 (counts not updating).
  const refresh = useCallback(async () => {
    await Promise.all([fetchDevices(), fetchClients(), fetchSets()])
  }, [fetchDevices, fetchClients, fetchSets])

  // Named alias kept for any existing code using refreshDevices
  const refreshDevices = fetchDevices

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([fetchDevices(), fetchClients(), fetchSets()])
      } catch (err) {
        setError('Failed to load data. Please check your connection.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [fetchDevices, fetchClients, fetchSets])

  // ── Derived: pending approvals ────────────────────────────
  const pendingApprovals = useMemo(() =>
    devices.filter(d => [
      LIFECYCLE.ASSIGN_REQUESTED,
      LIFECYCLE.DEPLOY_REQUESTED,
      LIFECYCLE.RETURN_REQUESTED,
    ].includes(d.lifecycleStatus))
  , [devices])

  // ── Derived: lifecycle counts ─────────────────────────────
  const lifecycleCounts = useMemo(() => ({
    total:           devices.length,
    warehouse:       devices.filter(d => d.lifecycleStatus === LIFECYCLE.WAREHOUSE).length,
    assignRequested: devices.filter(d => d.lifecycleStatus === LIFECYCLE.ASSIGN_REQUESTED).length,
    assigned:        devices.filter(d => d.lifecycleStatus === LIFECYCLE.ASSIGNED).length,
    deployRequested: devices.filter(d => d.lifecycleStatus === LIFECYCLE.DEPLOY_REQUESTED).length,
    deployed:        devices.filter(d => d.lifecycleStatus === LIFECYCLE.DEPLOYED).length,
    returnRequested: devices.filter(d => d.lifecycleStatus === LIFECYCLE.RETURN_REQUESTED).length,
    returned:        devices.filter(d => d.lifecycleStatus === LIFECYCLE.RETURNED).length,
    // "assigning" kept for legacy code = any non-warehouse non-deployed in-flight state
    assigning: devices.filter(d =>
      [LIFECYCLE.ASSIGN_REQUESTED, LIFECYCLE.ASSIGNED,
       LIFECYCLE.DEPLOY_REQUESTED, LIFECYCLE.RETURN_REQUESTED].includes(d.lifecycleStatus)
    ).length,
  }), [devices])

  // ── Component inventory (unchanged) ──────────────────────
  const componentInventory = useMemo(() => {
    const wh = devices.filter(d => d.lifecycleStatus === 'warehouse' && !d.setId)
    const count = (canonicalType) => wh.filter(d =>
      normalizeDeviceType(d.type) === canonicalType ||
      normalizeDeviceType(d.productType) === canonicalType
    ).length
    return {
      tvs:              count('tv'),
      tablets:          count('tablet'),
      aFrameStands:     count('stand'),
      iFrameStands:     count('istand'),
      mediaBoxes:       count('mediaBox'),
      batteries:        count('battery'),
      fabricationTablet: count('fabrication'),
    }
  }, [devices])

  // ── SCAN DEVICE — always fetches live from API ────────────
  // Fix for Bug 1 (stale scan result): never reads from local state
  const scanDevice = useCallback(async (barcode) => {
    return await deviceApi.getByBarcode(barcode.toUpperCase())
  }, [])

  // ── DEVICE CRUD (refresh after every mutation) ────────────
  const addDevice = useCallback(async (deviceData) => {
    const newDevice = await deviceApi.create({
      code: deviceData.code.toUpperCase(),
      type: deviceData.type,
      brand: deviceData.brand || null,
      size: deviceData.size || null,
      model: deviceData.model || null,
      color: deviceData.color || null,
      gpsId: deviceData.gpsId || null,
      inDate: deviceData.inDate || null,
      healthStatus: deviceData.healthStatus || 'ok',
      lifecycleStatus: deviceData.lifecycleStatus || 'warehouse',
      location: deviceData.location || null,
      state: deviceData.state || null,
      district: deviceData.district || null,
      pinpoint: deviceData.pinpoint || null,
      clientId: deviceData.clientId || null,
    })
    await refresh()
    return newDevice
  }, [refresh])

  const bulkAddDevices = useCallback(async (bulkData) => {
    const result = await deviceApi.bulkCreate(bulkData)
    await refresh()
    return result
  }, [refresh])

  const updateDevice = useCallback(async (deviceId, updates) => {
    const updatedDevice = await deviceApi.update(deviceId, updates)
    await refresh()
    return updatedDevice
  }, [refresh])

  const removeDevice = useCallback(async (deviceId) => {
    await deviceApi.delete(deviceId)
    await refresh()
  }, [refresh])

  const assignDeviceToClient = useCallback(async (deviceId, clientId, deploymentData = {}) => {
    const updates = {
      clientId,
      lifecycleStatus: deploymentData.lifecycleStatus || 'assign_requested',
      state: deploymentData.state || null,
      district: deploymentData.district || null,
      pinpoint: deploymentData.pinpoint || null,
    }
    const result = await updateDevice(deviceId, updates)
    return result
  }, [updateDevice])

  const unassignDevice = useCallback(async (deviceId) => {
    return await updateDevice(deviceId, {
      clientId: null,
      lifecycleStatus: 'warehouse',
      state: null, district: null, pinpoint: null,
    })
  }, [updateDevice])

  const bulkAssignDevices = useCallback(async (deviceIds, clientId) => {
    await deviceApi.bulkAssign(deviceIds, clientId)
    await refresh()
  }, [refresh])

  // ── LIFECYCLE WORKFLOW ACTIONS (new) ──────────────────────
  const requestAssign = useCallback(async (deviceId, clientId) => {
    const result = await lifecycleApi.requestAssign(deviceId, clientId)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const approveAssign = useCallback(async (deviceId) => {
    const result = await lifecycleApi.approveAssign(deviceId)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const rejectAssign = useCallback(async (deviceId, note) => {
    const result = await lifecycleApi.rejectAssign(deviceId, note)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const requestDeploy = useCallback(async (deviceId, locationData = {}) => {
    const result = await lifecycleApi.requestDeploy(deviceId, locationData)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const approveDeploy = useCallback(async (deviceId) => {
    const result = await lifecycleApi.approveDeploy(deviceId)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const rejectDeploy = useCallback(async (deviceId, note) => {
    const result = await lifecycleApi.rejectDeploy(deviceId, note)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const requestReturn = useCallback(async (deviceId, note) => {
    const result = await lifecycleApi.requestReturn(deviceId, note)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const approveReturn = useCallback(async (deviceId) => {
    const result = await lifecycleApi.approveReturn(deviceId)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  const rejectReturn = useCallback(async (deviceId, note) => {
    const result = await lifecycleApi.rejectReturn(deviceId, note)
    if (result.error) throw new Error(result.error)
    await refresh()
    return result
  }, [refresh])

  // ── CLIENT CRUD (refresh after every mutation) ────────────
  // CHANGED: subscription fields stripped before sending
  const addClient = useCallback(async (clientData) => {
    const { subscriptionStart, subscriptionEnd, ...cleanData } = clientData
    const newClient = await clientApi.create(cleanData)
    await refresh()
    return newClient
  }, [refresh])

  const updateClient = useCallback(async (clientId, updates) => {
    const { subscriptionStart, subscriptionEnd, ...cleanUpdates } = updates
    const updated = await clientApi.update(clientId, cleanUpdates)
    await refresh()
    return updated
  }, [refresh])

  const removeClient = useCallback(async (clientId) => {
    await clientApi.delete(clientId)
    await refresh()
  }, [refresh])

  const getClientById = useCallback((clientId) => {
    return clients.find(c => c.id === clientId)
  }, [clients])

  const loadClients = fetchClients

  // ── DEVICE QUERIES (unchanged) ────────────────────────────
  const getDevicesByType = useCallback((type) =>
    devices.filter(d => d.type === type), [devices])

  const getDevicesByClientId = useCallback((clientId) =>
    devices.filter(d => d.clientId === clientId), [devices])

  const getDevicesByLifecycle = useCallback((lifecycleStatus) =>
    devices.filter(d => getDeviceLifecycleStatus(d) === lifecycleStatus), [devices])

  const getUniqueDeviceFilterOptions = useCallback(() => {
    const brands    = [...new Set(devices.map(d => d.brand).filter(Boolean))]
    const sizes     = [...new Set(devices.map(d => d.size).filter(Boolean))]
    const models    = [...new Set(devices.map(d => d.model).filter(Boolean))]
    const states    = [...new Set(devices.map(d => d.state).filter(Boolean))]
    const districts = [...new Set(devices.map(d => d.district).filter(Boolean))]
    return { brands, sizes, models, states, districts }
  }, [devices])

  // ── DEVICE SETS (unchanged, with refresh) ────────────────
  const createDeviceSet = useCallback(async (setData) => {
    const newSet = await setApi.create(setData)
    await refresh()
    return newSet
  }, [refresh])

  const updateDeviceSet = useCallback(async (setId, updates) => {
    const updated = await setApi.update(setId, updates)
    await refresh()
    return updated
  }, [refresh])

  const disassembleSet = useCallback(async (setId, componentUpdates) => {
    await setApi.disassemble(setId, componentUpdates)
    await refresh()
  }, [refresh])

  const deleteDeviceSet = useCallback(async (setId) => {
    await setApi.delete(setId)
    await refresh()
  }, [refresh])

  const getAvailableDevicesForComponent = useCallback((deviceType) =>
    devices.filter(d =>
      (normalizeDeviceType(d.type) === deviceType || normalizeDeviceType(d.productType) === deviceType) &&
      getDeviceLifecycleStatus(d) === 'warehouse' &&
      !d.setId && !d.clientId
    ), [devices])

  const getSetByBarcode = useCallback(async (barcode) => {
    try { return await setApi.getByBarcode(barcode) }
    catch { return null }
  }, [])

  const loadSets = fetchSets

  // ── LOCATION (unchanged) ──────────────────────────────────
  const getLocationHierarchy = useCallback(() => {
    const hierarchy = {}
    devices.forEach(d => {
      const lifecycle = getDeviceLifecycleStatus(d)
      if (lifecycle === 'warehouse') {
        if (!hierarchy['Warehouse']) hierarchy['Warehouse'] = {}
        if (!hierarchy['Warehouse']['']) hierarchy['Warehouse'][''] = {}
        const loc = d.location || 'Warehouse A'
        if (!hierarchy['Warehouse'][''][loc]) hierarchy['Warehouse'][''][loc] = []
        hierarchy['Warehouse'][''][loc].push(d)
      } else if (d.state) {
        if (!hierarchy[d.state]) hierarchy[d.state] = {}
        const district = d.district || ''
        if (!hierarchy[d.state][district]) hierarchy[d.state][district] = {}
        const loc = d.location || ''
        if (!hierarchy[d.state][district][loc]) hierarchy[d.state][district][loc] = []
        hierarchy[d.state][district][loc].push(d)
      }
    })
    return hierarchy
  }, [devices])

  const getLocationSummary = useCallback(() => {
    const rows = {}
    devices.forEach(d => {
      let state, district, location
      const lifecycle = getDeviceLifecycleStatus(d)
      if (lifecycle === 'warehouse') {
        state = 'Warehouse'; district = '—'; location = d.location || 'Warehouse A'
      } else {
        state = d.state || '—'; district = d.district || '—'; location = d.location || '—'
      }
      const key = `${state}|${district}|${location}`
      if (!rows[key]) rows[key] = { state, district, location, total: 0, inStock: 0, deployed: 0 }
      rows[key].total++
      if (lifecycle === 'warehouse') rows[key].inStock++
      else if (lifecycle === 'deployed') rows[key].deployed++
    })
    return Object.values(rows)
  }, [devices])

  const getDevicesByLocation = useCallback((state, district, location) =>
    devices.filter(d => {
      const lifecycle = getDeviceLifecycleStatus(d)
      if (state === 'Warehouse') return lifecycle === 'warehouse' && (d.location || 'Warehouse A') === location
      return d.state === state &&
        (district ? d.district === district : true) &&
        (location ? d.location === location : true)
    }), [devices])

  // ── REMINDERS (kept but subscription-independent) ─────────
  // NOTE: reminders no longer driven by client subscription dates
  // since those fields are removed. Kept as empty for now.
  const generateReminders = useCallback(() => {
    setReminders([])
  }, [])

  useEffect(() => { generateReminders() }, [generateReminders])

  const dismissReminder = useCallback((reminderId) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId))
  }, [])

  // extendSubscription kept for API compat but is now a no-op
  const extendSubscription = useCallback(async (_deviceId, _newEndDate) => {
    console.warn('extendSubscription: subscription fields have been removed from Client model')
  }, [])

  const returnDeviceFromClient = useCallback(async (deviceId) => {
    return await unassignDevice(deviceId)
  }, [unassignDevice])

  const value = {
    // State
    devices,
    clients,
    clientsLoading,
    reminders,
    loading,
    error,
    deviceSets,
    componentInventory,
    setsLoading,

    // NEW: derived state
    pendingApprovals,
    lifecycleCounts,

    // Refresh
    refresh,
    refreshDevices,

    // Scan (always live — fixes Bug 1)
    scanDevice,

    // Device CRUD
    addDevice,
    bulkAddDevices,
    updateDevice,
    removeDevice,
    assignDeviceToClient,
    unassignDevice,
    bulkAssignDevices,

    // NEW: Lifecycle workflow
    requestAssign,
    approveAssign,
    rejectAssign,
    requestDeploy,
    approveDeploy,
    rejectDeploy,
    requestReturn,
    approveReturn,
    rejectReturn,

    // Client CRUD
    addClient,
    updateClient,
    removeClient,
    getClientById,
    loadClients,

    // Device queries
    getDevicesByType,
    getDevicesByClientId,
    getDevicesByLifecycle,
    getUniqueDeviceFilterOptions,

    // Sets
    createDeviceSet,
    updateDeviceSet,
    disassembleSet,
    deleteDeviceSet,
    getAvailableDevicesForComponent,
    getSetByBarcode,
    loadSets,

    // Location
    getLocationHierarchy,
    getLocationSummary,
    getDevicesByLocation,

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