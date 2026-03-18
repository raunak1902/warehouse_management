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
  // New unified lifecycle statuses
  AVAILABLE:         'available',
  WAREHOUSE:         'available',          // legacy alias
  ASSIGNING:         'assigning',
  ASSIGN_REQUESTED:  'assigning',          // legacy alias
  ASSIGNED:          'assigning',          // legacy alias
  READY_TO_DEPLOY:   'ready_to_deploy',
  DEPLOY_REQUESTED:  'ready_to_deploy',    // legacy alias
  IN_TRANSIT:        'in_transit',
  RECEIVED:          'received',
  INSTALLED:         'installed',
  ACTIVE:            'active',
  DEPLOYED:          'active',             // legacy alias
  UNDER_MAINTENANCE: 'under_maintenance',
  RETURN_INITIATED:  'return_initiated',
  RETURN_REQUESTED:  'return_initiated',   // legacy alias
  RETURN_TRANSIT:    'return_transit',
  RETURNED:          'returned',
  HEALTH_UPDATE:     'health_update',
  LOST:              'lost',
}

export const LIFECYCLE_LABELS = {
  available:         'In Warehouse',
  assigning:         'Assigning to Client',
  ready_to_deploy:   'Ready to Deploy',
  in_transit:        'In Transit',
  received:          'Received at Site',
  installed:         'Installed',
  active:            'Active / Live',
  under_maintenance: 'Under Maintenance',
  return_initiated:  'Return Initiated',
  return_transit:    'Return In Transit',
  returned:          'Returned',
  lost:              'Lost',
  health_update:     'Health Update',
  pending_set_assignment: 'Pending Set Assignment',
  // legacy fallbacks
  warehouse:         'In Warehouse',
  assign_requested:  'Assigning to Client',
  assigned:          'Assigning to Client',
  deploy_requested:  'Ready to Deploy',
  deployed:          'Active / Live',
  return_requested:  'Return Initiated',
}

