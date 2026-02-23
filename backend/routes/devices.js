import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// LIFECYCLE STATUS CONSTANTS
// ==========================================
export const LIFECYCLE = {
  WAREHOUSE:        "warehouse",
  ASSIGN_REQUESTED: "assign_requested",
  ASSIGNED:         "assigned",
  DEPLOY_REQUESTED: "deploy_requested",
  DEPLOYED:         "deployed",
  RETURN_REQUESTED: "return_requested",
  RETURNED:         "returned",
}

// ==========================================
// UTILITY FUNCTIONS  (unchanged from original)
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

const CODE_PREFIX_MAP = {
  TV: 'TV', TAB: 'TAB', TTV: 'TTV', AST: 'ATV', IST: 'ITV',
  TST: 'TST', MB: 'MB', BAT: 'BAT', MSE: 'MSE', W: 'W',
  tv: 'TV', tablet: 'TAB', 'touch-tv': 'TTV',
  'a-stand': 'ATV', 'i-stand': 'ITV', 'tablet-stand': 'TST',
  stand: 'ATV', istand: 'ITV', mediaBox: 'MB', battery: 'BAT', fabrication: 'TST',
}

const getExpectedPrefix = (type) => {
  if (!type) return null
  if (CODE_PREFIX_MAP[type]) return CODE_PREFIX_MAP[type]
  if (type.startsWith('custom-')) return type.replace('custom-', '').toUpperCase()
  if (/^[A-Z0-9]+$/.test(type)) return type
  return null
}

const validateCode = async (code, type, excludeId = null) => {
  const upper = code.trim().toUpperCase()
  const expectedPrefix = getExpectedPrefix(type)
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

// Standard include for device queries — now also includes history
const DEVICE_INCLUDE = {
  client: true,
  history: {
    orderBy: { changedAt: "desc" },
    take: 20,
  },
}

// ==========================================
// ROUTE ORDER: specific named POSTs/GETs MUST come before /:id
// ==========================================

// ─── POST /bulk-add (unchanged) ───────────────────────────────────────────────
router.post("/bulk-add", authMiddleware, async (req, res) => {
  try {
    const { type, brand, size, model, color, mfgDate, inDate, healthStatus, lifecycleStatus, location, quantity } = req.body

    if (!type) return res.status(400).json({ error: "Device type is required" })
    const qty = parseInt(quantity)
    if (!qty || qty < 1 || qty > 500) return res.status(400).json({ error: "Quantity must be between 1 and 500" })
    const expectedPrefix = getExpectedPrefix(type)
    if (!expectedPrefix) return res.status(400).json({ error: `Unknown device type: ${type}` })

    const existingDevices = await prisma.device.findMany({ select: { code: true } })
    const occupiedForType = new Set()
    existingDevices.forEach((d) => {
      const code = (d.code || "").toUpperCase()
      if (code.startsWith(expectedPrefix + "-")) {
        const suffix = code.slice(expectedPrefix.length + 1)
        if (/^\d+$/.test(suffix)) occupiedForType.add(parseInt(suffix, 10))
      }
    })

    const existingBarcodes = new Set(
      (await prisma.device.findMany({ select: { barcode: true } })).map((d) => d.barcode)
    )

    let nextNum = 1
    while (occupiedForType.has(nextNum)) nextNum++
    const devicesToCreate = []

    for (let i = 0; i < qty; i++) {
      const code = `${expectedPrefix}-${String(nextNum).padStart(3, "0")}`
      occupiedForType.add(nextNum)
      nextNum++
      while (occupiedForType.has(nextNum)) nextNum++
      let barcode = generateBarcode(type)
      let attempts = 0
      while (existingBarcodes.has(barcode) && attempts < 10) {
        barcode = generateBarcode(type) + "-" + Math.random().toString(36).substring(2, 4).toUpperCase()
        attempts++
      }
      existingBarcodes.add(barcode)
      devicesToCreate.push({
        code, barcode, type,
        brand: brand || null, size: size || null, model: model || null, color: color || null,
        gpsId: null, mfgDate: (inDate || mfgDate) ? new Date(inDate || mfgDate) : null,
        healthStatus: healthStatus || 'ok',
        lifecycleStatus: lifecycleStatus || "warehouse",
        location: location || (lifecycleStatus === "warehouse" ? "Warehouse A" : null),
        state: null, district: null, pinpoint: null, clientId: null,
      })
    }

    await prisma.device.createMany({ data: devicesToCreate })
    const createdCodes = devicesToCreate.map((d) => d.code)
    const createdDevices = await prisma.device.findMany({
      where: { code: { in: createdCodes } },
      include: DEVICE_INCLUDE,
      orderBy: { code: "asc" },
    })

    res.status(201).json({ message: `${createdDevices.length} devices created successfully`, count: createdDevices.length, devices: createdDevices })
  } catch (error) {
    console.error("Error in bulk add:", error)
    res.status(500).json({ error: "Failed to bulk add devices" })
  }
})

// ─── POST /bulk/assign (unchanged) ───────────────────────────────────────────
router.post("/bulk/assign", authMiddleware, async (req, res) => {
  try {
    const { deviceIds, clientId } = req.body
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) return res.status(400).json({ error: "deviceIds must be a non-empty array" })
    if (!clientId) return res.status(400).json({ error: "clientId is required" })
    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } })
    if (!client) return res.status(400).json({ error: "Client not found" })
    const result = await prisma.device.updateMany({
      where: { id: { in: deviceIds.map(id => parseInt(id)) } },
      data: { clientId: parseInt(clientId), lifecycleStatus: "assign_requested" },
    })
    res.json({ message: `${result.count} devices assigned to client`, count: result.count })
  } catch (error) {
    console.error("Error in bulk assign:", error)
    res.status(500).json({ error: "Failed to assign devices" })
  }
})

