import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

const normalize = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

const requireGroundTeam = (req, res, next) => {
  const role = normalize(req.user?.role)
  if (role !== 'groundteam')
    return res.status(403).json({ message: `Ground Team only. Your role normalized to: "${role}"` })
  next()
}

const requireManagerOrAbove = (req, res, next) => {
  const r = normalize(req.user?.role)
  if (r !== 'superadmin' && r !== 'manager')
    return res.status(403).json({ message: 'Manager or SuperAdmin access required' })
  next()
}

router.use(authMiddleware)

const getUserName = async (id) => {
  if (!id) return null
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } })
  return u?.name ?? null
}

const shape = async (r) => ({
  id:              r.id,
  requestType:     r.requestType,
  deviceId:        r.deviceId,
  setId:           r.setId,
  status:          r.status,
  notes:           r.note,
  changes:         Array.isArray(r.changes) ? r.changes : [],
  requestedBy:     r.requestedById,
  requestedByName: await getUserName(r.requestedById),
  approvedBy:      r.approvedById,
  approvedByName:  await getUserName(r.approvedById),
  approvedAt:      r.approvedAt,
  rejectionNote:   r.adminNote,
  createdAt:       r.createdAt,
})

// GET /api/ground-requests — managers see all, ground team sees own
router.get('/', async (req, res) => {
  try {
    const { status } = req.query
    const isGroundTeam = normalize(req.user.role) === 'groundteam'
    const where = {
      ...(isGroundTeam ? { requestedById: req.user.userId } : {}),
      ...(status ? { status } : {}),
    }
    const rows = await prisma.teamRequest.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(await Promise.all(rows.map(shape)))
  } catch (err) {
    console.error('[GET /ground-requests] ERROR:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ground-requests/mine — own requests, NO role guard
router.get('/mine', async (req, res) => {
  try {
    const { status } = req.query
    const where = {
      requestedById: req.user.userId,
      ...(status ? { status } : {}),
    }
    const rows = await prisma.teamRequest.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(await Promise.all(rows.map(shape)))
  } catch (err) {
    console.error('[GET /mine] ERROR:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ground-requests — Ground Team only
router.post('/', requireGroundTeam, async (req, res) => {
  try {
    const { requestType, deviceId, setId, note, changes } = req.body

    if (!requestType)
      return res.status(400).json({ message: 'requestType is required' })

    if (!changes || !Array.isArray(changes) || changes.length === 0)
      return res.status(400).json({ message: 'changes array is required and must not be empty' })

    // deviceId or setId only required for device-specific types
    const deviceSpecificTypes = ['assignment', 'health_change', 'location_change', 'set_change']
    if (deviceSpecificTypes.includes(requestType) && !deviceId && !setId)
      return res.status(400).json({ message: 'deviceId or setId is required for this request type' })

    // Only check duplicates when a device/set is specified
    if (deviceId || setId) {
      const existing = await prisma.teamRequest.findFirst({
        where: {
          requestedById: req.user.userId,
          status: 'pending',
          ...(deviceId ? { deviceId: parseInt(deviceId) } : {}),
          ...(setId    ? { setId:    parseInt(setId)    } : {}),
        },
      })
      if (existing) {
        return res.status(409).json({ message: 'You already have a pending request for this device/set.' })
      }
    }

    const row = await prisma.teamRequest.create({
      data: {
        requestedById: req.user.userId,
        requestType,
        deviceId: deviceId ? parseInt(deviceId) : null,
        setId:    setId    ? parseInt(setId)    : null,
        note:     note ?? null,
        changes:  changes.map(c => ({
          field: c.field,
          from:  c.from ?? c.fromValue ?? null,
          to:    c.to   ?? c.toValue,
        })),
        status: 'pending',
      },
    })

    res.status(201).json(await shape(row))
  } catch (err) {
    console.error('[POST /ground-requests] ERROR:', err.message, err.stack)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/ground-requests/:id/approve — Manager / SuperAdmin
router.patch('/:id/approve', requireManagerOrAbove, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const request = await prisma.teamRequest.findUnique({ where: { id } })
    if (!request)                     return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be approved' })

    const changes = Array.isArray(request.changes) ? request.changes : []

    // Map change fields to actual DB columns
    // Only include fields that exist on both Device and DeviceSet models
    const DEVICE_FIELD_MAP = {
      clientId:     'clientId',
      deliveryDate: 'deployedAt',
      state:        'state',
      district:     'district',
      location:     'location',
      healthStatus: 'healthStatus',
    }

    const deviceUpdate = {}
    for (const c of changes) {
      const col = DEVICE_FIELD_MAP[c.field]
      if (col) {
        if (c.field === 'clientId') {
          deviceUpdate[col] = parseInt(c.to)
        } else if (col === 'deployedAt') {
          // Parse the date and set time to current time of approval
          const d = new Date(c.to)
          const now = new Date()
          d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
          deviceUpdate[col] = d.toISOString()
        } else {
          deviceUpdate[col] = c.to
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (request.deviceId) {
        // Device has updatedAt field
        await tx.device.update({
          where: { id: request.deviceId },
          data:  { ...deviceUpdate, lifecycleStatus: 'assigning', updatedAt: new Date() },
        })
      }
      if (request.setId) {
        // DeviceSet does NOT have updatedAt — omit it
        await tx.deviceSet.update({
          where: { id: request.setId },
          data:  { ...deviceUpdate, lifecycleStatus: 'assigning' },
        })
      }
      await tx.teamRequest.update({
        where: { id },
        data:  { status: 'approved', approvedById: req.user.userId, approvedAt: new Date() },
      })
    })

    res.json({ message: 'Request approved' })
  } catch (err) {
    console.error('[PATCH /approve] ERROR:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/ground-requests/:id/reject — Manager / SuperAdmin
router.patch('/:id/reject', requireManagerOrAbove, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { rejectionNote } = req.body

    if (!rejectionNote?.trim())
      return res.status(400).json({ message: 'rejectionNote is required' })

    const request = await prisma.teamRequest.findUnique({ where: { id } })
    if (!request)                     return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be rejected' })

    const updated = await prisma.teamRequest.update({
      where: { id },
      data:  { status: 'rejected', adminNote: rejectionNote.trim() },
    })

    res.json(await shape(updated))
  } catch (err) {
    console.error('[PATCH /reject] ERROR:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router