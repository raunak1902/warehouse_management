/**
 * backend/cron/deletionExecutor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 30 minutes.
 * Finds DeletionRequest records with status='pending' and scheduledFor <= now,
 * executes the real DB delete inside a transaction, marks the record 'executed'.
 *
 * If the entity is already gone (deleted by other means), it still marks
 * the record 'executed' with a note — so the audit trail stays clean.
 */

import { PrismaClient }           from '@prisma/client'
import { broadcastToManagers }    from '../routes/notifications.js'

const prisma = new PrismaClient()

const INTERVAL_MS = 30 * 60 * 1000   // run every 30 minutes

async function executePendingDeletions() {
  console.log('[DeletionExecutor] Checking for pending deletions…')

  const due = await prisma.deletionRequest.findMany({
    where: {
      status:      'pending',
      scheduledFor: { lte: new Date() },
    },
  })

  if (due.length === 0) {
    console.log('[DeletionExecutor] Nothing due.')
    return
  }

  console.log(`[DeletionExecutor] ${due.length} deletion(s) due.`)

  for (const req of due) {
    try {
      let note = null

      await prisma.$transaction(async (tx) => {
        if (req.entityType === 'device') {
          const dev = await tx.device.findUnique({ where: { id: req.entityId } })
          if (dev) {
            await tx.device.delete({ where: { id: req.entityId } })
          } else {
            note = 'Device was already absent from DB at execution time.'
          }

        } else {
          // set — detach components first, then delete set
          const set = await tx.deviceSet.findUnique({
            where:   { id: req.entityId },
            include: { components: true },
          })
          if (set) {
            if (set.components.length > 0) {
              await tx.device.updateMany({
                where: { setId: req.entityId },
                data:  {
                  setId:           null,
                  clientId:        null,       // clear dangling client ref
                  lifecycleStatus: 'available',
                  location:        'Warehouse A',
                  updatedAt:       new Date(),
                },
              })
            }
            await tx.deviceSet.delete({ where: { id: req.entityId } })
          } else {
            note = 'Set was already absent from DB at execution time.'
          }
        }

        // Mark executed inside the same transaction so they're atomic
        await tx.deletionRequest.update({
          where: { id: req.id },
          data:  {
            status:        'executed',
            executedAt:    new Date(),
            executionNote: note,
          },
        })
      })

      console.log(`[DeletionExecutor] ✓ ${req.entityType} ${req.entityCode} (DR#${req.id}) executed.`)

      // Notify managers
      await broadcastToManagers({
        type:              'deletion_executed',
        deletionRequestId: req.id,
        entityType:        req.entityType,
        entityCode:        req.entityCode,
        requestedByName:   req.requestedByName,
        title:             `${req.entityType === 'set' ? 'Set' : 'Device'} permanently deleted`,
        body:              `${req.entityCode} has been permanently deleted. ` +
                           `(Requested by ${req.requestedByName}. Reason: ${req.reason})`,
      }).catch(() => {})

      // DB notification for managers
      const managers = await prisma.user.findMany({
        where:  { role: { name: { in: ['MANAGER', 'SUPER_ADMIN'] } } },
        select: { id: true },
      })
      for (const m of managers) {
        await prisma.notification.create({
          data: {
            userId: m.id,
            title:  `${req.entityType === 'set' ? 'Set' : 'Device'} permanently deleted`,
            body:   `${req.entityCode} was deleted. Reason: ${req.reason}`,
            type:   'deletion',
          },
        }).catch(() => {})
      }

    } catch (err) {
      console.error(`[DeletionExecutor] ✗ Failed to execute DR#${req.id} (${req.entityCode}):`, err.message)

      // Mark as executed with error note — don't leave it stuck as pending
      await prisma.deletionRequest.update({
        where: { id: req.id },
        data:  {
          status:        'executed',
          executedAt:    new Date(),
          executionNote: `ERROR: ${err.message}`,
        },
      }).catch(() => {})
    }
  }
}

export function startDeletionExecutorCron() {
  // Run immediately on startup to catch anything missed during downtime
  executePendingDeletions().catch(console.error)

  // Then run every 30 minutes
  setInterval(() => {
    executePendingDeletions().catch(console.error)
  }, INTERVAL_MS)

  console.log('[DeletionExecutor] Cron started — runs every 30 minutes.')
}