import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middleware/auth.js";
import { requirePermission, requireAnyPermission } from "../middleware/Permissions.js";
import { scheduleDeletion } from "./deletionRequests.js";


const router = express.Router();
const prisma = new PrismaClient();

// ── Sync set health to worst component ────────────────────────────────────────
// Health priority: lost (4) > damage (3) > repair (2) > ok (1)
const HEALTH_RANK_DEV = { ok: 1, repair: 2, damage: 3, lost: 4 }

async function syncSetHealthForDevice(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { setId: true } })
  if (!device?.setId) return
  
  const members = await prisma.device.findMany({
    where: { setId: device.setId },
    select: { healthStatus: true },
  })
  
  if (!members.length) {
    await prisma.deviceSet.update({
      where: { id: device.setId },
      data: { healthStatus: 'lost', updatedAt: new Date() },
    })
    return
  }
  
  // Find worst health status among all components
  let worstHealth = 'ok'
  let maxRank = HEALTH_RANK_DEV.ok
  
  for (const member of members) {
    const health = member.healthStatus || 'ok'
    const rank = HEALTH_RANK_DEV[health] ?? HEALTH_RANK_DEV.ok
    if (rank > maxRank) {
      maxRank = rank
      worstHealth = health
    }
  }
  
  // Special case: if any component is lost, mark set as "incomplete" (lost status)
  const hasLostComponent = members.some(m => m.healthStatus === 'lost')
  if (hasLostComponent) {
    worstHealth = 'lost'
  }
  
  await prisma.deviceSet.update({
    where: { id: device.setId },
    data: { healthStatus: worstHealth, updatedAt: new Date() },
  })
}

// ==========================================
// LIFECYCLE STATUS CONSTANTS
// ==========================================
export const LIFECYCLE = {
  // ── Current status names (unified lifecycle system) ────────────────────────
  WAREHOUSE:        "available",        // was "warehouse"    → now "available"
  ASSIGN_REQUESTED: "assigning",        // was "assign_requested" → now "assigning"
  ASSIGNED:         "assigning",        // was "assigned"     → now "assigning"
  DEPLOY_REQUESTED: "ready_to_deploy",  // was "deploy_requested" → now "ready_to_deploy"
  DEPLOYED:         "active",           // was "deployed"     → now "active"
  RETURN_REQUESTED: "return_initiated", // was "return_requested" → now "return_initiated"
  RETURNED:         "returned",         // unchanged
}

// =========================================
// UTILITY FUNCTIONS
// ==========================================