// ─── POST /bulk/unassign (unchanged) ─────────────────────────────────────────
router.post("/bulk/unassign", authMiddleware, async (req, res) => {
  try {
    const { deviceIds } = req.body
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) return res.status(400).json({ error: "deviceIds must be a non-empty array" })
    const result = await prisma.device.updateMany({
      where: { id: { in: deviceIds.map(id => parseInt(id)) } },
      data: { clientId: null, lifecycleStatus: "warehouse", state: null, district: null, pinpoint: null },
    })
    res.json({ message: `${result.count} devices unassigned`, count: result.count })
  } catch (error) {
    console.error("Error in bulk unassign:", error)
    res.status(500).json({ error: "Failed to unassign devices" })
  }
})

// ─── POST /bulk/update-lifecycle (unchanged) ──────────────────────────────────
router.post("/bulk/update-lifecycle", authMiddleware, async (req, res) => {
  try {
    const { deviceIds, lifecycleStatus, location, state, district, pinpoint } = req.body
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) return res.status(400).json({ error: "deviceIds must be a non-empty array" })
    if (!lifecycleStatus) return res.status(400).json({ error: "lifecycleStatus is required" })
    const updateData = { lifecycleStatus }
    if (location !== undefined) updateData.location = location
    if (state !== undefined) updateData.state = state
    if (district !== undefined) updateData.district = district
    if (pinpoint !== undefined) updateData.pinpoint = pinpoint
    const result = await prisma.device.updateMany({
      where: { id: { in: deviceIds.map(id => parseInt(id)) } },
      data: updateData,
    })
    res.json({ message: `${result.count} devices updated`, count: result.count })
  } catch (error) {
    console.error("Error in bulk update lifecycle:", error)
    res.status(500).json({ error: "Failed to update devices" })
  }
})

// ─── POST /search (unchanged) ────────────────────────────────────────────────
router.post("/search", authMiddleware, async (req, res) => {
  try {
    const { type, lifecycleStatus, clientId, brand, size, state, district, searchCode } = req.body
    const where = {}
    if (type) where.type = type
    if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus
    if (clientId) where.clientId = parseInt(clientId)
    if (brand) where.brand = brand
    if (size) where.size = size
    if (state) where.state = state
    if (district) where.district = district
    if (searchCode) where.code = { contains: searchCode.toUpperCase(), mode: 'insensitive' }
    const devices = await prisma.device.findMany({ where, include: DEVICE_INCLUDE, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error searching devices:", error)
    res.status(500).json({ error: "Failed to search devices" })
  }
})

// ─── GET / (unchanged) ────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({ include: DEVICE_INCLUDE, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error fetching devices:", error)
    res.status(500).json({ error: "Failed to fetch devices" })
  }
})

