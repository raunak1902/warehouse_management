/**
 * backend/routes/deletionRequests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the full lifecycle of deferred device/set deletions.
 *
 * FLOW:
 *  1.  Manager hits DELETE /api/devices/:id  or  DELETE /api/sets/:id
 *      → those routes now call `scheduleDeletion()` from here instead of
 *        deleting directly.
 *
 *  2.  scheduleDeletion() validates lifecycle status, captures a full snapshot,
 *      persists a DeletionRequest record (status=pending, scheduledFor=now+24h),
 *      notifies all managers via SSE, and returns 202.
 *
 *  3.  GET  /api/deletion-requests        → list (managers only)
 *      DELETE /api/deletion-requests/:id  → cancel within window (any manager)
 *
 *  4.  Cron (deletionExecutor.js) runs every 30 min, finds pending records
 *      whose scheduledFor has passed, executes the real delete, marks executed.
 */

import express                        from 'express'
import { PrismaClient }               from '@prisma/client'
import authMiddleware, { isManagerOrAbove } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

// ── Constants ──────────────────────────────────────────────────────────────────
export const DELETION_DELAY_MS = 24 * 60 * 60 * 1000   // 24 hours

// Lifecycle statuses that BLOCK deletion — device must be returned/available first
const BLOCKED_STATUSES = new Set([
  'assigning', 'ready_to_deploy', 'in_transit', 'received',
  'installed', 'active', 'under_maintenance', 'return_initiated', 'return_transit',
])