const generateBarcode = (deviceType) => {
  const prefix = 'EDSG'
  const typeCode = getTypeCode(deviceType)
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${typeCode}-${timestamp}-${random}`
}

const getTypeCode = (type) => {
  const typeCodes = {
    TV: 'TV', TAB: 'TAB', TTV: 'TTV', AST: 'AST', IST: 'IST',
    TST: 'TST', MB: 'MB', BAT: 'BAT', MSE: 'MSE', W: 'W',
    tv: 'TV', tablet: 'TAB', 'touch-tv': 'TTV',
    'a-stand': 'AST', 'i-stand': 'IST', 'tablet-stand': 'TST',
    stand: 'AST', istand: 'IST', mediaBox: 'MB', battery: 'BAT', fabrication: 'TST',
  }
  if (type && type.startsWith('custom-')) return type.replace('custom-', '').toUpperCase()
  return typeCodes[type] || type.toUpperCase() || 'DEV'
}

const normalizeCode = (code) => {
  if (!code) return ''
  const upper = code.trim().toUpperCase()
  const lastHyphen = upper.lastIndexOf('-')
  if (lastHyphen === -1) return upper
  const prefix = upper.slice(0, lastHyphen)
  const suffix = upper.slice(lastHyphen + 1)
  if (/^\d+$/.test(suffix)) return `${prefix}-${parseInt(suffix, 10)}`
  return upper
}

// Hardcoded fallback map (used if DB lookup fails)
const CODE_PREFIX_MAP = {
  TV: 'TV', TAB: 'TAB', TTV: 'TTV', AST: 'ATV', IST: 'ITV',
  TST: 'TST', MB: 'MB', BAT: 'BAT', MSE: 'MSE', W: 'W',
  tv: 'TV', tablet: 'TAB', 'touch-tv': 'TTV',
  'a-stand': 'ATV', 'i-stand': 'ITV', 'tablet-stand': 'TST',
  stand: 'ATV', istand: 'ITV', mediaBox: 'MB', battery: 'BAT', fabrication: 'TST',
}

// DB-backed async prefix lookup with hardcoded fallback
const getExpectedPrefix = async (type) => {
  if (!type) return null
  // Try DB first
  try {
    const dbType = await prisma.productTypeConfig.findFirst({
      where: {
        OR: [
          { typeId: type },
          { typeId: type.toLowerCase() },
          { typeId: type.toUpperCase() },
        ],
        isActive: true,
      },
    })
    if (dbType?.prefix) return dbType.prefix
  } catch (e) {
    // DB not ready yet — fall through to hardcoded map
  }
  // Hardcoded fallback
  if (CODE_PREFIX_MAP[type]) return CODE_PREFIX_MAP[type]
  if (type.startsWith('custom-')) return type.replace('custom-', '').toUpperCase()
  if (/^[A-Z0-9]+$/.test(type)) return type
  return null
}

const validateCode = async (code, type, excludeId = null) => {
  const upper = code.trim().toUpperCase()
  const expectedPrefix = await getExpectedPrefix(type)
  const isCustom = type && type.startsWith('custom-')

  if (expectedPrefix && !isCustom && !upper.startsWith(expectedPrefix + '-')) {
    return { valid: false, error: `Code must start with "${expectedPrefix}-" for device type "${type}". Example: ${expectedPrefix}-001` }
  }
  if (expectedPrefix && !isCustom) {
    const suffix = upper.slice(expectedPrefix.length + 1)
    if (!suffix || !/^\d+$/.test(suffix)) {
      return { valid: false, error: `Code suffix must be numeric. Example: ${expectedPrefix}-001` }
    }
  }

  const allDevices = await prisma.device.findMany({ select: { id: true, code: true } })
  const normalizedInput = normalizeCode(upper)
  const duplicate = allDevices.find((d) => {
    if (excludeId && d.id === parseInt(excludeId)) return false
    return normalizeCode(d.code) === normalizedInput
  })

  if (duplicate) {
    return { valid: false, error: `Code "${upper}" already exists (TV-1, TV-01, TV-001 are treated as the same).` }
  }
  return { valid: true, error: null }
}

// ==========================================
// NEW: DeviceHistory logger
// ==========================================
const logHistory = async (deviceId, fromStatus, toStatus, changedById = null, note = null) => {
  try {
    await prisma.deviceHistory.create({
      data: { deviceId, fromStatus, toStatus, changedById, note },
    })
  } catch (e) {
    console.error("Failed to write DeviceHistory:", e)
  }
}

// ═══════════════════════════════════════════════════════════════════
// NEW: Location History logger
// ═══════════════════════════════════════════════════════════════════
const logLocationHistory = async (deviceId, locationData, userId, reason, notes = null) => {
  try {
    await prisma.deviceLocationHistory.create({
      data: {
        deviceId,
        warehouseId: locationData.warehouseId || null,
        warehouseZone: locationData.warehouseZone || null,
        warehouseSpecificLocation: locationData.warehouseSpecificLocation || null,
        clientId: locationData.clientId || null,
        deploymentState: locationData.deploymentState || null,
        deploymentDistrict: locationData.deploymentDistrict || null,
        deploymentSite: locationData.deploymentSite || null,
        latitude: locationData.latitude || null,
        longitude: locationData.longitude || null,
        googleMapsLink: locationData.googleMapsLink || null,
        changedById: userId,
        changeReason: reason,
        notes: notes,
        timestamp: new Date()
      }
    })
  } catch (e) {
    console.error("Failed to write DeviceLocationHistory:", e)
  }
}

// Standard include for device queries — now also includes history + warehouse
const DEVICE_INCLUDE = {
  client: true,
  warehouse: true,
  history: {
    orderBy: { changedAt: "desc" },
    take: 20,
  },
  deviceSet: { select: { id: true, code: true, setType: true } },
}

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get("/", authMiddleware, requirePermission("Devices", "read"), async (req, res) => {
  try {
    const devices = await prisma.device.findMany({ include: DEVICE_INCLUDE })
    res.json(devices)
  } catch (error) {
    console.error("Error fetching devices:", error)
    res.status(500).json({ error: "Failed to fetch devices" })
  }
})

// ─── GET /barcode/:barcode ────────────────────────────────────────────────────
router.get("/barcode/:barcode", authMiddleware, requirePermission("Devices", "read"), async (req, res) => {
  try {
    const { barcode } = req.params
    const device = await prisma.device.findUnique({
      where: { barcode: barcode.toUpperCase() },
      include: DEVICE_INCLUDE,
    })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device by barcode:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// ─── GET /code/:code ──────────────────────────────────────────────────────────
router.get("/code/:code", authMiddleware, requirePermission("Devices", "read"), async (req, res) => {
  try {
    const { code } = req.params
    const device = await prisma.device.findUnique({
      where: { code: code.toUpperCase() },
      include: DEVICE_INCLUDE,
    })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device by code:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get("/stats", authMiddleware, requirePermission("Devices", "read"), async (req, res) => {
  try {
    const [total, warehouse, assignRequested, assigned, deployRequested, deployed, returnRequested, returned, byType] =
      await Promise.all([
        prisma.device.count(),
        prisma.device.count({ where: { lifecycleStatus: "warehouse" } }),
        prisma.device.count({ where: { lifecycleStatus: "assign_requested" } }),
        prisma.device.count({ where: { lifecycleStatus: "assigned" } }),
        prisma.device.count({ where: { lifecycleStatus: "deploy_requested" } }),
        prisma.device.count({ where: { lifecycleStatus: "deployed" } }),
        prisma.device.count({ where: { lifecycleStatus: "return_requested" } }),
        prisma.device.count({ where: { lifecycleStatus: "returned" } }),
        prisma.device.groupBy({ by: ["type"], _count: true }),
      ])
    res.json({
      total,
      warehouse,
      assigning: assignRequested + assigned + deployRequested + returnRequested,
      deployed,
      returned,
      breakdown: { assignRequested, assigned, deployRequested, deployed, returnRequested, returned },
      byType: byType.map(item => ({ type: item.type, count: item._count })),
    })
  } catch (error) {
    console.error("Error fetching device statistics:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

// ─── GET /:id/history ────────────────────────────────────────────────────────
router.get("/:id/history", authMiddleware, requirePermission("Devices", "view_history"), async (req, res) => {
  try {
    const history = await prisma.deviceHistory.findMany({
      where: { deviceId: parseInt(req.params.id) },
      orderBy: { changedAt: "desc" },
    })
    res.json(history)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch device history" })
  }
})

// ═══════════════════════════════════════════════════════════════════
// NEW: GET /:id/location-history
// ═══════════════════════════════════════════════════════════════════
router.get("/:id/location-history", authMiddleware, requirePermission("Devices", "read"), async (req, res) => {
  try {
    const locationHistory = await prisma.deviceLocationHistory.findMany({
      where: { deviceId: parseInt(req.params.id) },
      orderBy: { timestamp: "desc" },
      include: {
        warehouse: { select: { name: true } },
        client:    { select: { name: true } },
        changedBy: { select: { id: true, name: true, role: { select: { name: true } } } },
      }
    })
    res.json(locationHistory)
  } catch (error) {
    console.error("Error fetching location history:", error)
    res.status(500).json({ error: "Failed to fetch location history" })
  }
})

// ─── GET /next-codes ────────────────────────────────────────────────────────────────────
router.get("/next-codes", authMiddleware, async (req, res) => {
  try {
    const { prefix, qty = 1 } = req.query
    if (!prefix) return res.status(400).json({ error: "prefix is required" })
    const quantity = Math.max(1, Math.min(500, parseInt(qty) || 1))

    const allDevices = await prisma.device.findMany({ select: { code: true } })
    const occupied = new Set(
      allDevices
        .filter(d => d.code && d.code.toUpperCase().startsWith(prefix.toUpperCase() + "-"))
        .map(d => {
          const s = d.code.toUpperCase().slice(prefix.length + 1)
          return /^\d+$/.test(s) ? parseInt(s, 10) : 0
        })
        .filter(n => n > 0)
    )
    const codes = []
    let next = 1
    while (codes.length < quantity) {
      if (!occupied.has(next)) codes.push(`${prefix.toUpperCase()}-${String(next).padStart(3, "0")}`)
      next++
    }
    const first = codes[0]
    const last  = codes[codes.length - 1]
    const range = quantity === 1 ? first : `${first} \u2192 ${last}`
    res.json({ range, first, last, quantity, codes })
  } catch (error) {
    console.error("Error computing next codes:", error)
    res.status(500).json({ error: "Failed to compute next codes" })
  }
})

// ─── POST /bulk-add ───────────────────────────────────────────────────────────────────
router.post("/bulk-add", authMiddleware, requirePermission("Devices", "create"), async (req, res) => {
  try {
    const {
      type, brand, size, color, model, gpsId, inDate, mfgDate,
      healthStatus, lifecycleStatus, location,
      warehouseId, warehouseZone, warehouseSpecificLocation,
      quantity = 1,
    } = req.body

    if (!type) return res.status(400).json({ error: "type is required" })
    const qty = Math.max(1, Math.min(500, parseInt(quantity) || 1))
    const prefix = await getExpectedPrefix(type) || type.toUpperCase()

    const allDevices = await prisma.device.findMany({ select: { code: true } })
    const occupied = new Set(
      allDevices
        .filter(d => d.code && d.code.toUpperCase().startsWith(prefix + "-"))
        .map(d => {
          const s = d.code.toUpperCase().slice(prefix.length + 1)
          return /^\d+$/.test(s) ? parseInt(s, 10) : 0
        })
        .filter(n => n > 0)
    )

    const codes = []
    let next = 1
    while (codes.length < qty) {
      if (!occupied.has(next)) codes.push(`${prefix}-${String(next).padStart(3, "0")}`)
      next++
    }

    const whId = warehouseId ? parseInt(warehouseId) : null
    const lsStatus = lifecycleStatus || "warehouse"
    const inDateParsed = (inDate || mfgDate) ? new Date(inDate || mfgDate) : null
    const created = []

    for (const code of codes) {
      let barcode = generateBarcode(type)
      const existingBarcode = await prisma.device.findUnique({ where: { barcode } })
      if (existingBarcode) {
        barcode = barcode + "-" + Math.random().toString(36).substring(2, 4).toUpperCase()
      }
      const device = await prisma.device.create({
        data: {
          code, barcode, type,
          brand: brand || null, size: size || null, model: model || null,
          color: color || null, gpsId: gpsId || null,
          mfgDate: inDateParsed,
          healthStatus: healthStatus || "ok",
          lifecycleStatus: lsStatus,
          location: location || null,
          warehouseId: whId,
          warehouseZone: warehouseZone || null,
          warehouseSpecificLocation: warehouseSpecificLocation || null,
        },
        include: DEVICE_INCLUDE,
      })
      await logHistory(device.id, "created", lsStatus, req.user?.userId || null, "Bulk add to inventory")
      if (whId) {
        await logLocationHistory(
          device.id,
          { warehouseId: whId, warehouseZone, warehouseSpecificLocation },
          req.user?.userId || null,
          "added",
          "Bulk add to inventory"
        )
      }
      created.push(device)
    }

    res.status(201).json({ devices: created, count: created.length })
  } catch (error) {
    console.error("Error bulk adding devices:", error)
    res.status(500).json({ error: "Failed to bulk add devices" })
  }
})

router.put("/:id", authMiddleware, requirePermission("Devices", "update"), async (req, res) => {
  try {
    const { id } = req.params
    const { 
      code, barcode, type, brand, size, model, color, gpsId, mfgDate, inDate,
      lifecycleStatus, location, state, district, pinpoint, clientId, healthStatus,
      subscriptionEndDate, superAdminOverride,
      // NEW: Warehouse location fields
      warehouseId, warehouseZone, warehouseSpecificLocation,
      // NEW: Deployment location fields
      deploymentState, deploymentDistrict, deploymentSite,
      latitude, longitude, googleMapsLink,
      // NEW: Assignment fields
      returnDate, assignmentHealth, assignmentHealthNote
    } = req.body

    const existingDevice = await prisma.device.findUnique({ where: { id: parseInt(id) } })
    if (!existingDevice) return res.status(404).json({ error: "Device not found" })

    const lifecycleFields = [lifecycleStatus, location, state, district, clientId, deploymentState, deploymentDistrict, deploymentSite]
    const touchingLifecycle = lifecycleFields.some(f => f !== undefined)
    if (existingDevice.setId && touchingLifecycle) {
      const isSuperAdmin = (req.user?.role ?? '').toLowerCase().replace(/[\s_-]/g, '') === 'superadmin'
      if (!isSuperAdmin || !superAdminOverride) {
        const set = await prisma.deviceSet.findUnique({ where: { id: existingDevice.setId }, select: { code: true } })
        const setLabel = set?.code ?? `Set #${existingDevice.setId}`
        return res.status(403).json({
          error: `Device ${existingDevice.code} is part of ${setLabel}. Lifecycle, location, and client changes must be made on the set, not individual components.`,
          setId: existingDevice.setId,
          setCode: set?.code ?? null,
          locked: true,
        })
      }
      console.warn(`[SET-LOCK OVERRIDE] SuperAdmin userId=${req.user.userId} force-editing device ${existingDevice.code} (setId=${existingDevice.setId})`)
    }

    if (code && code.toUpperCase() !== existingDevice.code) {
      const codeCheck = await validateCode(code, type || existingDevice.type, id)
      if (!codeCheck.valid) return res.status(400).json({ error: codeCheck.error })
    }
    if (barcode && barcode.toUpperCase() !== existingDevice.barcode) {
      const barcodeExists = await prisma.device.findUnique({ where: { barcode: barcode.toUpperCase() } })
      if (barcodeExists) return res.status(400).json({ error: "Barcode already exists" })
    }
    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } })
      if (!client) return res.status(400).json({ error: "Client not found" })
    }

    const prevStatus = existingDevice.lifecycleStatus
    const updatedDevice = await prisma.device.update({
      where: { id: parseInt(id) },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(barcode && { barcode: barcode.toUpperCase() }),
        ...(type && { type }),
        brand: brand !== undefined ? brand : existingDevice.brand,
        size: size !== undefined ? size : existingDevice.size,
        model: model !== undefined ? model : existingDevice.model,
        color: color !== undefined ? color : existingDevice.color,
        gpsId: gpsId !== undefined ? gpsId : existingDevice.gpsId,
        mfgDate: (inDate !== undefined || mfgDate !== undefined) ? ((inDate||mfgDate) ? new Date(inDate||mfgDate) : null) : existingDevice.mfgDate,
        healthStatus: healthStatus !== undefined ? healthStatus : existingDevice.healthStatus,
        lifecycleStatus: lifecycleStatus !== undefined ? lifecycleStatus : existingDevice.lifecycleStatus,
        location: location !== undefined ? location : existingDevice.location,
        state: state !== undefined ? state : existingDevice.state,
        district: district !== undefined ? district : existingDevice.district,
        pinpoint: pinpoint !== undefined ? pinpoint : existingDevice.pinpoint,
        clientId: clientId !== undefined ? (clientId ? parseInt(clientId) : null) : existingDevice.clientId,
        ...(subscriptionEndDate !== undefined && {
          subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : null
        }),
        // NEW: Warehouse location
        ...(warehouseId !== undefined && { warehouseId: warehouseId ? parseInt(warehouseId) : null }),
        ...(warehouseZone !== undefined && { warehouseZone }),
        ...(warehouseSpecificLocation !== undefined && { warehouseSpecificLocation }),
        // NEW: Deployment location
        ...(deploymentState !== undefined && { deploymentState }),
        ...(deploymentDistrict !== undefined && { deploymentDistrict }),
        ...(deploymentSite !== undefined && { deploymentSite }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(googleMapsLink !== undefined && { googleMapsLink }),
        // NEW: Assignment fields
        ...(returnDate !== undefined && { returnDate: returnDate ? new Date(returnDate) : null }),
        ...(assignmentHealth !== undefined && { assignmentHealth }),
        ...(assignmentHealthNote !== undefined && { assignmentHealthNote }),
      },
      include: DEVICE_INCLUDE,
    })

    if (lifecycleStatus && lifecycleStatus !== prevStatus) {
      const overrideNote = existingDevice.setId && superAdminOverride
        ? `⚠️ SuperAdmin set-lock override — manually moved from set member (setId=${existingDevice.setId})`
        : "Manual update via admin"
      await logHistory(parseInt(id), prevStatus, lifecycleStatus, req.user?.userId || null, overrideNote)
    }

    // NEW: Log location change if warehouse or deployment location changed
    const locationChanged = (
      warehouseId !== undefined || warehouseZone !== undefined || warehouseSpecificLocation !== undefined ||
      deploymentState !== undefined || deploymentDistrict !== undefined || deploymentSite !== undefined ||
      clientId !== undefined
    )
    
    if (locationChanged) {
      await logLocationHistory(
        parseInt(id),
        {
          warehouseId: updatedDevice.warehouseId,
          warehouseZone: updatedDevice.warehouseZone,
          warehouseSpecificLocation: updatedDevice.warehouseSpecificLocation,
          clientId: updatedDevice.clientId,
          deploymentState: updatedDevice.deploymentState,
          deploymentDistrict: updatedDevice.deploymentDistrict,
          deploymentSite: updatedDevice.deploymentSite,
          latitude: updatedDevice.latitude,
          longitude: updatedDevice.longitude,
          googleMapsLink: updatedDevice.googleMapsLink,
        },
        req.user?.userId || null,
        'updated',
        'Device location updated'
      )
    }

    if (healthStatus !== undefined && healthStatus !== existingDevice.healthStatus && existingDevice.setId) {
      await syncSetHealthForDevice(parseInt(id))
    }

    res.json(updatedDevice)
  } catch (error) {
    console.error("Error updating device:", error)
    res.status(500).json({ error: "Failed to update device" })
  }
})