// ─── NEW: GET /pending-approvals ──────────────────────────────────────────────
router.get("/pending-approvals", authMiddleware, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: {
        lifecycleStatus: {
          in: [LIFECYCLE.ASSIGN_REQUESTED, LIFECYCLE.DEPLOY_REQUESTED, LIFECYCLE.RETURN_REQUESTED],
        },
      },
      include: DEVICE_INCLUDE,
      orderBy: { requestedAt: "asc" },
    })
    res.json(devices)
  } catch (error) {
    console.error("Error fetching pending approvals:", error)
    res.status(500).json({ error: "Failed to fetch pending approvals" })
  }
})

// ─── GET /barcode/:barcode (unchanged) ───────────────────────────────────────
router.get("/barcode/:barcode", authMiddleware, async (req, res) => {
  try {
    const { barcode } = req.params
    const device = await prisma.device.findUnique({ where: { barcode: barcode.toUpperCase() }, include: DEVICE_INCLUDE })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device by barcode:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// ─── GET /next-code/:type (unchanged) ────────────────────────────────────────
router.get("/next-code/:type", authMiddleware, async (req, res) => {
  try {
    const { type } = req.params
    const prefix = getExpectedPrefix(type)
    if (!prefix) return res.status(400).json({ error: "Unknown device type" })
    const devices = await prisma.device.findMany({ select: { code: true }, where: { type } })
    const nums = []
    devices.forEach((d) => {
      const code = (d.code || '').toUpperCase()
      if (code.startsWith(prefix + '-')) {
        const suffix = code.slice(prefix.length + 1)
        if (/^\d+$/.test(suffix)) nums.push(parseInt(suffix, 10))
      }
    })
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    res.json({ type, prefix, nextCode: `${prefix}-${String(next).padStart(3, '0')}` })
  } catch (error) {
    console.error("Error computing next code:", error)
    res.status(500).json({ error: "Failed to compute next code" })
  }
})

// ─── GET /code/:code (unchanged) ─────────────────────────────────────────────
router.get("/code/:code", authMiddleware, async (req, res) => {
  try {
    const { code } = req.params
    const device = await prisma.device.findUnique({ where: { code: code.toUpperCase() }, include: DEVICE_INCLUDE })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device by code:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// ─── GET /filter/type/:type (unchanged) ──────────────────────────────────────
router.get("/filter/type/:type", authMiddleware, async (req, res) => {
  try {
    const { type } = req.params
    const devices = await prisma.device.findMany({ where: { type }, include: DEVICE_INCLUDE, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    res.status(500).json({ error: "Failed to filter devices" })
  }
})

// ─── GET /filter/lifecycle/:status (unchanged) ───────────────────────────────
router.get("/filter/lifecycle/:status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.params
    const devices = await prisma.device.findMany({ where: { lifecycleStatus: status }, include: DEVICE_INCLUDE, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    res.status(500).json({ error: "Failed to filter devices" })
  }
})

// ─── GET /filter/client/:clientId (unchanged) ────────────────────────────────
router.get("/filter/client/:clientId", authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params
    const devices = await prisma.device.findMany({ where: { clientId: parseInt(clientId) }, include: DEVICE_INCLUDE, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    res.status(500).json({ error: "Failed to filter devices" })
  }
})

// ─── GET /stats/summary (updated to count new statuses) ───────────────────────
router.get("/stats/summary", authMiddleware, async (req, res) => {
  try {
    const [total, warehouse, assignRequested, assigned, deployRequested, deployed, returnRequested, returned, byType] =
      await Promise.all([
        prisma.device.count(),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.WAREHOUSE } }),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.ASSIGN_REQUESTED } }),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.ASSIGNED } }),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.DEPLOY_REQUESTED } }),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.DEPLOYED } }),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.RETURN_REQUESTED } }),
        prisma.device.count({ where: { lifecycleStatus: LIFECYCLE.RETURNED } }),
        prisma.device.groupBy({ by: ["type"], _count: true }),
      ])
    res.json({
      total,
      warehouse,
      // keep "assigning" key for backward compat — means any in-flight status
      assigning: assignRequested + assigned + deployRequested + returnRequested,
      deployed,
      returned,
      // detailed breakdown for new UI
      breakdown: { assignRequested, assigned, deployRequested, deployed, returnRequested, returned },
      byType: byType.map(item => ({ type: item.type, count: item._count })),
    })
  } catch (error) {
    console.error("Error fetching device statistics:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

// ─── NEW: GET /:id/history ────────────────────────────────────────────────────
router.get("/:id/history", authMiddleware, async (req, res) => {
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

// ─── NEW: POST /:id/request-assign ───────────────────────────────────────────
// Field user submits a request to assign this device to a client
router.post("/:id/request-assign", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { clientId } = req.body
    if (!clientId) return res.status(400).json({ error: "clientId is required" })

    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.WAREHOUSE)
      return res.status(400).json({ error: `Device must be in 'warehouse' to request assignment. Current: ${device.lifecycleStatus}` })

    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } })
    if (!client) return res.status(400).json({ error: "Client not found" })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.ASSIGN_REQUESTED,
        clientId: parseInt(clientId),
        requestedById: userId,
        requestedAt: new Date(),
        rejectionNote: null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.ASSIGN_REQUESTED, userId, `Assignment requested for client: ${client.name}`)
    res.json({ message: "Assignment request submitted. Awaiting admin approval.", device: updated })
  } catch (error) {
    console.error("Error requesting assignment:", error)
    res.status(500).json({ error: "Failed to request assignment" })
  }
})

