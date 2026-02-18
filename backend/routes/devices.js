import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
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
    // Canonical IDs (new system)
    TV: 'TV', TAB: 'TAB', TTV: 'TTV', AST: 'AST', IST: 'IST',
    TST: 'TST', MB: 'MB', BAT: 'BAT', MSE: 'MSE', W: 'W',
    // Legacy strings (backward compat)
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
  // Canonical IDs → code prefix
  TV: 'TV', TAB: 'TAB', TTV: 'TTV', AST: 'ATV', IST: 'ITV',
  TST: 'TST', MB: 'MB', BAT: 'BAT', MSE: 'MSE', W: 'W',
  // Legacy strings → code prefix (backward compat)
  tv: 'TV', tablet: 'TAB', 'touch-tv': 'TTV',
  'a-stand': 'ATV', 'i-stand': 'ITV', 'tablet-stand': 'TST',
  stand: 'ATV', istand: 'ITV', mediaBox: 'MB', battery: 'BAT', fabrication: 'TST',
}

const getExpectedPrefix = (type) => {
  if (!type) return null
  if (CODE_PREFIX_MAP[type]) return CODE_PREFIX_MAP[type]
  if (type.startsWith('custom-')) return type.replace('custom-', '').toUpperCase()
  // For any unknown canonical ID, use the type itself as prefix (e.g. "W" → "W")
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
// IMPORTANT: Route order matters in Express.
// Specific named paths MUST come before /:id
// otherwise Express matches /:id first and crashes.
// Order: named POSTs → named GETs → /* wildcards
// ==========================================

// POST /bulk-add
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

    // Find first available number from 1 upward (serial, fills gaps)
    let nextNum = 1
    while (occupiedForType.has(nextNum)) nextNum++
    const devicesToCreate = []

    for (let i = 0; i < qty; i++) {
      const code = `${expectedPrefix}-${String(nextNum).padStart(3, "0")}`
      occupiedForType.add(nextNum) // mark as used within this batch
      nextNum++
      while (occupiedForType.has(nextNum)) nextNum++ // skip any further gaps
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
      orderBy: { code: "asc" },
    })

    res.status(201).json({ message: `${createdDevices.length} devices created successfully`, count: createdDevices.length, devices: createdDevices })
  } catch (error) {
    console.error("Error in bulk add:", error)
    res.status(500).json({ error: "Failed to bulk add devices" })
  }
})

// POST /bulk/assign
router.post("/bulk/assign", authMiddleware, async (req, res) => {
  try {
    const { deviceIds, clientId } = req.body
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) return res.status(400).json({ error: "deviceIds must be a non-empty array" })
    if (!clientId) return res.status(400).json({ error: "clientId is required" })
    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } })
    if (!client) return res.status(400).json({ error: "Client not found" })
    const result = await prisma.device.updateMany({
      where: { id: { in: deviceIds.map(id => parseInt(id)) } },
      data: { clientId: parseInt(clientId), lifecycleStatus: "assigning" },
    })
    res.json({ message: `${result.count} devices assigned to client`, count: result.count })
  } catch (error) {
    console.error("Error in bulk assign:", error)
    res.status(500).json({ error: "Failed to assign devices" })
  }
})

// POST /bulk/unassign
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

// POST /bulk/update-lifecycle
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

// POST /search
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
    const devices = await prisma.device.findMany({ where, include: { client: true }, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error searching devices:", error)
    res.status(500).json({ error: "Failed to search devices" })
  }
})

// GET /
router.get("/", authMiddleware, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error fetching devices:", error)
    res.status(500).json({ error: "Failed to fetch devices" })
  }
})

// GET /barcode/:barcode  — must be before /:id
router.get("/barcode/:barcode", authMiddleware, async (req, res) => {
  try {
    const { barcode } = req.params
    const device = await prisma.device.findUnique({ where: { barcode: barcode.toUpperCase() }, include: { client: true } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device by barcode:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// GET /next-code/:type  — must be before /:id
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

// GET /code/:code  — must be before /:id
router.get("/code/:code", authMiddleware, async (req, res) => {
  try {
    const { code } = req.params
    const device = await prisma.device.findUnique({ where: { code: code.toUpperCase() }, include: { client: true } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device by code:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// GET /filter/type/:type  — must be before /:id
router.get("/filter/type/:type", authMiddleware, async (req, res) => {
  try {
    const { type } = req.params
    const devices = await prisma.device.findMany({ where: { type }, include: { client: true }, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error filtering devices by type:", error)
    res.status(500).json({ error: "Failed to filter devices" })
  }
})

// GET /filter/lifecycle/:status  — must be before /:id
router.get("/filter/lifecycle/:status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.params
    const devices = await prisma.device.findMany({ where: { lifecycleStatus: status }, include: { client: true }, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error filtering devices by lifecycle:", error)
    res.status(500).json({ error: "Failed to filter devices" })
  }
})

// GET /filter/client/:clientId  — must be before /:id
router.get("/filter/client/:clientId", authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params
    const devices = await prisma.device.findMany({ where: { clientId: parseInt(clientId) }, include: { client: true }, orderBy: { createdAt: "desc" } })
    res.json(devices)
  } catch (error) {
    console.error("Error filtering devices by client:", error)
    res.status(500).json({ error: "Failed to filter devices" })
  }
})

// GET /stats/summary  — must be before /:id
router.get("/stats/summary", authMiddleware, async (req, res) => {
  try {
    const [totalDevices, warehouseDevices, assigningDevices, deployedDevices, devicesByType] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { lifecycleStatus: "warehouse" } }),
      prisma.device.count({ where: { lifecycleStatus: "assigning" } }),
      prisma.device.count({ where: { lifecycleStatus: "deployed" } }),
      prisma.device.groupBy({ by: ["type"], _count: true }),
    ])
    res.json({
      total: totalDevices, warehouse: warehouseDevices, assigning: assigningDevices, deployed: deployedDevices,
      byType: devicesByType.map(item => ({ type: item.type, count: item._count })),
    })
  } catch (error) {
    console.error("Error fetching device statistics:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

// GET /:id  — wildcard, MUST be last among all GETs
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const device = await prisma.device.findUnique({ where: { id: parseInt(id) }, include: { client: true } })
    if (!device) return res.status(404).json({ error: "Device not found" })
    res.json(device)
  } catch (error) {
    console.error("Error fetching device:", error)
    res.status(500).json({ error: "Failed to fetch device" })
  }
})

// POST /  — create single device
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
      include: { client: true },
    })

    res.status(201).json(device)
  } catch (error) {
    console.error("Error creating device:", error)
    res.status(500).json({ error: "Failed to create device" })
  }
})

// PUT /:id
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
      include: { client: true },
    })

    res.json(updatedDevice)
  } catch (error) {
    console.error("Error updating device:", error)
    res.status(500).json({ error: "Failed to update device" })
  }
})

// DELETE /:id
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