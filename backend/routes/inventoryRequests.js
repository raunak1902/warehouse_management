/**
 * routes/inventoryRequests.js
 * ────────────────────────────
 * Ground team raises requests to add devices / bulk add / make set / break set.
 * Manager/SuperAdmin approves → actual creation happens here.
 *
 * Request types:
 *   "add_device"  — single device add
 *   "bulk_add"    — multiple devices of same type
 *   "make_set"    — create a device set from reserved components
 *   "break_set"   — disassemble an existing set
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'
import { isManagerOrAbove } from '../middleware/auth.js'
import { broadcastToManagers } from './notifications.js'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

const norm = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

// ─── resolveDeviceTypeId ───────────────────────────────────────────────────────
// Accepts any variant of a type string sent by the frontend ('tv', 'TV',
// 'touch-tv', 'mediaBox', …) and returns the canonical typeId stored in
// productTypeConfig ('TV', 'TTV', 'MB', …).
// Falls back to the uppercased input so callers still get a clear "Unknown
// device type" error for genuinely missing types.
const resolveDeviceTypeId = async (raw) => {
  if (!raw) return raw
  const upper = raw.trim().toUpperCase()
  // 1. Exact match – already canonical
  const exact = await prisma.productTypeConfig.findUnique({ where: { typeId: upper } })
  if (exact) return exact.typeId
  // 2. Case-insensitive / punctuation-stripped search across all active types
  const all = await prisma.productTypeConfig.findMany({ where: { isActive: true } })
  const clean = raw.trim().toLowerCase().replace(/[\s_-]+/g, '')
  const found = all.find(t => t.typeId.toLowerCase().replace(/[\s_-]+/g, '') === clean)
  if (found) return found.typeId
  // 3. No match – return upper so the caller's error message is readable
  return upper
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateBarcode = (typeCode) => {
  const prefix = 'EDSG'
  const ts = Date.now().toString().slice(-8)
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${typeCode}-${ts}-${rand}`
}

const getNextCodesForType = async (prefix, quantity) => {
  const existing = await prisma.device.findMany({ select: { code: true } })
  const occupied = new Set()
  existing.forEach(d => {
    const code = (d.code || '').toUpperCase()
    if (code.startsWith(prefix + '-')) {
      const suffix = code.slice(prefix.length + 1)
      if (/^\d+$/.test(suffix)) occupied.add(parseInt(suffix, 10))
    }
  })
  const codes = []
  let next = 1
  while (codes.length < quantity) {
    while (occupied.has(next)) next++
    codes.push(`${prefix}-${String(next).padStart(3, '0')}`)
    occupied.add(next)
    next++
  }
  return codes
}

const getNextSetCode = async (prefix) => {
  const sets = await prisma.deviceSet.findMany({ select: { code: true } })
  const occupied = new Set()
  sets.forEach(s => {
    const code = (s.code || '').toUpperCase()
    if (code.startsWith(prefix + '-')) {
      const suffix = code.slice(prefix.length + 1)
      if (/^\d+$/.test(suffix)) occupied.add(parseInt(suffix, 10))
    }
  })
  let next = 1
  while (occupied.has(next)) next++
  return `${prefix}-${String(next).padStart(3, '0')}`
}

const notifyAllGroundTeam = async (title, body, requestId = null) => {
  try {
    const groundTeam = await prisma.user.findMany({
      where: { role: { name: { in: ['Ground Team', 'GroundTeam'] } } },
      select: { id: true },
    })
    for (const u of groundTeam) {
      await prisma.notification.create({
        data: { userId: u.id, title, body, requestId },
      })
    }
  } catch (e) {
    console.error('Failed to notify ground team:', e)
  }
}

const notifyUser = async (userId, title, body, requestId = null) => {
  try {
    await prisma.notification.create({
      data: { userId, title, body, requestId },
    })
  } catch (e) {
    console.error('Failed to notify user:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory-requests — list requests
// Ground team sees own requests. Manager sees all.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const role = norm(req.user.role)
    const isManager = role === 'manager' || role === 'superadmin'

    const where = isManager ? {} : { requestedById: req.user.userId }
    const { status, requestType } = req.query
    if (status) where.status = status
    if (requestType) where.requestType = requestType

    const requests = await prisma.inventoryRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Enrich make_set requests with reserved device details (code, type, brand, model)
    // so the request card can show a full component breakdown instead of just a count.
    const makeSetRequests = requests.filter(
      r => r.requestType === 'make_set' && Array.isArray(r.reservedDeviceIds) && r.reservedDeviceIds.length > 0
    )
    let deviceDetailMap = {}
    if (makeSetRequests.length > 0) {
      const allIds = [...new Set(makeSetRequests.flatMap(r => r.reservedDeviceIds.map(id => parseInt(id))))]
      const devices = await prisma.device.findMany({
        where: { id: { in: allIds } },
        select: { id: true, code: true, type: true, brand: true, model: true },
      })
      devices.forEach(d => { deviceDetailMap[d.id] = d })
    }

    const enriched = requests.map(r => {
      if (r.requestType !== 'make_set' || !Array.isArray(r.reservedDeviceIds)) return r
      return {
        ...r,
        reservedDevices: r.reservedDeviceIds.map(id => deviceDetailMap[parseInt(id)] || { id, code: `#${id}` }),
      }
    })

    res.json(enriched)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory requests' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory-requests/pending-count — for manager badge
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-count', isManagerOrAbove, async (req, res) => {
  try {
    const count = await prisma.inventoryRequest.count({ where: { status: 'pending' } })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: 'Failed to count' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory-requests — ground team raises a request
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    let {
      requestType,
      // add_device / bulk_add
      deviceTypeId, deviceTypeName, quantity,
      brand, size, model, color, gpsId, inDate, healthStatus, note,
      expectedCodeRange,
      // make_set
      setTypeId, setTypeName, setName, reservedDeviceIds,
      // break_set
      targetSetId,
      // edit_device
      targetDeviceId, targetDeviceCode, proposedChanges,
      // warehouse location (for add_device / bulk_add)
      warehouseId, warehouseZone, warehouseSpecificLocation,
    } = req.body

    if (!requestType) return res.status(400).json({ error: 'requestType is required' })

    // Warehouse is mandatory for add_device and bulk_add
    if (['add_device', 'bulk_add'].includes(requestType) && !warehouseId) {
      return res.status(400).json({ error: 'warehouseId is required — please select a warehouse location' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { name: true },
    })

    // ── Validate by type ────────────────────────────────────────────────────
    if (requestType === 'add_device' || requestType === 'bulk_add') {
      if (!deviceTypeId) return res.status(400).json({ error: 'deviceTypeId is required' })
      const qty = parseInt(quantity) || 1
      if (qty < 1 || qty > 500) return res.status(400).json({ error: 'Quantity must be 1–500' })

      // Resolve any variant (e.g. 'tv', 'touch-tv', 'mediaBox') → canonical ID ('TV', 'TTV', 'MB')
      deviceTypeId = await resolveDeviceTypeId(deviceTypeId)

      // Verify type exists in catalogue
      const typeConfig = await prisma.productTypeConfig.findUnique({ where: { typeId: deviceTypeId } })
      if (!typeConfig) return res.status(400).json({ error: `Unknown device type: ${deviceTypeId}` })
    }

    if (requestType === 'make_set') {
      if (!setTypeId || !reservedDeviceIds || !Array.isArray(reservedDeviceIds) || reservedDeviceIds.length === 0) {
        return res.status(400).json({ error: 'setTypeId and reservedDeviceIds are required' })
      }

      // Check all devices are available and not already reserved
      const deviceIds = reservedDeviceIds.map(id => parseInt(id))
      const devices = await prisma.device.findMany({
        where: { id: { in: deviceIds } },
        select: { id: true, code: true, lifecycleStatus: true, setId: true },
      })

      if (devices.length !== deviceIds.length) {
        return res.status(400).json({ error: 'One or more devices not found' })
      }
      const unavailable = devices.filter(d =>
        d.lifecycleStatus !== 'available' && d.lifecycleStatus !== 'warehouse'
      )
      if (unavailable.length > 0) {
        return res.status(400).json({
          error: `Devices not available: ${unavailable.map(d => d.code).join(', ')}`,
        })
      }
      const inSet = devices.filter(d => d.setId)
      if (inSet.length > 0) {
        return res.status(400).json({
          error: `Devices already in a set: ${inSet.map(d => d.code).join(', ')}`,
        })
      }

      // Soft-lock: mark devices as pending_set_assignment
      await prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { lifecycleStatus: 'pending_set_assignment' },
      })
    }

    if (requestType === 'break_set') {
      if (!targetSetId) return res.status(400).json({ error: 'targetSetId is required' })
      const set = await prisma.deviceSet.findUnique({ where: { id: parseInt(targetSetId) } })
      if (!set) return res.status(404).json({ error: 'Set not found' })
    }

    if (requestType === 'edit_device') {
      if (!targetDeviceId) return res.status(400).json({ error: 'targetDeviceId is required' })
      if (!proposedChanges || typeof proposedChanges !== 'object') {
        return res.status(400).json({ error: 'proposedChanges is required' })
      }
      const device = await prisma.device.findUnique({ where: { id: parseInt(targetDeviceId) } })
      if (!device) return res.status(404).json({ error: 'Target device not found' })
    }

        // ── Create request ──────────────────────────────────────────────────────
    const newRequest = await prisma.inventoryRequest.create({
      data: {
        requestedById: req.user.userId,
        requestedByName: user?.name || 'Unknown',
        requestType,
        status: 'pending',
        deviceTypeId: deviceTypeId || null,
        deviceTypeName: deviceTypeName || null,
        quantity: quantity ? parseInt(quantity) : null,
        brand: brand || null,
        size: size || null,
        model: model || null,
        color: color || null,
        gpsId: gpsId || null,
        inDate: inDate ? new Date(inDate) : null,
        healthStatus: healthStatus || 'ok',
        note: note || null,
        setTypeId: setTypeId || null,
        setTypeName: setTypeName || null,
        setName: setName || null,
        reservedDeviceIds: reservedDeviceIds ? reservedDeviceIds.map(id => parseInt(id)) : null,
        targetSetId: targetSetId ? parseInt(targetSetId) : null,
        targetDeviceId: targetDeviceId ? parseInt(targetDeviceId) : null,
        targetDeviceCode: targetDeviceCode || null,
        proposedChanges: proposedChanges || null,
        expectedCodeRange: expectedCodeRange || null,
        warehouseId: warehouseId ? parseInt(warehouseId) : null,
        warehouseZone: warehouseZone || null,
        warehouseSpecificLocation: warehouseSpecificLocation || null,
      },
    })

    // ── Notify managers via SSE + DB notification ───────────────────────────
    const typeLabel = requestType === 'bulk_add'
      ? `Bulk Add: ${quantity}x ${deviceTypeName || deviceTypeId}`
      : requestType === 'add_device'
        ? `Add Device: ${deviceTypeName || deviceTypeId}`
        : requestType === 'make_set'
          ? `Make Set: ${setTypeName || setTypeId}`
          : `Break Set #${targetSetId}`

    await broadcastToManagers({
      type:            'inventory_request',
      requestId:        newRequest.id,
      requestType,
      label:            typeLabel,
      requestedByName:  user?.name ?? 'Unknown',
      note:             note ?? null,
      createdAt:        newRequest.createdAt,
    })

    // Persist manager DB notifications
    const managers = await prisma.user.findMany({
      where: { role: { name: { in: ['MANAGER', 'SUPER_ADMIN'] } } },
      select: { id: true },
    })
    for (const m of managers) {
      await prisma.notification.create({
        data: {
          userId: m.id,
          title: 'New Inventory Request',
          body: `${user?.name} requested: ${typeLabel}`,
          requestId: newRequest.id,
        },
      })
    }

    res.status(201).json(newRequest)
  } catch (err) {
    console.error('Error creating inventory request:', err)
    res.status(500).json({ error: 'Failed to create request' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory-requests/:id/approve — manager approves
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', isManagerOrAbove, async (req, res) => {
  try {
    const reqId = parseInt(req.params.id)
    const invReq = await prisma.inventoryRequest.findUnique({ where: { id: reqId } })
    if (!invReq) return res.status(404).json({ error: 'Request not found' })
    if (invReq.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' })

    let result = {}

    // ── APPROVE: add_device or bulk_add ────────────────────────────────────
    if (invReq.requestType === 'add_device' || invReq.requestType === 'bulk_add') {
      const typeConfig = await prisma.productTypeConfig.findUnique({
        where: { typeId: invReq.deviceTypeId },
      })
      if (!typeConfig) return res.status(400).json({ error: 'Product type config not found' })

      const prefix = typeConfig.prefix
      const qty = invReq.quantity || 1
      const codes = await getNextCodesForType(prefix, qty)

      const existingBarcodes = new Set(
        (await prisma.device.findMany({ select: { barcode: true } })).map(d => d.barcode)
      )

      const devicesToCreate = codes.map(code => {
        let barcode = generateBarcode(typeConfig.typeId)
        let attempts = 0
        while (existingBarcodes.has(barcode) && attempts < 10) {
          barcode = generateBarcode(typeConfig.typeId) + '-' + Math.random().toString(36).substring(2, 4).toUpperCase()
          attempts++
        }
        existingBarcodes.add(barcode)
        return {
          code,
          barcode,
          type: typeConfig.typeId,
          brand: invReq.brand || null,
          size: invReq.size || null,
          model: invReq.model || null,
          color: invReq.color || null,
          gpsId: invReq.gpsId || null,
          mfgDate: invReq.inDate || null,
          healthStatus: invReq.healthStatus || 'ok',
          lifecycleStatus: 'warehouse',
          location: 'Warehouse',
          warehouseId: invReq.warehouseId || null,
          warehouseZone: invReq.warehouseZone || null,
          warehouseSpecificLocation: invReq.warehouseSpecificLocation || null,
        }
      })

      await prisma.device.createMany({ data: devicesToCreate })
      const createdDevices = await prisma.device.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true },
        orderBy: { code: 'asc' },
      })

      const createdIds = createdDevices.map(d => d.id)
      const firstCode = createdDevices[0]?.code
      const lastCode = createdDevices[createdDevices.length - 1]?.code
      const codeRange = qty === 1 ? firstCode : `${firstCode} to ${lastCode}`

      await prisma.inventoryRequest.update({
        where: { id: reqId },
        data: {
          status: 'approved',
          reviewedById: req.user.userId,
          reviewedAt: new Date(),
          createdDeviceIds: createdIds,
          approvedCodeRange: codeRange,
        },
      })

      // Notify ground team
      const notifBody = `${typeConfig.label} ${codeRange} ${qty > 1 ? 'have' : 'has'} been approved and added to the database. You can download QR from the Devices section.`
      await notifyAllGroundTeam(
        `✅ ${qty} ${typeConfig.label}${qty > 1 ? 's' : ''} Added`,
        notifBody,
        reqId
      )

      result = { createdDevices, codeRange, count: qty }
    }

    // ── APPROVE: make_set ──────────────────────────────────────────────────
    else if (invReq.requestType === 'make_set') {
      const setTypeConfig = await prisma.setTypeConfig.findUnique({
        where: { setTypeId: invReq.setTypeId },
      })
      if (!setTypeConfig) return res.status(400).json({ error: 'Set type config not found' })

      const prefix = setTypeConfig.prefix
      const setCode = await getNextSetCode(prefix)
      let barcode = generateBarcode(setTypeConfig.setTypeId)
      let attempts = 0
      while (await prisma.deviceSet.findUnique({ where: { barcode } }) && attempts < 10) {
        barcode = generateBarcode(setTypeConfig.setTypeId) + '-' + Math.random().toString(36).substring(2, 4).toUpperCase()
        attempts++
      }

      const deviceIds = (invReq.reservedDeviceIds || []).map(id => parseInt(id))

      const newSet = await prisma.$transaction(async (tx) => {
        const set = await tx.deviceSet.create({
          data: {
            code: setCode,
            barcode,
            setType: invReq.setTypeId,
            setTypeName: invReq.setTypeName || setTypeConfig.label,
            name: invReq.setName || null,
            lifecycleStatus: 'available',
            healthStatus: 'ok',
            location: 'Warehouse',
            warehouseId: invReq.warehouseId ? parseInt(invReq.warehouseId) : null,
            warehouseZone: invReq.warehouseZone || null,
            warehouseSpecificLocation: invReq.warehouseSpecificLocation || null,
          },
        })

        // Fetch each device individually so we can snapshot their current location
        const devices = await tx.device.findMany({ where: { id: { in: deviceIds } } })

        // Assign to set, snapshot pre-set location, cascade set's warehouse location
        await Promise.all(devices.map(d =>
          tx.device.update({
            where: { id: d.id },
            data: {
              setId: set.id,
              lifecycleStatus: 'available',
              // Snapshot device's own location before it joins the set
              preSetWarehouseId:               d.warehouseId               || null,
              preSetWarehouseZone:             d.warehouseZone             || null,
              preSetWarehouseSpecificLocation: d.warehouseSpecificLocation || null,
              // Cascade set location onto the component
              warehouseId:               invReq.warehouseId ? parseInt(invReq.warehouseId) : null,
              warehouseZone:             invReq.warehouseZone             || null,
              warehouseSpecificLocation: invReq.warehouseSpecificLocation || null,
            },
          })
        ))

        return set
      })

      // Log initial warehouse location for the new set
      if (invReq.warehouseId) {
        const whName = (await prisma.warehouse.findUnique({ where: { id: parseInt(invReq.warehouseId) }, select: { name: true } }))?.name || null
        await prisma.setLocationHistory.create({
          data: {
            setId:                    newSet.id,
            setCode:                  setCode,
            warehouseId:              parseInt(invReq.warehouseId),
            warehouseZone:            invReq.warehouseZone             || null,
            warehouseSpecificLocation:invReq.warehouseSpecificLocation || null,
            warehouseName:            whName,
            changedByName:            'System',
            changeReason:             'created',
            notes:                    `Set created via request approval`,
          },
        })
      }

      await prisma.inventoryRequest.update({
        where: { id: reqId },
        data: {
          status: 'approved',
          reviewedById: req.user.userId,
          reviewedAt: new Date(),
          createdSetId: newSet.id,
          approvedCodeRange: setCode,
        },
      })

      await notifyAllGroundTeam(
        `✅ Set ${setCode} Created`,
        `Set "${invReq.setTypeName || setTypeConfig.label}" (${setCode}) has been approved. You can download QR from the Devices section.`,
        reqId
      )

      result = { set: newSet, setCode }
    }

    // ── APPROVE: break_set ─────────────────────────────────────────────────
    else if (invReq.requestType === 'break_set') {
      const set = await prisma.deviceSet.findUnique({
        where: { id: invReq.targetSetId },
        include: { components: true, warehouse: { select: { name: true } } },
      })
      if (!set) return res.status(404).json({ error: 'Set not found' })

      // componentLocations may be stored on the request (submitted by ground team)
      const componentLocations = invReq.proposedChanges?.componentLocations || []

      // Bulk-fetch warehouse names for component snapshot
      const allRestoreIds = [...new Set(set.components.map(device => {
        const locOverride = componentLocations.find(l => parseInt(l.deviceId) === device.id)
        return locOverride?.warehouseId != null
          ? parseInt(locOverride.warehouseId)
          : (device.preSetWarehouseId || set.warehouseId || null)
      }).filter(Boolean))]

      const whNameMap = {}
      if (allRestoreIds.length > 0) {
        const whs = await prisma.warehouse.findMany({
          where: { id: { in: allRestoreIds } },
          select: { id: true, name: true },
        })
        whs.forEach(w => { whNameMap[w.id] = w.name })
      }

      // Build component snapshot BEFORE modifying devices
      const componentSnapshot = set.components.map(device => {
        const locOverride = componentLocations.find(l => parseInt(l.deviceId) === device.id)
        const restoreWarehouseId = locOverride?.warehouseId != null
          ? parseInt(locOverride.warehouseId)
          : (device.preSetWarehouseId || set.warehouseId || null)
        const restoreZone = locOverride?.warehouseZone != null
          ? locOverride.warehouseZone
          : (device.preSetWarehouseZone || set.warehouseZone || null)
        const restoreSpecific = locOverride?.warehouseSpecificLocation != null
          ? locOverride.warehouseSpecificLocation
          : (device.preSetWarehouseSpecificLocation || set.warehouseSpecificLocation || null)
        return {
          id: device.id, code: device.code, type: device.type,
          brand: device.brand, model: device.model, size: device.size,
          healthStatus: device.healthStatus,
          restoredWarehouseId:   restoreWarehouseId,
          restoredWarehouseName: restoreWarehouseId ? (whNameMap[restoreWarehouseId] || null) : null,
          restoredZone:          restoreZone,
          restoredSpecific:      restoreSpecific,
        }
      })

      // Derive set-level warehouse name from the map (already fetched above)
      const whName = set.warehouseId ? (whNameMap[set.warehouseId] || set.warehouse?.name || null) : null

      await prisma.$transaction(async (tx) => {
        for (const device of set.components) {
          // Determine restore location: explicit override → preSet snapshot → set location
          const locOverride = componentLocations.find(l => parseInt(l.deviceId) === device.id)
          const restoreWarehouseId   = locOverride?.warehouseId != null
            ? parseInt(locOverride.warehouseId)
            : (device.preSetWarehouseId || set.warehouseId || null)
          const restoreZone          = locOverride?.warehouseZone != null
            ? locOverride.warehouseZone
            : (device.preSetWarehouseZone || set.warehouseZone || null)
          const restoreSpecific      = locOverride?.warehouseSpecificLocation != null
            ? locOverride.warehouseSpecificLocation
            : (device.preSetWarehouseSpecificLocation || set.warehouseSpecificLocation || null)

          await tx.device.update({
            where: { id: device.id },
            data: {
              setId: null,
              lifecycleStatus: 'available',
              location: 'Warehouse',
              warehouseId:               restoreWarehouseId,
              warehouseZone:             restoreZone,
              warehouseSpecificLocation: restoreSpecific,
              preSetWarehouseId:               null,
              preSetWarehouseZone:             null,
              preSetWarehouseSpecificLocation: null,
            },
          })

          // Log DeviceHistory entry for each component
          await tx.deviceHistory.create({
            data: {
              deviceId:    device.id,
              fromStatus:  device.lifecycleStatus,
              toStatus:    'available',
              changedById: req.user.userId,
              note: `[SET_LEAVE] Removed from set ${set.code} (${set.setTypeName}) — returned to warehouse via approved break-set request #${reqId} | Reason: ${invReq.note || '—'}`,
            },
          })

          // Log DeviceLocationHistory entry for each component
          if (restoreWarehouseId) {
            try {
              await tx.deviceLocationHistory.create({
                data: {
                  deviceId:                  device.id,
                  warehouseId:               restoreWarehouseId,
                  warehouseZone:             restoreZone             || null,
                  warehouseSpecificLocation: restoreSpecific         || null,
                  changedById:               req.user.userId,
                  changeReason:              'disassembled',
                  notes:                     `Set ${set.code} disassembled — device returned to warehouse`,
                },
              })
            } catch (_) { /* non-fatal */ }
          }
        }

        // Write permanent DisassembledSetLog with requestedBy (ground team) and disassembledBy (manager)
        try {
          await tx.disassembledSetLog.create({
            data: {
              setCode:                  set.code,
              setTypeName:              set.setTypeName,
              setName:                  set.name || null,
              // Manager who approved = executor
              disassembledById:         req.user.userId,
              disassembledByName:       req.user.name || 'Manager',
              // Ground team member who originally submitted the request
              requestedById:            invReq.requestedById,
              requestedByName:          invReq.requestedByName || 'Ground Team',
              reason:                   invReq.note || '—',
              componentSnapshot:        componentSnapshot,
              lifecycleSnapshot:        set.lifecycleStatus || 'available',
              warehouseId:              set.warehouseId     || null,
              warehouseZone:            set.warehouseZone   || null,
              warehouseSpecificLocation:set.warehouseSpecificLocation || null,
              warehouseName:            whName,
            },
          })
        } catch (logErr) {
          console.warn('[BREAK_SET APPROVE] DisassembledSetLog write failed:', logErr.message)
        }

        // Log SetLocationHistory entry with 'disassembled' reason
        try {
          await tx.setLocationHistory.create({
            data: {
              setId:                    null, // set is being deleted
              setCode:                  set.code,
              warehouseId:              set.warehouseId               || null,
              warehouseZone:            set.warehouseZone             || null,
              warehouseSpecificLocation:set.warehouseSpecificLocation || null,
              warehouseName:            whName,
              changedById:              req.user.userId,
              changedByName:            req.user.name || 'Manager',
              changeReason:             'disassembled',
              notes:                    `Approved break-set request #${reqId} — ${invReq.note || '—'}`,
            },
          })
        } catch (logErr) {
          console.warn('[BREAK_SET APPROVE] SetLocationHistory write failed:', logErr.message)
        }

        await tx.deviceSet.delete({ where: { id: invReq.targetSetId } })
      })

      await prisma.inventoryRequest.update({
        where: { id: reqId },
        data: {
          status: 'approved',
          reviewedById: req.user.userId,
          reviewedAt: new Date(),
        },
      })

      await notifyAllGroundTeam(
        `✅ Set ${set.code} Broken`,
        `Set "${set.setTypeName}" (${set.code}) has been disassembled. All components are back in warehouse.`,
        reqId
      )

      result = { brokenSet: set.code, componentsReleased: set.components.length }
    }


    // ── APPROVE: edit_device ────────────────────────────────────────────────
    else if (invReq.requestType === 'edit_device') {
      if (!invReq.targetDeviceId) throw new Error('No targetDeviceId on edit_device request')
      const changes = invReq.proposedChanges || {}
      // Only allow safe hardware fields — no code/type changes
      const safeFields = {}
      if (changes.brand !== undefined) safeFields.brand = changes.brand
      if (changes.size  !== undefined) safeFields.size  = changes.size
      if (changes.model !== undefined) safeFields.model = changes.model
      if (changes.color !== undefined) safeFields.color = changes.color
      if (changes.gpsId !== undefined) safeFields.gpsId = changes.gpsId

      const updatedDevice = await prisma.device.update({
        where: { id: invReq.targetDeviceId },
        data: safeFields,
      })

      // Log to device history
      await prisma.deviceHistory.create({
        data: {
          deviceId:    invReq.targetDeviceId,
          fromStatus:  updatedDevice.lifecycleStatus,
          toStatus:    updatedDevice.lifecycleStatus,
          changedById: req.user.userId,
          note: JSON.stringify({ type: 'edit_approved', changes: safeFields, requestId: reqId }),
        },
      }).catch(() => {}) // non-fatal

      await prisma.inventoryRequest.update({
        where: { id: reqId },
        data: { status: 'approved', reviewedById: req.user.userId, reviewedAt: new Date() },
      })

      // Notify requester
      await notifyUser(
        invReq.requestedById,
        `✅ Device Edit Approved`,
        `Your request to edit ${invReq.targetDeviceCode || 'device'} has been approved and applied.`,
        reqId
      )

      result = { edited: invReq.targetDeviceCode, changes: safeFields }
    }

    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Error approving inventory request:', err)
    res.status(500).json({ error: 'Failed to approve request' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory-requests/:id/reject — manager rejects with reason
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/reject', isManagerOrAbove, async (req, res) => {
  try {
    const reqId = parseInt(req.params.id)
    const { rejectionNote } = req.body
    if (!rejectionNote?.trim()) return res.status(400).json({ error: 'Rejection reason is required' })

    const invReq = await prisma.inventoryRequest.findUnique({ where: { id: reqId } })
    if (!invReq) return res.status(404).json({ error: 'Request not found' })
    if (invReq.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' })

    // Release soft-locked devices if this was a make_set request
    if (invReq.requestType === 'make_set' && invReq.reservedDeviceIds) {
      const deviceIds = invReq.reservedDeviceIds.map(id => parseInt(id))
      await prisma.device.updateMany({
        where: { id: { in: deviceIds }, lifecycleStatus: 'pending_set_assignment' },
        data: { lifecycleStatus: 'available' },
      })
    }

    await prisma.inventoryRequest.update({
      where: { id: reqId },
      data: {
        status: 'rejected',
        reviewedById: req.user.userId,
        reviewedAt: new Date(),
        rejectionNote: rejectionNote.trim(),
      },
    })

    // Notify the requester
    const typeLabels = {
      add_device: `Add ${invReq.deviceTypeName || invReq.deviceTypeId}`,
      bulk_add: `Bulk Add ${invReq.quantity}x ${invReq.deviceTypeName || invReq.deviceTypeId}`,
      make_set: `Make Set (${invReq.setTypeName || invReq.setTypeId})`,
      break_set: `Break Set #${invReq.targetSetId}`,
    }
    await notifyUser(
      invReq.requestedById,
      `❌ Request Rejected`,
      `Your request to "${typeLabels[invReq.requestType]}" was rejected. Reason: ${rejectionNote.trim()}`,
      reqId
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Error rejecting inventory request:', err)
    res.status(500).json({ error: 'Failed to reject request' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory-requests/:id — single request detail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const invReq = await prisma.inventoryRequest.findUnique({
      where: { id: parseInt(req.params.id) },
    })
    if (!invReq) return res.status(404).json({ error: 'Request not found' })
    res.json(invReq)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch request' })
  }
})

export default router