// ─── PATCH /:id/location — ground team or any role can move a device ──────────
// Only touches warehouse fields. Blocked for deployed/in-transit statuses.
const MOVEABLE_STATUSES = new Set(['available', 'warehouse', 'assigning', 'assign_requested',
  'assigned', 'ready_to_deploy', 'deploy_requested', 'returned'])

router.patch("/:id/location", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { warehouseId, warehouseZone, warehouseSpecificLocation, notes } = req.body

    const device = await prisma.device.findUnique({
      where: { id: parseInt(id) },
      include: { warehouse: { select: { name: true } } },
    })
    if (!device) return res.status(404).json({ error: "Device not found" })

    if (!MOVEABLE_STATUSES.has(device.lifecycleStatus)) {
      return res.status(400).json({
        error: `Cannot update location while device is '${device.lifecycleStatus}'. Location can only be changed when device is in warehouse, assigning, ready to deploy, or returned.`,
      })
    }

    // Block individual move if device is part of a set — must move the whole set
    if (device.setId) {
      const parentSet = await prisma.deviceSet.findUnique({ where: { id: device.setId }, select: { code: true } })
      return res.status(400).json({
        error: `Device is part of set ${parentSet?.code || `#${device.setId}`}. Move the set instead — all components will move together.`,
        setId: device.setId,
        setCode: parentSet?.code || null,
      })
    }

    const updated = await prisma.device.update({
      where: { id: parseInt(id) },
      data: {
        ...(warehouseId !== undefined && { warehouseId: warehouseId ? parseInt(warehouseId) : null }),
        ...(warehouseZone !== undefined && { warehouseZone: warehouseZone || null }),
        ...(warehouseSpecificLocation !== undefined && { warehouseSpecificLocation: warehouseSpecificLocation || null }),
      },
      include: {
        client: true,
        warehouse: true,
        history: { orderBy: { changedAt: "desc" }, take: 20 },
        deviceSet: { select: { id: true, code: true, setType: true } },
      },
    })

    await logLocationHistory(
      parseInt(id),
      {
        warehouseId: updated.warehouseId,
        warehouseZone: updated.warehouseZone,
        warehouseSpecificLocation: updated.warehouseSpecificLocation,
        clientId: updated.clientId,
      },
      req.user?.userId || null,
      'location_move',
      notes || null
    )

    res.json(updated)
  } catch (error) {
    console.error("Error updating device location:", error)
    res.status(500).json({ error: "Failed to update device location" })
  }
})

