/**
 * routes/notifications.js
 * ────────────────────────
 * In-app notification endpoints.
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma  = new PrismaClient()

router.use(authMiddleware)

// GET / — get all notifications for the current user (most recent first)
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

// GET /unread-count — lightweight count for polling
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

// PATCH /:id/read — mark one notification as read
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

// PATCH /read-all — mark all as read
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

export default router