/**
 * routes/notifications.js
 * ────────────────────────
 * In-app notification endpoints.
 *
 * The previous SSE /stream endpoint has been removed.
 * The frontend now polls /api/inventory-requests/pending-count every 15s,
 * which works correctly on all platforms (Render, Vercel, local).
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma  = new PrismaClient()

const norm = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

/**
 * broadcastToManagers — kept as a no-op export so inventoryRequests.js
 * doesn't need to change. The frontend no longer relies on SSE push;
 * it discovers new requests via polling instead.
 */
export async function broadcastToManagers(_payload) {
  // No-op: SSE removed. Frontend polls pending-count endpoint instead.
}

router.use(authMiddleware)

// ─────────────────────────────────────────────────────────────────────────────
// GET /  — all notifications for current user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })
    res.json(notifications)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /unread-count
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unread-count', async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.userId, read: false },
    })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/read
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.notification.update({
      where: { id, userId: req.user.userId },
      data:  { read: true },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /read-all
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, read: false },
      data:  { read: true },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// GET /login-briefing  — all pending requests grouped for the login modal
// ─────────────────────────────────────────────────────────────────────────────
router.get('/login-briefing', async (req, res) => {
  const role = norm(req.user.role)
  if (role !== 'manager' && role !== 'superadmin') {
    return res.status(403).json({ error: 'Managers and admins only' })
  }
  try {
    const rows = await prisma.lifecycleRequest.findMany({
      where:   { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { name: true } },
        device:      { select: { code: true, type: true } },
        deviceSet:   { select: { code: true, setTypeName: true } },
      },
    })

    // Shape each row lightly (no heavy shape() call — just what the briefing needs)
    const requests = rows.map(r => ({
      id:              r.id,
      toStep:          r.toStep,
      stepLabel:       r.toStep,
      deviceCode:      r.device?.code      ?? null,
      setCode:         r.deviceSet?.code   ?? null,
      deviceType:      r.device?.type      ?? r.deviceSet?.setTypeName ?? null,
      requestedByName: r.requestedBy?.name ?? 'Unknown',
      note:            r.note,
      healthStatus:    r.healthStatus,
      createdAt:       r.createdAt,
    }))

    // Group by toStep for summary
    const byStep = {}
    for (const r of requests) {
      byStep[r.toStep] = (byStep[r.toStep] ?? 0) + 1
    }

    res.json({ total: requests.length, byStep, requests })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router