// ─── GET /location-history/all — paginated movement log for all devices ───────
router.get("/location-history/all", authMiddleware, async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 30)
    const skip     = (page - 1) * pageSize

    // Filters
    const { warehouseId, zone, changedById, deviceCode, dateFrom, dateTo } = req.query
    const where = {}
    if (warehouseId)  where.warehouseId   = parseInt(warehouseId)
    if (zone)         where.warehouseZone = { contains: zone, mode: 'insensitive' }
    if (changedById)  where.changedById   = parseInt(changedById)
    if (deviceCode) {
      where.device = { code: { contains: deviceCode.toUpperCase(), mode: 'insensitive' } }
    }
    if (dateFrom || dateTo) {
      where.timestamp = {}
      if (dateFrom) where.timestamp.gte = new Date(dateFrom)
      if (dateTo)   where.timestamp.lte = new Date(dateTo)
    }

    const [total, records] = await Promise.all([
      prisma.deviceLocationHistory.count({ where }),
      prisma.deviceLocationHistory.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
        include: {
          device:    { select: { id: true, code: true, type: true } },
          warehouse: { select: { name: true } },
          client:    { select: { name: true } },
          changedBy: { select: { id: true, name: true, role: { select: { name: true } } } },
        },
      }),
    ])

    res.json({ total, page, pageSize, pages: Math.ceil(total / pageSize), records })
  } catch (error) {
    console.error("Error fetching movement log:", error)
    res.status(500).json({ error: "Failed to fetch movement log" })
  }
})


