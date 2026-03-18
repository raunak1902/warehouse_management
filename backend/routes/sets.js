import express from "express"
import { PrismaClient } from "@prisma/client"
import authMiddleware from "../middleware/auth.js"
import { requirePermission } from "../middleware/Permissions.js"
import { scheduleDeletion } from "./deletionRequests.js"

const router = express.Router()
const prisma = new PrismaClient()

// ── Sync set health to worst component ────────────────────────────────────────
const HEALTH_RANK = { ok: 1, repair: 2, damage: 3, lost: 4 }

async function syncSetHealth(tx, setId) {
  const members = await tx.device.findMany({
    where: { setId },
    select: { healthStatus: true },
  })
  
  if (!members.length) {
    await tx.deviceSet.update({
      where: { id: setId },
      data: { healthStatus: 'lost', updatedAt: new Date() },
    })
    return
  }
  
  let worstHealth = 'ok'
  let maxRank = HEALTH_RANK.ok
  
  for (const member of members) {
    const health = member.healthStatus || 'ok'
    const rank = HEALTH_RANK[health] ?? HEALTH_RANK.ok
    if (rank > maxRank) {
      maxRank = rank
      worstHealth = health
    }
  }
  
  const hasLostComponent = members.some(m => m.healthStatus === 'lost')
  if (hasLostComponent) {
    worstHealth = 'lost'
  }
  
  await tx.deviceSet.update({
    where: { id: setId },
    data: { healthStatus: worstHealth, updatedAt: new Date() },
  })
}