// ─── NEW: POST /:id/approve-assign ───────────────────────────────────────────
router.post("/:id/approve-assign", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.ASSIGN_REQUESTED)
      return res.status(400).json({ error: `Device is not awaiting assignment approval. Current: ${device.lifecycleStatus}` })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.ASSIGNED,
        approvedById: userId,
        approvedAt: new Date(),
        assignedAt: new Date(),
        rejectionNote: null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.ASSIGNED, userId, "Assignment approved")
    res.json({ message: "Assignment approved.", device: updated })
  } catch (error) {
    console.error("Error approving assignment:", error)
    res.status(500).json({ error: "Failed to approve assignment" })
  }
})

// ─── NEW: POST /:id/reject-assign ────────────────────────────────────────────
router.post("/:id/reject-assign", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { note } = req.body
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.ASSIGN_REQUESTED)
      return res.status(400).json({ error: "Device is not awaiting assignment approval" })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.WAREHOUSE,
        clientId: null,
        requestedById: null,
        requestedAt: null,
        rejectionNote: note || "Rejected by admin",
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.WAREHOUSE, userId, `Assignment rejected: ${note || "No reason given"}`)
    res.json({ message: "Assignment request rejected.", device: updated })
  } catch (error) {
    console.error("Error rejecting assignment:", error)
    res.status(500).json({ error: "Failed to reject assignment" })
  }
})

// ─── NEW: POST /:id/request-deploy ───────────────────────────────────────────
router.post("/:id/request-deploy", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { state, district, pinpoint, location } = req.body
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.ASSIGNED)
      return res.status(400).json({ error: `Device must be 'assigned' to request deployment. Current: ${device.lifecycleStatus}` })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.DEPLOY_REQUESTED,
        requestedById: userId,
        requestedAt: new Date(),
        state: state || device.state,
        district: district || device.district,
        pinpoint: pinpoint || device.pinpoint,
        location: location || device.location,
        rejectionNote: null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.DEPLOY_REQUESTED, userId, "Deployment requested")
    res.json({ message: "Deployment request submitted. Awaiting admin approval.", device: updated })
  } catch (error) {
    console.error("Error requesting deployment:", error)
    res.status(500).json({ error: "Failed to request deployment" })
  }
})

// ─── NEW: POST /:id/approve-deploy ───────────────────────────────────────────
router.post("/:id/approve-deploy", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.DEPLOY_REQUESTED)
      return res.status(400).json({ error: "Device is not awaiting deployment approval" })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.DEPLOYED,
        approvedById: userId,
        approvedAt: new Date(),
        deployedAt: new Date(),
        rejectionNote: null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.DEPLOYED, userId, "Deployment approved")
    res.json({ message: "Deployment approved.", device: updated })
  } catch (error) {
    console.error("Error approving deployment:", error)
    res.status(500).json({ error: "Failed to approve deployment" })
  }
})

// ─── NEW: POST /:id/reject-deploy ────────────────────────────────────────────
router.post("/:id/reject-deploy", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { note } = req.body
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.DEPLOY_REQUESTED)
      return res.status(400).json({ error: "Device is not awaiting deployment approval" })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.ASSIGNED,
        requestedById: null,
        requestedAt: null,
        rejectionNote: note || "Rejected by admin",
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.ASSIGNED, userId, `Deployment rejected: ${note || "No reason given"}`)
    res.json({ message: "Deployment request rejected.", device: updated })
  } catch (error) {
    console.error("Error rejecting deployment:", error)
    res.status(500).json({ error: "Failed to reject deployment" })
  }
})

