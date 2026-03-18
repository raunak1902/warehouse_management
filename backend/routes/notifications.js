/**
 * routes/notifications.js
 * ────────────────────────
 * In-app notification endpoints + SSE real-time stream.
 *
 * SSE flow:
 *  1. Manager/Admin browser opens  GET /api/notifications/stream
 *  2. Connection is held open; server sends keep-alive every 25s
 *  3. When a ground-team request is created, lifecycleRequests.js calls
 *     broadcastToManagers(payload) which pushes an SSE event to all
 *     connected manager/admin clients instantly.
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma  = new PrismaClient()

// ── SSE client registry ───────────────────────────────────────────────────────
// Map<userId, Set<res>> — one user may have multiple tabs open
const sseClients = new Map()

const norm = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

function addClient(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set())
  sseClients.get(userId).add(res)
}

function removeClient(userId, res) {
  const set = sseClients.get(userId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) sseClients.delete(userId)
}

function sendEvent(res, eventName, data) {
  try {
    res.write(`event: ${eventName}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  } catch (_) {}
}

/**
 * Broadcast a new-request SSE event to all connected managers & admins.
 * Exported so lifecycleRequests.js can call it after creating a request.
 */
export async function broadcastToManagers(payload) {
  try {
    const managers = await prisma.user.findMany({
      where: { role: { name: { in: ['MANAGER', 'SUPER_ADMIN'] } } },
      select: { id: true },
    })
    for (const { id } of managers) {
      const conns = sseClients.get(id)
      if (!conns) continue
      for (const res of conns) {
        sendEvent(res, 'new_request', payload)
      }
    }
  } catch (_) {}
}

router.use(authMiddleware)

// ─────────────────────────────────────────────────────────────────────────────
// GET /stream  — SSE connection (managers + admins only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stream', (req, res) => {
  const role = norm(req.user.role)
  if (role !== 'manager' && role !== 'superadmin') {
    return res.status(403).json({ error: 'Only managers and admins can subscribe' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const userId = req.user.userId
  addClient(userId, res)

  sendEvent(res, 'connected', { message: 'SSE stream connected', userId })

  // Keep-alive ping every 25s
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n') } catch (_) { clearInterval(keepAlive) }
  }, 25_000)

  req.on('close', () => {
    clearInterval(keepAlive)
    removeClient(userId, res)
  })
})

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