const generateSetBarcode = (setType) => {
  const prefix = 'EDSG'
  const typeCode = (setType || 'SET').toUpperCase().slice(0, 4)
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${typeCode}-${timestamp}-${random}`
}

const getNextSetCode = async (prefix) => {
  const sets = await prisma.deviceSet.findMany({ select: { code: true } })
  const occupied = new Set()
  sets.forEach((s) => {
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

// Hardcoded fallback for set code prefixes
const SET_CODE_PREFIX_FALLBACK = { aStand: 'ASET', iStand: 'ISET', tabletCombo: 'TSET' }

// DB-backed async set prefix lookup with hardcoded fallback
const getSetCodePrefix = async (setType) => {
  if (!setType) return 'SETS'
  try {
    const dbType = await prisma.setTypeConfig.findFirst({
      where: { setTypeId: setType, isActive: true },
    })
    if (dbType?.prefix) return dbType.prefix
  } catch (e) {
    // DB not ready yet — fall through to hardcoded map
  }
  if (SET_CODE_PREFIX_FALLBACK[setType]) return SET_CODE_PREFIX_FALLBACK[setType]
  return (setType || 'SET').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) + 'S'
}

const INCLUDE_SET = {
  components: {
    include: { client: true },
  },
  client: true,
  warehouse: { select: { id: true, name: true, city: true } },
}

// ── Log a SetLocationHistory entry ───────────────────────────────────────────
async function logSetLocation(tx, { setId, setCode, warehouseId, warehouseZone, warehouseSpecificLocation, warehouseName, changedById, changedByName, changeReason, notes }) {
  await tx.setLocationHistory.create({
    data: {
      setId:                    setId     || null,
      setCode:                  setCode,
      warehouseId:              warehouseId               ? parseInt(warehouseId)  : null,
      warehouseZone:            warehouseZone             || null,
      warehouseSpecificLocation:warehouseSpecificLocation || null,
      warehouseName:            warehouseName             || null,
      changedById:              changedById               || null,
      changedByName:            changedByName             || null,
      changeReason:             changeReason              || 'location_move',
      notes:                    notes                     || null,
    },
  })
}

router.get('/', authMiddleware, requirePermission('Sets', 'read'), async (req, res) => {
  try {
    const sets = await prisma.deviceSet.findMany({ include: INCLUDE_SET, orderBy: { createdAt: 'desc' } })
    res.json(sets)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sets' })
  }
})

router.get('/barcode/:barcode', authMiddleware, requirePermission('Sets', 'read'), async (req, res) => {
  try {
    const set = await prisma.deviceSet.findUnique({ where: { barcode: req.params.barcode.toUpperCase() }, include: INCLUDE_SET })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    res.json(set)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch set' })
  }
})

router.post('/', authMiddleware, requirePermission('Sets', 'create'), async (req, res) => {
  try {
    const { setType, setTypeName, name, componentDeviceIds, location, clientId,
            warehouseId, warehouseZone, warehouseSpecificLocation } = req.body
    if (!setType || !setTypeName) return res.status(400).json({ error: 'setType and setTypeName are required' })
    if (!componentDeviceIds || !Array.isArray(componentDeviceIds) || componentDeviceIds.length === 0)
      return res.status(400).json({ error: 'componentDeviceIds must be a non-empty array' })
    if (!warehouseId) return res.status(400).json({ error: 'warehouseId is required — please select a warehouse location for this set' })

    const deviceIds = componentDeviceIds.map(id => parseInt(id))
    const devices = await prisma.device.findMany({ where: { id: { in: deviceIds } } })
    if (devices.length !== deviceIds.length) return res.status(400).json({ error: 'One or more devices not found' })
    const notInWarehouse = devices.filter(d => d.lifecycleStatus !== 'warehouse' && d.lifecycleStatus !== 'available')
    if (notInWarehouse.length > 0) return res.status(400).json({ error: `Devices not in warehouse: ${notInWarehouse.map(d => d.code).join(', ')}` })
    const alreadyInSet = devices.filter(d => d.setId)
    if (alreadyInSet.length > 0) return res.status(400).json({ error: `Devices already in a set: ${alreadyInSet.map(d => d.code).join(', ')}` })

    const prefix = await getSetCodePrefix(setType)
    const code = await getNextSetCode(prefix)
    let barcode = generateSetBarcode(setType)
    let attempts = 0
    while (await prisma.deviceSet.findUnique({ where: { barcode } }) && attempts < 10) {
      barcode = generateSetBarcode(setType) + '-' + Math.random().toString(36).substring(2, 4).toUpperCase()
      attempts++
    }

    const parsedWarehouseId = parseInt(warehouseId)

    const newSet = await prisma.$transaction(async (tx) => {
      const set = await tx.deviceSet.create({
        data: {
          code, barcode, setType, setTypeName, name: name || null,
          lifecycleStatus: 'available', healthStatus: 'ok',
          location: location || 'Warehouse',
          clientId: clientId ? parseInt(clientId) : null,
          warehouseId: parsedWarehouseId,
          warehouseZone: warehouseZone || null,
          warehouseSpecificLocation: warehouseSpecificLocation || null,
        },
      })

      // Update each component device:
      // - Assign to set
      // - Snapshot pre-set warehouse location (for restoration on disassembly)
      // - Sync warehouse location to match set
      await Promise.all(devices.map(d =>
        tx.device.update({
          where: { id: d.id },
          data: {
            setId: set.id,
            // Snapshot the device's own location before it was absorbed into the set
            preSetWarehouseId:               d.warehouseId               || null,
            preSetWarehouseZone:             d.warehouseZone             || null,
            preSetWarehouseSpecificLocation: d.warehouseSpecificLocation || null,
            // Cascade set location onto all components
            warehouseId:               parsedWarehouseId,
            warehouseZone:             warehouseZone || null,
            warehouseSpecificLocation: warehouseSpecificLocation || null,
          },
        })
      ))

      return tx.deviceSet.findUnique({ where: { id: set.id }, include: INCLUDE_SET })
    })

    res.status(201).json(newSet)
  } catch (err) {
    console.error('Error creating set:', err)
    res.status(500).json({ error: 'Failed to create set' })
  }
})

router.patch('/:id', authMiddleware, requirePermission('Sets', 'update'), async (req, res) => {
  try {
    const { name, lifecycleStatus, healthStatus, notes } = req.body
    const updated = await prisma.deviceSet.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(lifecycleStatus && { lifecycleStatus }),
        ...(healthStatus && { healthStatus }),
      },
      include: INCLUDE_SET,
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update set' })
  }
})

router.delete('/:id', authMiddleware, requirePermission('Sets', 'delete'), async (req, res) => {
  try {
    const { id } = req.params
    const set = await prisma.deviceSet.findUnique({ where: { id: parseInt(id) }, include: { components: true } })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    if (set.components.length > 0) {
      const scheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await scheduleDeletion('set', parseInt(id), req.user.userId, scheduledDate)
      return res.json({ message: 'Set scheduled for deletion in 7 days (contains components)' })
    }
    await prisma.deviceSet.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Set deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete set' })
  }
})

// ✨ FIXED: Bug #2 - Disassemble validation
router.post('/:id/disassemble', authMiddleware, requirePermission('Sets', 'disassemble'), async (req, res) => {
  try {
    const { id } = req.params
    const { componentUpdates, reason, componentLocations } = req.body
    // componentLocations: [{ deviceId, warehouseId, warehouseZone, warehouseSpecificLocation }]
    // If omitted, each device is restored to its preSetWarehouse* snapshot.

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to disassemble a set.' })
    }

    const set = await prisma.deviceSet.findUnique({ 
      where: { id: parseInt(id) }, 
      include: { components: true, warehouse: { select: { name: true } } } 
    })
    if (!set) return res.status(404).json({ error: 'Set not found' })

    // ✨ NEW VALIDATION: Ensure all components have a valid return location
    const locationOverrides = componentLocations || []
    for (const comp of set.components) {
      const locOverride = locationOverrides.find(l => parseInt(l.deviceId) === comp.id)
      const finalWarehouseId = locOverride?.warehouseId != null 
        ? parseInt(locOverride.warehouseId)
        : (comp.preSetWarehouseId || set.warehouseId)  // Fall back to set's location
      
      if (!finalWarehouseId) {
        return res.status(400).json({ 
          error: `Component ${comp.code} has no return location. Please specify a warehouse location for all components.`,
          missingLocationForDevice: comp.code
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      const updates = componentUpdates || []

      // Build component snapshot for history BEFORE updating/deleting devices
      // Bulk-fetch all unique warehouse IDs so we can include names in the snapshot
      const allRestoreWarehouseIds = [...new Set(set.components.map(device => {
        const locOverride = locationOverrides.find(l => parseInt(l.deviceId) === device.id)
        return locOverride?.warehouseId != null
          ? parseInt(locOverride.warehouseId)
          : (device.preSetWarehouseId || set.warehouseId || null)
      }).filter(Boolean))]

      const warehouseNameMap = {}
      if (allRestoreWarehouseIds.length > 0) {
        const whs = await tx.warehouse.findMany({
          where: { id: { in: allRestoreWarehouseIds } },
          select: { id: true, name: true },
        })
        whs.forEach(w => { warehouseNameMap[w.id] = w.name })
      }

      const componentSnapshot = set.components.map(device => {
        const locOverride = locationOverrides.find(l => parseInt(l.deviceId) === device.id)
        const restoreWarehouseId   = locOverride?.warehouseId != null ? parseInt(locOverride.warehouseId) : (device.preSetWarehouseId || set.warehouseId || null)
        const restoreZone          = locOverride?.warehouseZone != null ? locOverride.warehouseZone : (device.preSetWarehouseZone || set.warehouseZone || null)
        const restoreSpecific      = locOverride?.warehouseSpecificLocation != null ? locOverride.warehouseSpecificLocation : (device.preSetWarehouseSpecificLocation || set.warehouseSpecificLocation || null)
        return {
          id: device.id, code: device.code, type: device.type,
          brand: device.brand, model: device.model, size: device.size,
          healthStatus: device.healthStatus,
          restoredWarehouseId:   restoreWarehouseId,
          restoredWarehouseName: restoreWarehouseId ? (warehouseNameMap[restoreWarehouseId] || null) : null,
          restoredZone:          restoreZone,
          restoredSpecific:      restoreSpecific,
        }
      })

      // Fetch warehouse name for the set-level snapshot
      const whName = set.warehouseId
        ? (warehouseNameMap[set.warehouseId] || (await tx.warehouse.findUnique({ where: { id: set.warehouseId }, select: { name: true } }))?.name || null)
        : null

      // Write the permanent disassembly log (non-fatal — table may not exist yet)
      try {
        await tx.disassembledSetLog.create({
          data: {
            setCode:                  set.code,
            setTypeName:              set.setTypeName,
            setName:                  set.name || null,
            disassembledById:         req.user?.userId || null,
            disassembledByName:       req.user?.name   || 'Manager',
            // Manager acted directly — requester = executor
            requestedById:            req.user?.userId || null,
            requestedByName:          req.user?.name   || 'Manager',
            reason:                   reason.trim(),
            componentSnapshot:        componentSnapshot,
            lifecycleSnapshot:        set.lifecycleStatus || 'available',
            warehouseId:              set.warehouseId     || null,
            warehouseZone:            set.warehouseZone   || null,
            warehouseSpecificLocation:set.warehouseSpecificLocation || null,
            warehouseName:            whName,
          },
        })
      } catch (logErr) {
        console.warn('[DISASSEMBLE] DisassembledSetLog write skipped (table may not exist):', logErr.message)
      }

      // Log final location entry as 'disassembled' reason (non-fatal)
      try {
        await logSetLocation(tx, {
          setId:                    null,
          setCode:                  set.code,
          warehouseId:              set.warehouseId,
          warehouseZone:            set.warehouseZone,
          warehouseSpecificLocation:set.warehouseSpecificLocation,
          warehouseName:            whName,
          changedById:              req.user?.userId || null,
          changedByName:            req.user?.name || 'System',
          changeReason:             'disassembled',
          notes:                    reason.trim(),
        })
      } catch (logErr) {
        console.warn('[DISASSEMBLE] SetLocationHistory write skipped (table may not exist):', logErr.message)
      }

      for (const device of set.components) {
        const update = updates.find(u => parseInt(u.deviceId) === device.id)
        const action = update?.action || 'return'
        const dHealth = update?.healthStatus || device.healthStatus

        // Determine the warehouse location to restore to:
        // 1. Explicit per-component override from the disassemble form
        // 2. Fall back to the pre-set snapshot saved when the set was created
        // 3. Fall back to set's current location (✨ NEW FALLBACK)
        const locOverride = locationOverrides.find(l => parseInt(l.deviceId) === device.id)
        const restoreWarehouseId               = locOverride?.warehouseId               != null
          ? parseInt(locOverride.warehouseId)
          : (device.preSetWarehouseId || set.warehouseId || null)
        const restoreZone                      = locOverride?.warehouseZone             != null
          ? locOverride.warehouseZone
          : (device.preSetWarehouseZone || set.warehouseZone || null)
        const restoreSpecificLocation          = locOverride?.warehouseSpecificLocation != null
          ? locOverride.warehouseSpecificLocation
          : (device.preSetWarehouseSpecificLocation || set.warehouseSpecificLocation || null)

        if (action === 'lost') {
          await tx.deviceHistory.create({
            data: {
              deviceId:    device.id,
              fromStatus:  device.lifecycleStatus,
              toStatus:    'lost',
              changedById: req.user?.userId || null,
              note: `[SET_LEAVE] Removed from set ${set.code} (${set.setTypeName}) — marked lost | Reason: ${reason.trim()}`,
            },
          })
          await tx.device.delete({ where: { id: device.id } })
        } else {
          await tx.deviceHistory.create({
            data: {
              deviceId:    device.id,
              fromStatus:  device.lifecycleStatus,
              toStatus:    'available',
              changedById: req.user?.userId || null,
              note: `[SET_LEAVE] Removed from set ${set.code} (${set.setTypeName}) — returned to warehouse | Reason: ${reason.trim()}`,
            },
          })
          await tx.device.update({
            where: { id: device.id },
            data: {
              setId: null,
              lifecycleStatus: 'available',
              location: 'Warehouse',
              healthStatus: dHealth,
              // Restore warehouse location
              warehouseId:               restoreWarehouseId,
              warehouseZone:             restoreZone,
              warehouseSpecificLocation: restoreSpecificLocation,
              // Clear the snapshot since the set no longer exists
              preSetWarehouseId:               null,
              preSetWarehouseZone:             null,
              preSetWarehouseSpecificLocation: null,
            },
          })
        }
      }
      await tx.deviceSet.delete({ where: { id: parseInt(id) } })
    })
    res.json({ message: 'Set disassembled successfully' })
  } catch (err) {
    console.error('[DISASSEMBLE] Error:', err)
    res.status(500).json({ error: err.message || 'Failed to disassemble set' })
  }
})

// ── PATCH /:id/location — update warehouse location for a set + cascade to all components
const SET_MOVEABLE_STATUSES = new Set(['available', 'warehouse', 'returned', 'assigning',
  'assign_requested', 'assigned', 'ready_to_deploy', 'deploy_requested'])

router.patch('/:id/location', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { warehouseId, warehouseZone, warehouseSpecificLocation, notes } = req.body

    const set = await prisma.deviceSet.findUnique({
      where: { id: parseInt(id) },
      include: { components: true },
    })
    if (!set) return res.status(404).json({ error: 'Set not found' })

    if (!warehouseId) {
      return res.status(400).json({
        error: 'warehouseId is required to update set location',
      })
    }

    if (!SET_MOVEABLE_STATUSES.has(set.lifecycleStatus)) {
      return res.status(400).json({
        error: `Cannot update location while set is '${set.lifecycleStatus}'.`,
      })
    }

    const parsedWarehouseId = parseInt(warehouseId)

    const updatedSet = await prisma.$transaction(async (tx) => {
      // Update the set — warehouseZone/specific are plain scalars, always safe
      // warehouseId applied via raw SQL below to avoid stale-client relation ambiguity
      const updated = await tx.deviceSet.update({
        where: { id: parseInt(id) },
        data: {
          warehouseZone:             warehouseZone || null,
          warehouseSpecificLocation: warehouseSpecificLocation || null,
        },
        include: INCLUDE_SET,
      })

      // Apply warehouseId via raw SQL
      await tx.$executeRaw`UPDATE "DeviceSet" SET "warehouseId" = ${parsedWarehouseId} WHERE "id" = ${parseInt(id)}`

      // Cascade to all component devices — scalars fine in updateMany
      if (set.components.length > 0) {
        await tx.device.updateMany({
          where: { setId: parseInt(id) },
          data: {
            warehouseZone:             warehouseZone || null,
            warehouseSpecificLocation: warehouseSpecificLocation || null,
          },
        })
        // Apply warehouseId to all components via raw SQL
        await tx.$executeRaw`UPDATE "Device" SET "warehouseId" = ${parsedWarehouseId} WHERE "setId" = ${parseInt(id)}`
      }

      // Fetch warehouse name for the log
      const whRecord = await tx.warehouse.findUnique({ where: { id: parsedWarehouseId }, select: { name: true } })

      // Log the move
      await logSetLocation(tx, {
        setId:                    parseInt(id),
        setCode:                  set.code,
        warehouseId:              parsedWarehouseId,
        warehouseZone:            warehouseZone             || null,
        warehouseSpecificLocation:warehouseSpecificLocation || null,
        warehouseName:            whRecord?.name            || null,
        changedById:              req.user?.userId          || null,
        changedByName:            null,
        changeReason:             'location_move',
        notes:                    notes                     || null,
      })

      return updated
    })

    res.json(updatedSet)
  } catch (err) {
    console.error('Error updating set location:', err)
    res.status(500).json({ error: 'Failed to update set location' })
  }
})

// ✨ FIXED: Bug #3 - Set history error handling
router.get('/history', authMiddleware, requirePermission('Sets', 'read'), async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, parseInt(req.query.pageSize) || 20)
    const skip     = (page - 1) * pageSize
    const search   = req.query.search || ''

    const where = search ? {
      OR: [
        { setCode:     { contains: search, mode: 'insensitive' } },
        { setTypeName: { contains: search, mode: 'insensitive' } },
        { setName:     { contains: search, mode: 'insensitive' } },
      ],
    } : {}

    let total = 0, records = []
    try {
      ;[total, records] = await Promise.all([
        prisma.disassembledSetLog.count({ where }),
        prisma.disassembledSetLog.findMany({
          where,
          orderBy: { disassembledAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ])
      
      res.json({ total, page, pageSize, pages: Math.ceil(total / pageSize), records })
    } catch (tableErr) {
      // Table doesn't exist yet - return empty result with 200 status
      console.warn('[SET HISTORY] DisassembledSetLog table not found:', tableErr.message)
      return res.status(200).json({ 
        total: 0, 
        page, 
        pageSize, 
        pages: 0, 
        records: [], 
        _tableNotReady: true,
        message: 'Set history table not initialized. Run database migrations.' 
      })
    }
  } catch (err) {
    console.error('[SET HISTORY] Unexpected error:', err)
    res.status(500).json({ error: 'Failed to fetch set history' })
  }
})

// ── DELETE /history/:id — delete a DisassembledSetLog entry (manager+) ────────
router.delete('/history/:id', authMiddleware, requirePermission('Sets', 'update'), async (req, res) => {
  try {
    await prisma.disassembledSetLog.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: 'Set history entry deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete set history entry' })
  }
})

// ── Movement log — DeviceLocationHistory + SetLocationHistory combined ────────
router.get('/movements', authMiddleware, async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 30)
    const skip     = (page - 1) * pageSize
    const { warehouseId, zone, changedById, code, dateFrom, dateTo, kind } = req.query

    // ── Device location history ───────────────────────────────────────────
    const deviceWhere = {}
    if (warehouseId)  deviceWhere.warehouseId   = parseInt(warehouseId)
    if (zone)         deviceWhere.warehouseZone  = { contains: zone, mode: 'insensitive' }
    if (changedById)  deviceWhere.changedById    = parseInt(changedById)
    if (code)         deviceWhere.device         = { code: { contains: code.toUpperCase(), mode: 'insensitive' } }
    if (dateFrom || dateTo) {
      deviceWhere.timestamp = {}
      if (dateFrom) deviceWhere.timestamp.gte = new Date(dateFrom)
      if (dateTo)   deviceWhere.timestamp.lte = new Date(dateTo)
    }

    // ── Set location history ──────────────────────────────────────────────
    const setWhere = {}
    if (warehouseId)  setWhere.warehouseId  = parseInt(warehouseId)
    if (zone)         setWhere.warehouseZone = { contains: zone, mode: 'insensitive' }
    if (changedById)  setWhere.changedById   = parseInt(changedById)
    if (code)         setWhere.setCode       = { contains: code.toUpperCase(), mode: 'insensitive' }
    if (dateFrom || dateTo) {
      setWhere.timestamp = {}
      if (dateFrom) setWhere.timestamp.gte = new Date(dateFrom)
      if (dateTo)   setWhere.timestamp.lte = new Date(dateTo)
    }

    const fetchDevices = kind !== 'set'
    const fetchSets    = kind !== 'device'

    // Fetch device and set records — no nested role include to avoid Prisma relation issues
    const [deviceRecords, setRecords] = await Promise.all([
      fetchDevices ? prisma.deviceLocationHistory.findMany({
        where:   deviceWhere,
        orderBy: { timestamp: 'desc' },
        include: {
          device:    { select: { id: true, code: true, type: true } },
          warehouse: { select: { name: true } },
          // Only select scalar fields from changedBy to avoid role relation ambiguity
          changedBy: { select: { id: true, name: true, roleId: true } },
        },
      }).catch(err => {
        console.error('[MOVEMENTS] DeviceLocationHistory query failed:', err.message)
        return []
      }) : [],
      fetchSets ? prisma.setLocationHistory.findMany({
        where:   setWhere,
        orderBy: { timestamp: 'desc' },
      }).catch(err => {
        console.error('[MOVEMENTS] SetLocationHistory query failed:', err.message)
        return []
      }) : [],
    ])

    // Bulk-fetch role names for all unique roleIds found in device records
    const roleIds = [...new Set(deviceRecords.map(r => r.changedBy?.roleId).filter(Boolean))]
    const roleMap = {}
    if (roleIds.length > 0) {
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true },
      })
      roles.forEach(r => { roleMap[r.id] = r.name })
    }

    // Enrich device records with role name
    const enrichedDeviceRecords = deviceRecords.map(r => ({
      ...r,
      changedBy: r.changedBy ? {
        id:   r.changedBy.id,
        name: r.changedBy.name,
        role: r.changedBy.roleId ? { name: roleMap[r.changedBy.roleId] ?? null } : null,
      } : null,
    }))

    // Merge + sort by timestamp desc
    console.log(`[MOVEMENTS] Found ${enrichedDeviceRecords.length} device records, ${setRecords.length} set records`)
    const merged = [
      ...enrichedDeviceRecords.map(r => ({ ...r, _kind: 'device' })),
      ...setRecords.map(r => ({ ...r, _kind: 'set' })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    const total  = merged.length
    const sliced = merged.slice(skip, skip + pageSize)

    res.json({ total, page, pageSize, pages: Math.ceil(total / pageSize), records: sliced })
  } catch (err) {
    console.error('[MOVEMENTS] Error fetching movements:', err)
    res.status(500).json({ error: 'Failed to fetch movements' })
  }
})

router.post('/maintenance/recalculate-health', authMiddleware, requirePermission('Sets', 'update'), async (req, res) => {
  try {
    const sets = await prisma.deviceSet.findMany({
      include: { components: { select: { healthStatus: true } } }
    })
    
    let updated = 0
    for (const set of sets) {
      await prisma.$transaction(async (tx) => {
        await syncSetHealth(tx, set.id)
      })
      updated++
    }
    
    res.json({ 
      message: 'Set health recalculation completed',
      totalSets: sets.length,
      updated
    })
  } catch (err) {
    console.error('Health recalculation error:', err)
    res.status(500).json({ error: 'Failed to recalculate set health' })
  }
})

// ── GET /:id — MUST be last so it doesn't shadow /history, /movements etc ────
router.get('/:id', authMiddleware, requirePermission('Sets', 'read'), async (req, res) => {
  try {
    const set = await prisma.deviceSet.findUnique({ where: { id: parseInt(req.params.id) }, include: INCLUDE_SET })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    res.json(set)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch set' })
  }
})

export default router