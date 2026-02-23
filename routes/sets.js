import express from "express"
import { PrismaClient } from "@prisma/client"
import authMiddleware from "../middleware/auth.js"
import { requirePermission } from "../middleware/Permissions.js"

const router = express.Router()
const prisma = new PrismaClient()

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

const SET_CODE_PREFIX = { aStand: 'ASET', iStand: 'ISET', tabletCombo: 'TSET' }
const getSetCodePrefix = (setType) => {
  if (SET_CODE_PREFIX[setType]) return SET_CODE_PREFIX[setType]
  return (setType || 'SET').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) + 'S'
}

const INCLUDE_SET = { components: { include: { client: true } }, client: true }

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

router.get('/:id', authMiddleware, requirePermission('Sets', 'read'), async (req, res) => {
  try {
    const set = await prisma.deviceSet.findUnique({ where: { id: parseInt(req.params.id) }, include: INCLUDE_SET })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    res.json(set)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch set' })
  }
})

router.post('/', authMiddleware, requirePermission('Sets', 'create'), async (req, res) => {
  try {
    const { setType, setTypeName, name, componentDeviceIds, location, clientId } = req.body
    if (!setType || !setTypeName) return res.status(400).json({ error: 'setType and setTypeName are required' })
    if (!componentDeviceIds || !Array.isArray(componentDeviceIds) || componentDeviceIds.length === 0)
      return res.status(400).json({ error: 'componentDeviceIds must be a non-empty array' })

    const deviceIds = componentDeviceIds.map(id => parseInt(id))
    const devices = await prisma.device.findMany({ where: { id: { in: deviceIds } } })
    if (devices.length !== deviceIds.length) return res.status(400).json({ error: 'One or more devices not found' })
    const notInWarehouse = devices.filter(d => d.lifecycleStatus !== 'warehouse')
    if (notInWarehouse.length > 0) return res.status(400).json({ error: `Devices not in warehouse: ${notInWarehouse.map(d => d.code).join(', ')}` })
    const alreadyInSet = devices.filter(d => d.setId)
    if (alreadyInSet.length > 0) return res.status(400).json({ error: `Devices already in a set: ${alreadyInSet.map(d => d.code).join(', ')}` })

    const prefix = getSetCodePrefix(setType)
    const code = await getNextSetCode(prefix)
    let barcode = generateSetBarcode(setType)
    let attempts = 0
    while (await prisma.deviceSet.findUnique({ where: { barcode } }) && attempts < 10) {
      barcode = generateSetBarcode(setType) + '-' + Math.random().toString(36).substring(2, 4).toUpperCase()
      attempts++
    }

    const newSet = await prisma.$transaction(async (tx) => {
      const set = await tx.deviceSet.create({
        data: { code, barcode, setType, setTypeName, name: name || null, lifecycleStatus: 'warehouse', healthStatus: 'ok', location: location || 'Warehouse A', clientId: clientId ? parseInt(clientId) : null },
      })
      await tx.device.updateMany({ where: { id: { in: deviceIds } }, data: { setId: set.id } })
      return await tx.deviceSet.findUnique({ where: { id: set.id }, include: INCLUDE_SET })
    })

    res.status(201).json(newSet)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create set' })
  }
})

router.put('/:id', authMiddleware, requirePermission('Sets', 'update'), async (req, res) => {
  try {
    const { id } = req.params
    const { lifecycleStatus, healthStatus, location, state, district, clientId, notes, componentHealthUpdates } = req.body
    const existing = await prisma.deviceSet.findUnique({ where: { id: parseInt(id) } })
    if (!existing) return res.status(404).json({ error: 'Set not found' })
    const updated = await prisma.$transaction(async (tx) => {
      const set = await tx.deviceSet.update({
        where: { id: parseInt(id) },
        data: {
          ...(lifecycleStatus !== undefined && { lifecycleStatus }),
          ...(healthStatus !== undefined && { healthStatus }),
          ...(location !== undefined && { location }),
          ...(state !== undefined && { state }),
          ...(district !== undefined && { district }),
          ...(notes !== undefined && { notes }),
          ...(clientId !== undefined && { clientId: clientId ? parseInt(clientId) : null }),
        },
        include: INCLUDE_SET,
      })
      if (componentHealthUpdates && Array.isArray(componentHealthUpdates)) {
        for (const { deviceId, healthStatus: dHealth } of componentHealthUpdates) {
          await tx.device.update({ where: { id: parseInt(deviceId) }, data: { healthStatus: dHealth } })
        }
      }
      return set
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update set' })
  }
})

router.post('/:id/disassemble', authMiddleware, requirePermission('Sets', 'disassemble'), async (req, res) => {
  try {
    const { id } = req.params
    const { componentUpdates } = req.body
    const set = await prisma.deviceSet.findUnique({ where: { id: parseInt(id) }, include: { components: true } })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    await prisma.$transaction(async (tx) => {
      const updates = componentUpdates || []
      for (const device of set.components) {
        const update = updates.find(u => parseInt(u.deviceId) === device.id)
        const action = update?.action || 'return'
        const dHealth = update?.healthStatus || device.healthStatus
        if (action === 'lost') {
          await tx.device.delete({ where: { id: device.id } })
        } else {
          await tx.device.update({ where: { id: device.id }, data: { setId: null, lifecycleStatus: 'warehouse', location: 'Warehouse A', healthStatus: dHealth } })
        }
      }
      await tx.deviceSet.delete({ where: { id: parseInt(id) } })
    })
    res.json({ message: 'Set disassembled successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to disassemble set' })
  }
})

router.delete('/:id', authMiddleware, requirePermission('Sets', 'delete'), async (req, res) => {
  try {
    const { id } = req.params
    const set = await prisma.deviceSet.findUnique({ where: { id: parseInt(id) }, include: { components: true } })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    await prisma.$transaction(async (tx) => {
      if (set.components.length > 0) {
        await tx.device.updateMany({ where: { setId: parseInt(id) }, data: { setId: null, lifecycleStatus: 'warehouse', location: 'Warehouse A' } })
      }
      await tx.deviceSet.delete({ where: { id: parseInt(id) } })
    })
    res.json({ message: 'Set deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete set' })
  }
})

export default router