// ─── DELETE /:id ──────────────────────────────────────────────────────────────
// No longer deletes immediately — schedules a 24h deferred deletion.
// Body: { reason: string }  (required)
// ─── GET /:id (MUST be last) ──────────────────────────────────────────────────
router.get("/:id", authMiddleware, requirePermission("Devices", "read"), async (req, res) => {
  try {
    const { id } = req.params
    const device = await prisma.device.findUnique({ where: { id: parseInt(id) }, include: DEVICE_INCLUDE })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post("/", authMiddleware, requirePermission("Devices", "create"), async (req, res) => {
  try {
    const { 
      code, type, brand, size, model, color, gpsId, mfgDate, inDate,
      lifecycleStatus, location, state, district, pinpoint, clientId, barcode, healthStatus,
      // NEW: Warehouse location fields
      warehouseId, warehouseZone, warehouseSpecificLocation
    } = req.body

    if (!code || !type) return res.status(400).json({ error: "Code and type are required fields" })

    const codeCheck = await validateCode(code, type)
    if (!codeCheck.valid) return res.status(400).json({ error: codeCheck.error })

    let finalBarcode = barcode ? barcode.toUpperCase() : generateBarcode(type)
    const existingBarcode = await prisma.device.findUnique({ where: { barcode: finalBarcode } })
    if (existingBarcode) {
      if (!barcode) {
        finalBarcode = generateBarcode(type) + '-' + Math.random().toString(36).substring(2, 4).toUpperCase()
      } else {
        return res.status(400).json({ error: "Barcode already exists. Please use a unique barcode." })
      }
    }

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } })
      if (!client) return res.status(400).json({ error: "Client not found" })
    }

    const device = await prisma.device.create({
      data: {
        code: code.toUpperCase(), barcode: finalBarcode, type,
        brand: brand || null, size: size || null, model: model || null,
        color: color || null, gpsId: gpsId || null,
        mfgDate: (inDate || mfgDate) ? new Date(inDate || mfgDate) : null,
        healthStatus: healthStatus || 'ok',
        lifecycleStatus: lifecycleStatus || "warehouse",
        location: location || null, state: state || null,
        district: district || null, pinpoint: pinpoint || null,
        clientId: clientId ? parseInt(clientId) : null,
        // NEW: Warehouse location
        warehouseId: warehouseId ? parseInt(warehouseId) : null,
        warehouseZone: warehouseZone || null,
        warehouseSpecificLocation: warehouseSpecificLocation || null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(device.id, "created", device.lifecycleStatus, req.user?.userId || null, "Device added to inventory")
    
    // NEW: Log initial location if warehouse specified
    if (warehouseId) {
      await logLocationHistory(
        device.id,
        { warehouseId: parseInt(warehouseId), warehouseZone, warehouseSpecificLocation },
        req.user?.userId || null,
        'added',
        'Device added to inventory'
      )
    }
    
    res.status(201).json(device)
  } catch (error) {
    console.error("Error creating device:", error)
    res.status(500).json({ error: "Failed to create device" })
  }
})

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.delete("/:id", authMiddleware, requirePermission("Devices", "delete"), (req, res) => {
  return scheduleDeletion(req, res, 'device')
})

export default router;