// ─── NEW: POST /:id/request-return ───────────────────────────────────────────
router.post("/:id/request-return", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { note } = req.body
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.DEPLOYED)
      return res.status(400).json({ error: `Device must be 'deployed' to request return. Current: ${device.lifecycleStatus}` })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.RETURN_REQUESTED,
        requestedById: userId,
        requestedAt: new Date(),
        rejectionNote: null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.RETURN_REQUESTED, userId, note || "Return requested")
    res.json({ message: "Return request submitted. Awaiting admin approval.", device: updated })
  } catch (error) {
    console.error("Error requesting return:", error)
    res.status(500).json({ error: "Failed to request return" })
  }
})

// ─── NEW: POST /:id/approve-return ───────────────────────────────────────────
router.post("/:id/approve-return", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.RETURN_REQUESTED)
      return res.status(400).json({ error: "Device is not awaiting return approval" })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.WAREHOUSE,
        clientId: null,
        state: null, district: null, pinpoint: null,
        location: "Warehouse A",
        requestedById: null, requestedAt: null,
        approvedById: userId, approvedAt: new Date(),
        assignedAt: null, deployedAt: null,
        rejectionNote: null,
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.WAREHOUSE, userId, "Return approved — device back in warehouse")
    res.json({ message: "Return approved. Device is back in warehouse.", device: updated })
  } catch (error) {
    console.error("Error approving return:", error)
    res.status(500).json({ error: "Failed to approve return" })
  }
})

// ─── NEW: POST /:id/reject-return ────────────────────────────────────────────
router.post("/:id/reject-return", authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { note } = req.body
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    if (device.lifecycleStatus !== LIFECYCLE.RETURN_REQUESTED)
      return res.status(400).json({ error: "Device is not awaiting return approval" })

    const userId = req.user?.userId || null
    const updated = await prisma.device.update({
      where: { id },
      data: {
        lifecycleStatus: LIFECYCLE.DEPLOYED,
        requestedById: null, requestedAt: null,
        rejectionNote: note || "Rejected by admin",
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(id, device.lifecycleStatus, LIFECYCLE.DEPLOYED, userId, `Return rejected: ${note || "No reason given"}`)
    res.json({ message: "Return request rejected.", device: updated })
  } catch (error) {
    console.error("Error rejecting return:", error)
    res.status(500).json({ error: "Failed to reject return" })
  }
})

// ─── GET /:id (unchanged, MUST be last) ──────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res) => {
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

// ─── POST / (unchanged) ───────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { code, type, brand, size, model, color, gpsId, mfgDate, inDate,
            lifecycleStatus, location, state, district, pinpoint, clientId, barcode, healthStatus } = req.body

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
      },
      include: DEVICE_INCLUDE,
    })

    await logHistory(device.id, "created", device.lifecycleStatus, null, "Device added to inventory")
    res.status(201).json(device)
  } catch (error) {
    console.error("Error creating device:", error)
    res.status(500).json({ error: "Failed to create device" })
  }
})

// ─── PUT /:id (unchanged) ─────────────────────────────────────────────────────
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { code, barcode, type, brand, size, model, color, gpsId, mfgDate, inDate,
            lifecycleStatus, location, state, district, pinpoint, clientId, healthStatus } = req.body

    const existingDevice = await prisma.device.findUnique({ where: { id: parseInt(id) } })
    if (!existingDevice) return res.status(404).json({ error: "Device not found" })

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
      },
      include: DEVICE_INCLUDE,
    })

    // Log if lifecycle changed via PUT (manual admin override)
    if (lifecycleStatus && lifecycleStatus !== prevStatus) {
      await logHistory(parseInt(id), prevStatus, lifecycleStatus, req.user?.userId || null, "Manual update via admin")
    }

    res.json(updatedDevice)
  } catch (error) {
    console.error("Error updating device:", error)
    res.status(500).json({ error: "Failed to update device" })
  }
})

// ─── DELETE /:id (unchanged) ──────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const device = await prisma.device.findUnique({ where: { id: parseInt(id) } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    await prisma.device.delete({ where: { id: parseInt(id) } })
    res.json({ message: "Device deleted successfully", deletedDevice: device })
  } catch (error) {
    console.error("Error deleting device:", error)
    res.status(500).json({ error: "Failed to delete device" })
  }
})

export default router;