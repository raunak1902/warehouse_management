/**
 * backend/routes/returns.js
 * ──────────────────────────
 * Endpoints for the Returns page:
 *   GET  /api/returns/subscriptions   — devices/sets with subscriptionEndDate set
 *   GET  /api/returns/pipeline        — devices/sets in return_initiated | return_transit
 *   GET  /api/returns/completed       — devices/sets in returned state (last 90 days)
 *   PATCH /api/returns/:type/:id/extend — update subscriptionEndDate directly
 *   GET  /api/returns/notification-count — get count of active subscription reminders
 *   POST /api/returns/mark-attended   — mark reminders as attended (clear notifications)
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma  = new PrismaClient()

router.use(authMiddleware)

const norm = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

const requireManager = (req, res, next) => {
  const role = norm(req.user.role)
  if (role !== 'manager' && role !== 'superadmin')
    return res.status(403).json({ error: 'Managers and admins only' })
  next()
}

const fmtDays = (date) => {
  if (!date) return null
  return Math.round((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
}

const urgency = (daysLeft) => {
  if (daysLeft === null) return 'none'
  if (daysLeft < 0)  return 'expired'
  if (daysLeft <= 2) return 'critical'
  if (daysLeft <= 7) return 'warning'
  return 'ok'
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /notification-count — count of unattended subscription reminders
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notification-count', requireManager, async (req, res) => {
  try {
    const reminders = await prisma.subscriptionReminder.findMany({
      where: {
        attended: false,
        OR: [
          { device: { lifecycleStatus: { notIn: ['available', 'returned'] } } },
          { deviceSet: { lifecycleStatus: { notIn: ['available', 'returned'] } } }
        ]
      },
      select: { deviceId: true, setId: true }
    })
    const count = reminders.length
    const deviceIds = [...new Set(reminders.filter(r => r.deviceId).map(r => r.deviceId))]
    const setIds    = [...new Set(reminders.filter(r => r.setId).map(r => r.setId))]
    res.json({ count, deviceIds, setIds })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriptions  — all devices/sets with a subscriptionEndDate
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriptions', requireManager, async (req, res) => {
  try {
    const [devices, sets, reminders] = await Promise.all([
      prisma.device.findMany({
        where: {
          subscriptionEndDate: { not: null },
          lifecycleStatus:     { notIn: ['available', 'returned'] },
        },
        include: { client: { select: { id: true, name: true, phone: true, company: true } } },
        orderBy: { subscriptionEndDate: 'asc' },
      }),
      prisma.deviceSet.findMany({
        where: {
          subscriptionEndDate: { not: null },
          lifecycleStatus:     { notIn: ['available', 'returned'] },
        },
        include: { client: { select: { id: true, name: true, phone: true, company: true } } },
        orderBy: { subscriptionEndDate: 'asc' },
      }),
      // Get unattended reminders to mark which items need attention
      prisma.subscriptionReminder.findMany({
        where: { attended: false },
        select: { deviceId: true, setId: true }
      })
    ])

    // Create lookup for unattended reminders
    const unattendedDevices = new Set(reminders.filter(r => r.deviceId).map(r => r.deviceId))
    const unattendedSets = new Set(reminders.filter(r => r.setId).map(r => r.setId))

    const shapeDevice = (d) => {
      const daysLeft = fmtDays(d.subscriptionEndDate)
      return {
        _kind:              'device',
        id:                 d.id,
        code:               d.code,
        barcode:            d.barcode,
        type:               d.type,
        lifecycleStatus:    d.lifecycleStatus,
        location:           [d.state, d.district, d.location].filter(Boolean).join(', ') || null,
        client:             d.client,
        subscriptionEndDate: d.subscriptionEndDate,
        daysLeft,
        urgency:            urgency(daysLeft),
        needsAttention:     unattendedDevices.has(d.id),
      }
    }
    const shapeSet = (s) => {
      const daysLeft = fmtDays(s.subscriptionEndDate)
      return {
        _kind:              'set',
        id:                 s.id,
        code:               s.code,
        barcode:            s.barcode,
        type:               s.setTypeName,
        lifecycleStatus:    s.lifecycleStatus,
        location:           [s.state, s.district, s.location].filter(Boolean).join(', ') || null,
        client:             s.client,
        subscriptionEndDate: s.subscriptionEndDate,
        daysLeft,
        urgency:            urgency(daysLeft),
        needsAttention:     unattendedSets.has(s.id),
      }
    }

    const all = [
      ...devices.map(shapeDevice),
      ...sets.map(shapeSet),
    ].sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))

    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /mark-attended — mark reminders as attended (clears notifications)
// Body: { deviceIds: [1,2,3], setIds: [4,5,6] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/mark-attended', requireManager, async (req, res) => {
  try {
    const { deviceIds = [], setIds = [] } = req.body

    const updates = []
    
    if (deviceIds.length > 0) {
      updates.push(
        prisma.subscriptionReminder.updateMany({
          where: { deviceId: { in: deviceIds }, attended: false },
          data: { attended: true, attendedAt: new Date() }
        })
      )
    }

    if (setIds.length > 0) {
      updates.push(
        prisma.subscriptionReminder.updateMany({
          where: { setId: { in: setIds }, attended: false },
          data: { attended: true, attendedAt: new Date() }
        })
      )
    }

    await Promise.all(updates)

    // Return new count
    const count = await prisma.subscriptionReminder.count({
      where: {
        attended: false,
        OR: [
          { device: { lifecycleStatus: { notIn: ['available', 'returned'] } } },
          { deviceSet: { lifecycleStatus: { notIn: ['available', 'returned'] } } }
        ]
      }
    })

    res.json({ success: true, newCount: count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /pipeline  — devices/sets in return_initiated | return_transit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pipeline', requireManager, async (req, res) => {
  try {
    const RETURN_STEPS = ['return_initiated', 'return_transit']

    const [devices, sets] = await Promise.all([
      prisma.device.findMany({
        where: { lifecycleStatus: { in: RETURN_STEPS } },
        include: { client: { select: { id: true, name: true, phone: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.deviceSet.findMany({
        where: { lifecycleStatus: { in: RETURN_STEPS } },
        include: { client: { select: { id: true, name: true, phone: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    // Fetch most recent lifecycle request to get who initiated + when
    const deviceIds = devices.map(d => d.id)
    const setIds    = sets.map(s => s.id)

    const [devRequests, setRequests] = await Promise.all([
      deviceIds.length ? prisma.lifecycleRequest.findMany({
        where:   { deviceId: { in: deviceIds }, toStep: { in: RETURN_STEPS } },
        orderBy: { createdAt: 'desc' },
        include: { requestedBy: { select: { name: true } } },
      }) : [],
      setIds.length ? prisma.lifecycleRequest.findMany({
        where:   { setId: { in: setIds }, toStep: { in: RETURN_STEPS } },
        orderBy: { createdAt: 'desc' },
        include: { requestedBy: { select: { name: true } } },
      }) : [],
    ])

    const devReqMap = {}
    for (const r of devRequests) {
      if (!devReqMap[r.deviceId]) devReqMap[r.deviceId] = r
    }
    const setReqMap = {}
    for (const r of setRequests) {
      if (!setReqMap[r.setId]) setReqMap[r.setId] = r
    }

    const daysInStep = (updatedAt) =>
      Math.floor((Date.now() - new Date(updatedAt)) / (1000 * 60 * 60 * 24))

    const result = [
      ...devices.map(d => ({
        _kind:           'device',
        id:              d.id,
        code:            d.code,
        type:            d.type,
        lifecycleStatus: d.lifecycleStatus,
        client:          d.client,
        updatedAt:       d.updatedAt,
        daysInStep:      daysInStep(d.updatedAt),
        initiatedBy:     devReqMap[d.id]?.requestedBy?.name ?? null,
        initiatedAt:     devReqMap[d.id]?.createdAt ?? null,
        subscriptionEndDate: d.subscriptionEndDate,
      })),
      ...sets.map(s => ({
        _kind:           'set',
        id:              s.id,
        code:            s.code,
        type:            s.setTypeName,
        lifecycleStatus: s.lifecycleStatus,
        client:          s.client,
        updatedAt:       s.updatedAt,
        daysInStep:      daysInStep(s.updatedAt),
        initiatedBy:     setReqMap[s.id]?.requestedBy?.name ?? null,
        initiatedAt:     setReqMap[s.id]?.createdAt ?? null,
        subscriptionEndDate: s.subscriptionEndDate,
      })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /completed  — returned devices/sets (last 90 days)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/completed', requireManager, async (req, res) => {
  try {
    const since = new Date()
    since.setDate(since.getDate() - 90)

    const [devices, sets] = await Promise.all([
      prisma.device.findMany({
        where: { lifecycleStatus: 'returned', updatedAt: { gte: since } },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.deviceSet.findMany({
        where: { lifecycleStatus: 'returned', updatedAt: { gte: since } },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
    ])

    const result = [
      ...devices.map(d => ({ _kind:'device', id:d.id, code:d.code, type:d.type, client:d.client, returnedAt:d.updatedAt })),
      ...sets.map(s    => ({ _kind:'set',    id:s.id, code:s.code, type:s.setTypeName, client:s.client, returnedAt:s.updatedAt })),
    ].sort((a, b) => new Date(b.returnedAt) - new Date(a.returnedAt))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /device/:id/extend  OR  /set/:id/extend
// Extend subscription date directly — no approval needed
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:kind/:id/extend', requireManager, async (req, res) => {
  try {
    const { kind, id } = req.params
    const { subscriptionEndDate } = req.body
    if (!subscriptionEndDate) return res.status(400).json({ error: 'subscriptionEndDate is required' })

    const newDate = new Date(subscriptionEndDate)
    if (isNaN(newDate)) return res.status(400).json({ error: 'Invalid date' })

    if (kind === 'device') {
      const d = await prisma.device.update({
        where: { id: parseInt(id) },
        data:  { subscriptionEndDate: newDate, updatedAt: new Date() },
        select: { id: true, code: true, subscriptionEndDate: true },
      })
      // Mark existing reminders as attended and reset them for new date
      await prisma.subscriptionReminder.updateMany({
        where: { deviceId: parseInt(id) },
        data: { attended: true, attendedAt: new Date() }
      })
      return res.json(d)
    }
    if (kind === 'set') {
      const s = await prisma.deviceSet.update({
        where: { id: parseInt(id) },
        data:  { subscriptionEndDate: newDate, updatedAt: new Date() },
        select: { id: true, code: true, subscriptionEndDate: true },
      })
      await prisma.subscriptionReminder.updateMany({
        where: { setId: parseInt(id) },
        data: { attended: true, attendedAt: new Date() }
      })
      return res.json(s)
    }
    res.status(400).json({ error: 'kind must be device or set' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router