export const LIFECYCLE_COLORS = {
  available:         { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  assigning:         { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  ready_to_deploy:   { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500'   },
  in_transit:        { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  received:          { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  installed:         { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  active:            { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  under_maintenance: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  return_initiated:  { bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-400'   },
  return_transit:    { bg: 'bg-pink-100',   text: 'text-pink-700',   dot: 'bg-pink-400'   },
  returned:          { bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
  lost:              { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  health_update:     { bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500'   },
  pending_set_assignment: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400' },
  // legacy fallbacks
  warehouse:         { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  assign_requested:  { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  assigned:          { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  deploy_requested:  { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500'   },
  deployed:          { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  return_requested:  { bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-400'   },
}

export const HEALTH_COLORS = {
  ok:     { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Healthy' },
  repair: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Needs Repair' },
  damage: { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500',   label: 'Damaged' },
  lost:   { bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400',  label: 'Lost' },
}

// ─────────────────────────────────────────────────────────────
// LEGACY EXPORTS (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────
export const DEVICE_TYPES = {
  stand: 'A stand',
  istand: 'I stand',
  tablet: 'Tablet',
}


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

// ─────────────────────────────────────────────────────────────
// LIFECYCLE BUCKET MAPPING
// Maps granular lifecycleStatus values → 3 display buckets used
// throughout the Devices page filters and counters.
//
//  deployed  → active, under_maintenance (device is at client site)
//  assigning → assigning, ready_to_deploy, in_transit, received,
//              installed, return_initiated, return_transit
//              (device is in motion — leaving warehouse or coming back)
//  warehouse → available, returned  (device is physically in warehouse)
// ─────────────────────────────────────────────────────────────
const DEPLOYED_STEPS  = new Set(['active', 'under_maintenance', 'deployed'])
const ASSIGNING_STEPS = new Set([
  'assigning', 'assign_requested', 'assigned',
  'ready_to_deploy', 'deploy_requested',
  'in_transit',
  'received',
  'installed',
  'return_initiated', 'return_requested',
  'return_transit',
])
const WAREHOUSE_STEPS = new Set(['available', 'warehouse', 'returned'])

export const getDeviceLifecycleStatus = (device) => {
  const s = device.lifecycleStatus
  if (!s) {
    // Legacy fallback: derive from clientId/location fields
    if (!device.clientId) return 'warehouse'
    if (device.clientId && (device.state || device.district || device.pinpoint)) return 'deployed'
    return 'assigning'
  }
  if (DEPLOYED_STEPS.has(s))  return 'deployed'
  if (ASSIGNING_STEPS.has(s)) return 'assigning'
  if (WAREHOUSE_STEPS.has(s)) return 'warehouse'
  // Unknown status — treat as warehouse so device is still visible
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

// ── Unified lifecycle API — all transitions go through POST /lifecycle-requests ──

// Helper: build FormData payload supporting optional proof files
const buildLifecycleFormData = (fields, files = []) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)) })
  files.forEach(f => fd.append('proofFiles', f))
  return fd
}

// Auth headers WITHOUT Content-Type — browser sets multipart boundary automatically
const getAuthHeadersMultipart = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const lifecycleApi = {
  // Submit any step — sends FormData to support proof file attachments
  submitStep: (deviceId, toStep, note = null, healthStatus = 'ok', healthNote = null, files = []) =>
    fetch(`${API_BASE}/lifecycle-requests`, {
      method: 'POST',
      headers: getAuthHeadersMultipart(),
      body: buildLifecycleFormData({ deviceId, toStep, note, healthStatus, healthNote }, files),
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.message || data.error || `Error ${r.status}`)
      return data
    }),

  submitSetStep: (setId, toStep, note = null, healthStatus = 'ok', healthNote = null, files = []) =>
    fetch(`${API_BASE}/lifecycle-requests`, {
      method: 'POST',
      headers: getAuthHeadersMultipart(),
      body: buildLifecycleFormData({ setId, toStep, note, healthStatus, healthNote }, files),
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.message || data.error || `Error ${r.status}`)
      return data
    }),

  approve: (requestId) =>
    fetch(`${API_BASE}/lifecycle-requests/${requestId}/approve`, {
      method: 'PATCH', headers: getAuthHeaders(),
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.message || data.error || `Error ${r.status}`)
      return data
    }),

  reject: (requestId, rejectionNote) =>
    fetch(`${API_BASE}/lifecycle-requests/${requestId}/reject`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rejectionNote }),
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.message || data.error || `Error ${r.status}`)
      return data
    }),

  // Get the active pending request for a specific device (null if none)
  getDevicePending: (deviceId) =>
    fetch(`${API_BASE}/lifecycle-requests/device/${deviceId}/pending`, { headers: getAuthHeaders() })
      .then(r => r.json()),

  // Get the active pending request for a specific set (null if none)
  getSetPending: (setId) =>
    fetch(`${API_BASE}/lifecycle-requests/set/${setId}/pending`, { headers: getAuthHeaders() })
      .then(r => r.json()),

  // Withdraw / cancel a pending request (rolls device back to fromStep)
  withdraw: (requestId) =>
    fetch(`${API_BASE}/lifecycle-requests/${requestId}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.message || data.error || `Error ${r.status}`)
      return data
    }),

  getPending: () =>
    fetch(`${API_BASE}/lifecycle-requests?status=pending`, { headers: getAuthHeaders() }).then(r => r.json()),

  getHistory: (deviceId) =>
    fetch(`${API_BASE}/lifecycle-requests/device/${deviceId}/history`, { headers: getAuthHeaders() }).then(r => r.json()),
  getSetHistory: (setId) =>
    fetch(`${API_BASE}/lifecycle-requests/set/${setId}/history`, { headers: getAuthHeaders() }).then(r => r.json()),
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

  const pendingApprovals = useMemo(() =>
    devices.filter(d => [
      'assigning', 'ready_to_deploy', 'in_transit',
      'received', 'installed', 'return_initiated',
    ].includes(d.lifecycleStatus))
  , [devices])

  // ── Derived: lifecycle counts ─────────────────────────────
  const lifecycleCounts = useMemo(() => ({
    total:           devices.length,
    warehouse:       devices.filter(d => getDeviceLifecycleStatus(d) === 'warehouse').length,
    assigning:       devices.filter(d => d.lifecycleStatus === 'assigning').length,
    readyToDeploy:   devices.filter(d => d.lifecycleStatus === 'ready_to_deploy').length,
    inTransit:       devices.filter(d => d.lifecycleStatus === 'in_transit').length,
    received:        devices.filter(d => d.lifecycleStatus === 'received').length,
    installed:       devices.filter(d => d.lifecycleStatus === 'installed').length,
    active:          devices.filter(d => d.lifecycleStatus === 'active').length,
    underMaintenance:devices.filter(d => d.lifecycleStatus === 'under_maintenance').length,
    returnInitiated: devices.filter(d => d.lifecycleStatus === 'return_initiated').length,
    returned:        devices.filter(d => d.lifecycleStatus === 'returned').length,
    lost:            devices.filter(d => d.lifecycleStatus === 'lost').length,
    // legacy aliases for existing dashboard components
    deployed:        devices.filter(d => d.lifecycleStatus === 'active').length,
    assignRequested: devices.filter(d => d.lifecycleStatus === 'assigning').length,
    deployRequested: devices.filter(d => d.lifecycleStatus === 'ready_to_deploy').length,
    returnRequested: devices.filter(d => d.lifecycleStatus === 'return_initiated').length,
  }), [devices])

  // ── Component inventory (unchanged) ──────────────────────
  const componentInventory = useMemo(() => {
    // Use getDeviceLifecycleStatus to match Devices page bucket logic exactly.
    // This includes 'available', 'warehouse', AND 'returned' statuses in the warehouse bucket.
    const wh = devices.filter(d => getDeviceLifecycleStatus(d) === 'warehouse' && !d.setId)
    const count = (canonicalType) => wh.filter(d =>
      normalizeDeviceType(d.type) === canonicalType ||
      normalizeDeviceType(d.productType) === canonicalType
    ).length
    return {
      tvs:              count('TV'),
      tablets:          count('TAB'),
      aFrameStands:     count('AST'),
      iFrameStands:     count('IST'),
      mediaBoxes:       count('MB'),
      batteries:        count('BAT'),
      fabricationTablet: count('TST'),
      mouse:            count('MSE'),
      charger:          count('charger'),
      touchTv:          count('TTV'),
    }
  }, [devices])

  // ── Enhanced Dashboard Statistics ────────────────────────
  const dashboardStats = useMemo(() => {
    // Use getDeviceLifecycleStatus to match Devices page bucket logic exactly.
    // This includes 'available', 'warehouse', AND 'returned' statuses in the warehouse bucket.
    const wh = devices.filter(d => getDeviceLifecycleStatus(d) === 'warehouse' && !d.setId)
    const count = (canonicalType) => wh.filter(d =>
      normalizeDeviceType(d.type) === canonicalType ||
      normalizeDeviceType(d.productType) === canonicalType
    ).length

    // Materials in stock - all device types with counts
    const materialsInStock = {
      tv: count('TV'),
      tablet: count('TAB'),
      mediaBox: count('MB'),
      battery: count('BAT'),
      aStand: count('AST'),
      iStand: count('IST'),
      tabletStand: count('TST'),
      mouse: count('MSE'),
      charger: count('charger'),
      touchTv: count('TTV'),
    }

    // ── Lifecycle step sets — used for both devices and sets ──
    const WAREHOUSE_SET_STEPS  = new Set(['available', 'warehouse', 'returned'])
    const DEPLOYED_STEPS_ALL   = new Set(['active', 'deployed', 'installed', 'under_maintenance'])
    const OUT_OF_WH_STEPS_ALL  = new Set(['assigning', 'assign_requested', 'assigned', 'ready_to_deploy', 'deploy_requested', 'in_transit', 'received'])
    const RETURN_STEPS_ALL     = new Set(['return_initiated', 'return_requested', 'return_transit', 'returned'])

    // Helper: count devices (excl. those in sets) + sets with a given lifecycleStatus predicate
    const countBoth = (devicePred, setPred) =>
      devices.filter(d => !d.setId && devicePred(d.lifecycleStatus)).length +
      deviceSets.filter(s => setPred(s.lifecycleStatus)).length

    // Available sets — assembled sets sitting in warehouse
    const availableSets = {
      aStand:      deviceSets.filter(s => s.setType === 'aStand'      && WAREHOUSE_SET_STEPS.has(s.lifecycleStatus)).length,
      iStand:      deviceSets.filter(s => s.setType === 'iStand'      && WAREHOUSE_SET_STEPS.has(s.lifecycleStatus)).length,
      tabletCombo: deviceSets.filter(s => s.setType === 'tabletCombo' && WAREHOUSE_SET_STEPS.has(s.lifecycleStatus)).length,
    }

    // Deployed — devices + sets currently installed/active/under maintenance
    const deployedSets = {
      total:            countBoth(s => DEPLOYED_STEPS_ALL.has(s), s => DEPLOYED_STEPS_ALL.has(s)),
      installed:        countBoth(s => s === 'installed',          s => s === 'installed'),
      active:           countBoth(s => ['active','deployed'].includes(s), s => ['active','deployed'].includes(s)),
      underMaintenance: countBoth(s => s === 'under_maintenance',  s => s === 'under_maintenance'),
    }

    // Active — individual devices + sets that are live
    const activeDevices = countBoth(
      s => ['active', 'deployed'].includes(s),
      s => ['active', 'deployed'].includes(s)
    )

    // Out of warehouse — individual devices + sets in assignment/delivery pipeline
    const outOfWarehouse = {
      total:         countBoth(s => OUT_OF_WH_STEPS_ALL.has(s), s => OUT_OF_WH_STEPS_ALL.has(s)),
      assigning:     countBoth(s => ['assigning','assign_requested','assigned'].includes(s), s => ['assigning','assign_requested','assigned'].includes(s)),
      readyToDeploy: countBoth(s => ['ready_to_deploy','deploy_requested'].includes(s), s => ['ready_to_deploy','deploy_requested'].includes(s)),
      inTransit:     countBoth(s => s === 'in_transit',  s => s === 'in_transit'),
      received:      countBoth(s => s === 'received',    s => s === 'received'),
    }

    // Return pipeline — individual devices + sets coming back
    const returnPipeline = {
      total:           countBoth(s => RETURN_STEPS_ALL.has(s), s => RETURN_STEPS_ALL.has(s)),
      returnInitiated: countBoth(s => ['return_initiated','return_requested'].includes(s), s => ['return_initiated','return_requested'].includes(s)),
      returnTransit:   countBoth(s => s === 'return_transit', s => s === 'return_transit'),
      returned:        countBoth(s => s === 'returned',       s => s === 'returned'),
    }

    // Devices needing attention
    const needsAttention = {
      total: devices.filter(d => ['repair', 'damage'].includes(d.healthStatus)).length,
      repair: devices.filter(d => d.healthStatus === 'repair').length,
      damage: devices.filter(d => d.healthStatus === 'damage').length,
    }

    // Bug 1 fix: Low stock alerts — include zero-stock items (count < 5, was incorrectly count > 0 && count < 5)
    const lowStockAlerts = Object.entries(materialsInStock)
      .filter(([_, count]) => count < 5)
      .map(([type, count]) => ({ type, count }))

    // Health distribution
    const healthDistribution = {
      ok: devices.filter(d => d.healthStatus === 'ok').length,
      repair: devices.filter(d => d.healthStatus === 'repair').length,
      damage: devices.filter(d => d.healthStatus === 'damage').length,
    }

    // Location insights
    const locationInsights = {
      warehouse: devices.filter(d => getDeviceLifecycleStatus(d) === 'warehouse').length,
      deployed: deployedSets.total,
      inTransit: outOfWarehouse.total,
      returning: returnPipeline.total,
    }

    return {
      materialsInStock,
      availableSets,
      deployedSets,
      activeDevices: activeDevices,
      outOfWarehouse,
      returnPipeline,
      needsAttention,
      lowStockAlerts,
      healthDistribution,
      locationInsights,
    }
  }, [devices, deviceSets])

  // ── SCAN DEVICE — always fetches live from API ────────────
  // Tries device barcode first; if 404, tries set barcode.
  // Returns the result tagged with _isSet so callers can distinguish.
  const scanDevice = useCallback(async (barcode) => {
    const upper = barcode.toUpperCase()
    try {
      const device = await deviceApi.getByBarcode(upper)
      return { ...device, _isSet: false }
    } catch (err) {
      // If device not found, try as a set barcode
      if (err?.response?.status === 404 || err?.status === 404) {
        try {
          const set = await setApi.getByBarcode(upper)
          if (!set) throw new Error('Barcode not found for any device or set.')
          // Fetch set history in parallel
          let history = []
          try { history = await lifecycleApi.getSetHistory(set.id) } catch (_) {}
          // Normalise set fields to match device shape for BarcodeResultCard
          return {
            ...set,
            _isSet: true,
            type: set.setTypeName || set.setType,
            brand: null,
            model: null,
            color: null,
            lifecycleStatus: set.lifecycleStatus || 'warehouse',
            healthStatus: set.healthStatus || 'ok',
            history,
          }
        } catch (setErr) {
          throw new Error('Barcode not found for any device or set.')
        }
      }
      throw err
    }
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

  // ── LIFECYCLE WORKFLOW ACTIONS ────────────────────────────
  // Ground team: creates pending request. Manager/SuperAdmin: auto-approved.
  const submitLifecycleStep = useCallback(async (deviceId, toStep, note = null, healthStatus = 'ok', healthNote = null, files = []) => {
    const result = await lifecycleApi.submitStep(deviceId, toStep, note, healthStatus, healthNote, files)
    await refresh()
    return result
  }, [refresh])

  const submitSetLifecycleStep = useCallback(async (setId, toStep, note = null, healthStatus = 'ok', healthNote = null, files = []) => {
    const result = await lifecycleApi.submitSetStep(setId, toStep, note, healthStatus, healthNote, files)
    await refresh()
    return result
  }, [refresh])

  // Get active pending request for a device/set (used by BarcodeResultCard)
  const getPendingRequest = useCallback(async (deviceId) => {
    return lifecycleApi.getDevicePending(deviceId)
  }, [])

  const getSetPendingRequest = useCallback(async (setId) => {
    return lifecycleApi.getSetPending(setId)
  }, [])

  // Withdraw a pending request — rolls device back to previous step
  const withdrawLifecycleRequest = useCallback(async (requestId) => {
    const result = await lifecycleApi.withdraw(requestId)
    await refresh()
    return result
  }, [refresh])

  // Approve / reject — for managers acting from the barcode card
  const approveLifecycleRequest = useCallback(async (requestId) => {
    const result = await lifecycleApi.approve(requestId)
    await refresh()
    return result
  }, [refresh])

  const rejectLifecycleRequest = useCallback(async (requestId, rejectionNote) => {
    const result = await lifecycleApi.reject(requestId, rejectionNote)
    await refresh()
    return result
  }, [refresh])

  // Legacy named helpers — kept so existing code that calls these still works
  const requestAssign = useCallback(async (deviceId, clientId) => {
    const note = JSON.stringify({ clientId })
    return submitLifecycleStep(deviceId, 'assigning', note)
  }, [submitLifecycleStep])

  const approveAssign = useCallback(async () => {
    console.warn('approveAssign: approval now handled by manager role auto-approve or admin panel')
  }, [])

  const rejectAssign = useCallback(async () => {
    console.warn('rejectAssign: rejection now handled via admin panel')
  }, [])

  const requestDeploy = useCallback(async (deviceId, locationData = {}) => {
    return submitLifecycleStep(deviceId, 'ready_to_deploy', JSON.stringify(locationData))
  }, [submitLifecycleStep])

  const approveDeploy = useCallback(async () => {
    console.warn('approveDeploy: approval now handled by manager role auto-approve or admin panel')
  }, [])

  const rejectDeploy = useCallback(async () => {
    console.warn('rejectDeploy: rejection now handled via admin panel')
  }, [])

  const requestReturn = useCallback(async (deviceId, note) => {
    return submitLifecycleStep(deviceId, 'return_initiated', note)
  }, [submitLifecycleStep])

  const approveReturn = useCallback(async () => {
    console.warn('approveReturn: approval now handled by manager role auto-approve or admin panel')
  }, [])

  const rejectReturn = useCallback(async () => {
    console.warn('rejectReturn: rejection now handled via admin panel')
  }, [])

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
    dashboardStats,

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

    // Lifecycle workflow
    submitLifecycleStep,
    submitSetLifecycleStep,
    getPendingRequest,
    getSetPendingRequest,
    withdrawLifecycleRequest,
    approveLifecycleRequest,
    rejectLifecycleRequest,
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