// ── Helper: notify all managers about a deletion event ────────────────────────
async function notifyManagers(prismaClient, payload) {
  // Persist DB notifications only — do NOT broadcast via SSE as new_request,
  // because the Requests page would show it as an approvable lifecycle request
  // and fail when trying to call lifecycleRequest.findUnique with a deletionRequest id.
  const managers = await prismaClient.user.findMany({
    where:  { role: { name: { in: ['MANAGER', 'SUPER_ADMIN'] } } },
    select: { id: true },
  })
  for (const m of managers) {
    await prismaClient.notification.create({
      data: {
        userId: m.id,
        title:  payload.title,
        body:   payload.body,
        type:   'deletion',
      },
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// scheduleDeletion — called by devices.js and sets.js DELETE routes
// ─────────────────────────────────────────────────────────────────────────────
export async function scheduleDeletion(req, res, entityType) {
  try {
    const id     = parseInt(req.params.id)
    const reason = (req.body?.reason ?? '').trim()

    if (!reason) {
      return res.status(400).json({ error: 'A reason is required to schedule a deletion.' })
    }

    const requestedById   = req.user.userId
    const requestedByName = req.user.name ?? req.user.role ?? 'Manager'

    // ── Load entity ──────────────────────────────────────────────────────────
    let entity, componentSnapshot = null

    if (entityType === 'device') {
      entity = await prisma.device.findUnique({
        where:   { id },
        include: { client: { select: { id: true, name: true } } },
      })
      if (!entity) return res.status(404).json({ error: 'Device not found.' })

      // Block if in active lifecycle
      if (BLOCKED_STATUSES.has(entity.lifecycleStatus)) {
        return res.status(400).json({
          error: `Cannot schedule deletion — device is currently "${entity.lifecycleStatus}". ` +
                 `Complete the return lifecycle first.`,
        })
      }

      // Block if part of a set
      if (entity.setId) {
        return res.status(400).json({
          error: `Cannot delete a device that belongs to a set (${entity.setId}). Remove it from the set first.`,
        })
      }

    } else {
      // set
      entity = await prisma.deviceSet.findUnique({
        where:   { id },
        include: {
          components: { include: { client: { select: { id: true, name: true } } } },
          client:     { select: { id: true, name: true } },
        },
      })
      if (!entity) return res.status(404).json({ error: 'Set not found.' })

      if (BLOCKED_STATUSES.has(entity.lifecycleStatus)) {
        return res.status(400).json({
          error: `Cannot schedule deletion — set is currently "${entity.lifecycleStatus}". ` +
                 `Complete the return lifecycle first.`,
        })
      }

      componentSnapshot = entity.components.map(c => ({ ...c }))
    }

    // ── Check: no duplicate pending deletion for same entity ─────────────────
    const existing = await prisma.deletionRequest.findFirst({
      where: { entityType, entityId: id, status: 'pending' },
    })
    if (existing) {
      return res.status(409).json({
        error:    `A deletion is already scheduled for this ${entityType}.`,
        existing: {
          id:           existing.id,
          scheduledFor: existing.scheduledFor,
        },
      })
    }

    const scheduledFor = new Date(Date.now() + DELETION_DELAY_MS)

    // ── Create DeletionRequest record ─────────────────────────────────────────
    const deletionReq = await prisma.deletionRequest.create({
      data: {
        entityType,
        entityId:          id,
        entityCode:        entity.code,
        snapshot:          { ...entity, components: undefined, client: undefined, _clientName: entity.client?.name ?? null },
        componentSnapshot: componentSnapshot
          ? componentSnapshot.map(c => ({ ...c, client: undefined, _clientName: c.client?.name ?? null }))
          : undefined,
        reason,
        requestedById,
        requestedByName,
        scheduledFor,
        status: 'pending',
      },
    })

    // ── Notify managers ───────────────────────────────────────────────────────
    const scheduledStr = scheduledFor.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    await notifyManagers(prisma, {
      deletionRequestId: deletionReq.id,
      entityType,
      entityCode:   entity.code,
      reason,
      requestedByName,
      scheduledFor: scheduledFor.toISOString(),
      title: `${entityType === 'set' ? 'Set' : 'Device'} deletion scheduled`,
      body:  `${requestedByName} scheduled ${entity.code} for deletion. ` +
             `Will execute at ${scheduledStr}. Can be cancelled before then.`,
    })

    return res.status(202).json({
      message:      `Deletion scheduled. ${entity.code} will be permanently deleted after ${scheduledStr}.`,
      deletionRequest: {
        id:          deletionReq.id,
        entityCode:  entity.code,
        scheduledFor: deletionReq.scheduledFor,
        reason,
      },
    })

  } catch (err) {
    console.error('[scheduleDeletion] Error:', err)
    return res.status(500).json({ error: 'Failed to schedule deletion.' })
  }
}

// ── All routes below require auth + manager role ──────────────────────────────
router.use(authMiddleware, isManagerOrAbove)

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deletion-requests
// List all deletion requests — pending shown first, then executed/cancelled
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status } = req.query  // optional filter: pending | cancelled | executed

    const records = await prisma.deletionRequest.findMany({
      where:   status ? { status } : undefined,
      orderBy: [
        { status: 'asc' },        // pending first
        { scheduledFor: 'asc' },
      ],
    })

    res.json(records)
  } catch (err) {
    console.error('[GET /deletion-requests]', err)
    res.status(500).json({ error: 'Failed to fetch deletion requests.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/deletion-requests/:id  →  cancel a pending deletion
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const record = await prisma.deletionRequest.findUnique({ where: { id } })
    if (!record) return res.status(404).json({ error: 'Deletion request not found.' })

    if (record.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot cancel — deletion is already "${record.status}".`,
      })
    }

    if (new Date() >= record.scheduledFor) {
      return res.status(400).json({
        error: 'Deletion window has passed — it may already be executing.',
      })
    }

    const cancelledByName = req.user.name ?? req.user.role ?? 'Manager'

    await prisma.deletionRequest.update({
      where: { id },
      data:  {
        status:          'cancelled',
        cancelledById:   req.user.userId,
        cancelledByName,
        cancelledAt:     new Date(),
      },
    })

    // Notify managers
    await notifyManagers(prisma, {
      deletionRequestId: id,
      entityType:   record.entityType,
      entityCode:   record.entityCode,
      cancelledByName,
      title: `${record.entityType === 'set' ? 'Set' : 'Device'} deletion cancelled`,
      body:  `${cancelledByName} cancelled the scheduled deletion of ${record.entityCode}.`,
    })

    res.json({ message: `Deletion of ${record.entityCode} has been cancelled.` })

  } catch (err) {
    console.error('[DELETE /deletion-requests/:id]', err)
    res.status(500).json({ error: 'Failed to cancel deletion.' })
  }
})

export default router