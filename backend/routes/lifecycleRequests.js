/**
 * routes/lifecycleRequests.js
 * ────────────────────────────
 * Unified lifecycle request system.
 * Replaces both /api/ground-requests and /api/assignment-requests.
 *
 * Lifecycle step order (strictly enforced on the backend):
 *   available → assigning → ready_to_deploy → in_transit →
 *   received  → installed → active
 *   active / under_maintenance → under_maintenance | return_initiated | lost
 *   return_initiated → return_transit → returned → (auto-resets device to available)
 *
 * Auto-approve: Manager / SuperAdmin submissions skip the pending queue.
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'
import { requirePermission } from '../middleware/Permissions.js'

const router = express.Router()
const prisma  = new PrismaClient()

router.use(authMiddleware)

const norm = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

// ── Step gating: what step can a device at currentStep move TO? ───────────────
const VALID_NEXT_STEPS = {
  available:         ['assigning'],
  assigning:         ['ready_to_deploy', 'health_update'],
  ready_to_deploy:   ['in_transit', 'health_update'],
  in_transit:        ['received', 'health_update'],
  received:          ['installed', 'health_update'],
  installed:         ['active', 'health_update'],
  active:            ['under_maintenance', 'return_initiated', 'lost', 'health_update'],
  under_maintenance: ['active', 'return_initiated', 'lost', 'health_update'],
  return_initiated:  ['return_transit', 'health_update'],
  return_transit:    ['returned', 'health_update'],
  returned:          ['assigning'],   // can be re-assigned immediately
  lost:              ['health_update'],  // health can still be updated

  // ── Legacy status aliases (old devices.js system) ──────────────────────────
  // Devices added before the unified lifecycle system may still carry these
  // old status strings. They are treated as equivalent to their new counterparts
  // so that transitions are never blocked solely because of a naming mismatch.
  warehouse:         ['assigning'],          // same as "available"
  assign_requested:  ['ready_to_deploy'],    // same as "assigning"
  assigned:          ['ready_to_deploy'],    // same as "assigning"
  deploy_requested:  ['in_transit'],         // same as "ready_to_deploy"
  deployed:          ['under_maintenance', 'return_initiated', 'lost'], // same as "active"
  return_requested:  ['return_transit'],      // same as "return_initiated"
}

// ── Step metadata for display / notifications ─────────────────────────────────
export const STEP_META = {
  assigning:         { label: 'Assigning to Client',  emoji: '🔗', color: 'blue'   },
  ready_to_deploy:   { label: 'Ready to Deploy',      emoji: '✅', color: 'teal'   },
  in_transit:        { label: 'In Transit',           emoji: '🚚', color: 'amber'  },
  received:          { label: 'Received at Site',     emoji: '📦', color: 'purple' },
  installed:         { label: 'Installed',            emoji: '🔧', color: 'indigo' },
  active:            { label: 'Active / Live',        emoji: '🟢', color: 'green'  },
  under_maintenance: { label: 'Under Maintenance',    emoji: '🛠', color: 'orange' },
  return_initiated:  { label: 'Return Initiated',     emoji: '↩️', color: 'rose'   },
  return_transit:    { label: 'Return In Transit',     emoji: '🚛', color: 'pink'   },
  returned:          { label: 'Returned to Warehouse', emoji: '🏭', color: 'slate'  },
  lost:              { label: 'Lost',                 emoji: '❌', color: 'red'    },
  health_update:     { label: 'Health Status Update',  emoji: '🩺', color: 'cyan'   },
}

// ── Helper: enrich a request with names ──────────────────────────────────────
async function shape(r) {
  const [reqUser, appUser, device, set] = await Promise.all([
    prisma.user.findUnique({ where: { id: r.requestedById }, select: { name: true } }),
    r.approvedById
      ? prisma.user.findUnique({ where: { id: r.approvedById }, select: { name: true } })
      : null,
    r.deviceId
      ? prisma.device.findUnique({ where: { id: r.deviceId }, select: { code: true, type: true } })
      : null,
    r.setId
      ? prisma.deviceSet.findUnique({ where: { id: r.setId }, select: { code: true, setTypeName: true } })
      : null,
  ])
  return {
    id:              r.id,
    toStep:          r.toStep,
    stepLabel:       STEP_META[r.toStep]?.label ?? r.toStep,
    deviceId:        r.deviceId,
    setId:           r.setId,
    deviceCode:      device?.code  ?? null,
    deviceType:      device?.type  ?? set?.setTypeName ?? null,
    setCode:         set?.code     ?? null,
    healthStatus:    r.healthStatus,
    healthNote:      r.healthNote,
    note:            r.note,
    status:          r.status,
    rejectionNote:   r.rejectionNote,
    autoApproved:    r.autoApproved,
    requestedById:   r.requestedById,
    requestedByName: reqUser?.name ?? 'Unknown',
    approvedById:    r.approvedById,
    approvedByName:  appUser?.name ?? null,
    rejectedByName:  r.status === 'rejected' ? (appUser?.name ?? null) : null,
    createdAt:       r.createdAt,
    approvedAt:      r.approvedAt,
    updatedAt:       r.updatedAt,
  }
}

// ── Helper: create a notification for a user ──────────────────────────────────
async function notify(userId, title, body, requestId) {
  try {
    await prisma.notification.create({ data: { userId, title, body, requestId } })
  } catch (_) { /* non-critical */ }
}

// ── Helper: recalculate set health from worst member health ───────────────────
const HEALTH_RANK = { ok: 0, repair: 1, damaged: 2 }
async function syncSetHealth(tx, setId) {
  const members = await tx.device.findMany({
    where: { setId },
    select: { healthStatus: true },
  })
  if (!members.length) return
  const worst = members.reduce((acc, m) => {
    const r = HEALTH_RANK[m.healthStatus] ?? 0
    return r > (HEALTH_RANK[acc] ?? 0) ? m.healthStatus : acc
  }, 'ok')
  await tx.deviceSet.update({
    where: { id: setId },
    data: { healthStatus: worst, updatedAt: new Date() },
  })
}

// ── Core approval logic (shared by POST auto-approve + PATCH approve) ─────────
async function applyApproval(tx, req, approverId) {
  const now = new Date()

  // health_update only changes healthStatus — lifecycleStatus stays the same
  const isHealthUpdate = req.toStep === 'health_update'

  // Build the device/set update
  const update = isHealthUpdate
    ? { healthStatus: req.healthStatus, updatedAt: now }
    : { lifecycleStatus: req.toStep, healthStatus: req.healthStatus, updatedAt: now }

  // 'returned' resets client and re-opens for assigning
  if (req.toStep === 'returned') {
    update.clientId  = null
    update.deployedAt = null
  }

  // 'assigning' stamps when client was assigned
  if (req.toStep === 'assigning') {
    update.assignedAt = now
    // clientId is embedded in the note JSON if provided
    if (req.note) {
      try {
        const meta = JSON.parse(req.note)
        if (meta.clientId) update.clientId = parseInt(meta.clientId)
      } catch (_) {}
    }
  }

  // 'active' / 'installed' stamps deployedAt
  if (req.toStep === 'active') update.deployedAt = now

  if (req.deviceId) {
    const cur = await tx.device.findUnique({
      where: { id: req.deviceId },
      select: { lifecycleStatus: true, healthStatus: true, setId: true },
    })

    await tx.device.update({ where: { id: req.deviceId }, data: update })

    // Write history record
    await tx.deviceHistory.create({
      data: {
        deviceId:    req.deviceId,
        fromStatus:  cur?.lifecycleStatus ?? '',
        toStatus:    isHealthUpdate ? cur?.lifecycleStatus ?? '' : req.toStep,
        changedById: approverId,
        note: isHealthUpdate
          ? `[LR#${req.id}] Health updated to ${req.healthStatus}` +
            (req.healthNote ? ` | Note: ${req.healthNote}` : '')
          : `[LR#${req.id}] → ${STEP_META[req.toStep]?.label ?? req.toStep}` +
            (req.healthStatus !== 'ok' ? ` | Health: ${req.healthStatus}` : '') +
            (req.healthNote ? ` | Note: ${req.healthNote}` : ''),
      },
    })

    // Propagate health change up to set if device is in one
    if (cur?.setId) await syncSetHealth(tx, cur.setId)
  }

  if (req.setId) {
    const setUpdate = {
      lifecycleStatus: req.toStep,
      healthStatus:    req.healthStatus,
      updatedAt:       now,
    }
    if (req.toStep === 'returned')  { setUpdate.clientId = null }
    if (req.toStep === 'assigning' && req.note) {
      try { const m = JSON.parse(req.note); if (m.clientId) setUpdate.clientId = parseInt(m.clientId) } catch (_) {}
    }
    // Note: DeviceSet has no deployedAt column — only Device does

    await tx.deviceSet.update({ where: { id: req.setId }, data: setUpdate })

    // Fetch updated set to cascade ALL fields (clientId, state, district, location) to members
    const updatedSet = await tx.deviceSet.findUnique({
      where: { id: req.setId },
      select: { clientId: true, state: true, district: true, location: true },
    })

    // Build member device update — sync lifecycle + client + location
    const memberUpdate = { lifecycleStatus: req.toStep, updatedAt: now }

    if (updatedSet) {
      memberUpdate.clientId = updatedSet.clientId ?? null

      if (['active', 'installed', 'received', 'under_maintenance'].includes(req.toStep)) {
        // Cascade full location once device is at/near client site
        memberUpdate.state    = updatedSet.state    ?? null
        memberUpdate.district = updatedSet.district ?? null
        memberUpdate.location = updatedSet.location ?? null
      } else if (req.toStep === 'returned') {
        // Clear client + location on return
        memberUpdate.clientId = null
        memberUpdate.state    = null
        memberUpdate.district = null
        memberUpdate.location = null
      }
    }

    // Cascade to all member devices
    await tx.device.updateMany({
      where: { setId: req.setId },
      data:  memberUpdate,
    })
  }

  // Stamp request as approved
  await tx.lifecycleRequest.update({
    where: { id: req.id },
    data: { status: 'approved', approvedById: approverId, approvedAt: now },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /  — list requests
// Managers/SuperAdmin: all requests; GroundTeam: own only
// Filters: status, clientId, requestedById, toStep, deviceId, setId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const { status, clientId, requestedById, toStep, deviceId, setId } = req.query
    const isGroundTeam = norm(req.user.role) === 'groundteam'

    const where = {
      ...(isGroundTeam ? { requestedById: req.user.userId } : {}),
      ...(status       ? { status }       : {}),
      ...(toStep       ? { toStep }        : {}),
      ...(deviceId     ? { deviceId: parseInt(deviceId) } : {}),
      ...(setId        ? { setId:    parseInt(setId)    } : {}),
      ...(requestedById && !isGroundTeam
            ? { requestedById: parseInt(requestedById) } : {}),
    }

    // clientId filter: join through device/set
    if (clientId && !isGroundTeam) {
      const cId = parseInt(clientId)
      const [devIds, setIds] = await Promise.all([
        prisma.device.findMany({ where: { clientId: cId }, select: { id: true } }),
        prisma.deviceSet.findMany({ where: { clientId: cId }, select: { id: true } }),
      ])
      where.OR = [
        { deviceId: { in: devIds.map(d => d.id) } },
        { setId:    { in: setIds.map(s => s.id)  } },
      ]
    }

    const rows = await prisma.lifecycleRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    res.json(await Promise.all(rows.map(shape)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /summary — pending counts for notification bell & filter strip
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const pending = await prisma.lifecycleRequest.findMany({
      where: { status: 'pending' },
      select: { id: true, requestedById: true, deviceId: true, setId: true, toStep: true },
    })

    // Enrich with names for the "by ground team member" grouping
    const userIds = [...new Set(pending.map(r => r.requestedById))]
    const users   = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))

    const byUser = {}
    const byStep = {}
    for (const r of pending) {
      const name = userMap[r.requestedById] ?? 'Unknown'
      byUser[name] = (byUser[name] ?? 0) + 1
      byStep[r.toStep] = (byStep[r.toStep] ?? 0) + 1
    }

    res.json({ total: pending.length, byUser, byStep })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /device/:deviceId/history — lifecycle history for a device
// ─────────────────────────────────────────────────────────────────────────────
router.get('/device/:deviceId/history', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId)
    const requests = await prisma.lifecycleRequest.findMany({
      where:   { deviceId, status: 'approved' },
      orderBy: { approvedAt: 'asc' },
    })
    res.json(await Promise.all(requests.map(shape)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /set/:setId/history — lifecycle history for a set
// ─────────────────────────────────────────────────────────────────────────────
router.get('/set/:setId/history', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const setId = parseInt(req.params.setId)
    const requests = await prisma.lifecycleRequest.findMany({
      where:   { setId, status: 'approved' },
      orderBy: { approvedAt: 'asc' },
    })
    res.json(await Promise.all(requests.map(shape)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST / — submit a lifecycle request
// • GroundTeam  → saved as 'pending', awaits approval
// • Manager/SuperAdmin → auto-approved in one atomic transaction
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requirePermission('LifecycleRequests', 'create'), async (req, res) => {
  try {
    const { deviceId, setId, toStep, healthStatus = 'ok', healthNote, note } = req.body

    // Validation
    if (!toStep) return res.status(400).json({ message: 'toStep is required' })
    if (!deviceId && !setId) return res.status(400).json({ message: 'deviceId or setId is required' })
    if (healthStatus !== 'ok' && !healthNote?.trim())
      return res.status(400).json({ message: 'healthNote is required when health is not OK' })

    // Fetch current lifecycle status to validate step gating
    let currentStep = 'available'
    if (deviceId) {
      const d = await prisma.device.findUnique({ where: { id: parseInt(deviceId) }, select: { lifecycleStatus: true } })
      if (!d) return res.status(404).json({ message: 'Device not found' })
      currentStep = d.lifecycleStatus
    } else {
      const s = await prisma.deviceSet.findUnique({ where: { id: parseInt(setId) }, select: { lifecycleStatus: true } })
      if (!s) return res.status(404).json({ message: 'Set not found' })
      currentStep = s.lifecycleStatus
    }

    const validNextSteps = VALID_NEXT_STEPS[currentStep] ?? []
    // health_update is allowed from any non-available/returned status
    const isHealthUpdate = toStep === 'health_update'
    if (!isHealthUpdate && !validNextSteps.includes(toStep)) {
      return res.status(400).json({
        message: `Cannot move from '${currentStep}' to '${toStep}'. Valid next steps: ${validNextSteps.join(', ') || 'none (terminal state)'}`,
      })
    }

    const isManager = ['manager', 'superadmin'].includes(norm(req.user.role))

    // Duplicate pending check (only for GroundTeam)
    if (!isManager) {
      const existing = await prisma.lifecycleRequest.findFirst({
        where: {
          requestedById: req.user.userId,
          status: 'pending',
          ...(deviceId ? { deviceId: parseInt(deviceId) } : { setId: parseInt(setId) }),
        },
      })
      if (existing)
        return res.status(409).json({ message: 'You already have a pending request for this device/set.' })
    }

    const data = {
      requestedById: req.user.userId,
      fromStep:   currentStep,
      toStep,
      healthStatus,
      healthNote: healthNote?.trim() || null,
      note:       note?.trim()       || null,
      deviceId:   deviceId ? parseInt(deviceId) : null,
      setId:      setId    ? parseInt(setId)    : null,
      status:     'pending',
    }

    if (isManager) {
      // ── Manager: create + auto-approve atomically ─────────────────────────
      const result = await prisma.$transaction(async (tx) => {
        const row = await tx.lifecycleRequest.create({ data })
        await applyApproval(tx, row, req.user.userId)
        // Mark auto-approved
        await tx.lifecycleRequest.update({ where: { id: row.id }, data: { autoApproved: true } })
        return tx.lifecycleRequest.findUnique({ where: { id: row.id } })
      })
      return res.status(201).json({ ...(await shape(result)), autoApproved: true })
    }

    // ── GroundTeam: create as pending ────────────────────────────────────────
    const row = await prisma.lifecycleRequest.create({ data })

    // Notify all managers/admins about the new pending request
    const managers = await prisma.user.findMany({
      where: { role: { name: { in: ['Manager', 'SuperAdmin'] } } },
      select: { id: true },
    })
    const meta = STEP_META[toStep]
    await Promise.all(managers.map(m =>
      notify(m.id,
        `${meta?.emoji ?? '📋'} New ${meta?.label ?? toStep} Request`,
        `${req.user.name ?? 'Ground team'} submitted a request for ${deviceId ? `device #${deviceId}` : `set #${setId}`}`,
        row.id)
    ))

    res.status(201).json(await shape(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /device/:deviceId/pending  — active pending request for a device
// GET /set/:setId/pending        — active pending request for a set
// Both used by BarcodeResultCard to show pending state on load / after action.
// IMPORTANT: These must be registered BEFORE /:id to avoid route conflicts.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/device/:deviceId/pending', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId)
    const row = await prisma.lifecycleRequest.findFirst({
      where:   { deviceId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (!row) return res.json(null)
    res.json(await shape(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/set/:setId/pending', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const setId = parseInt(req.params.setId)
    const row = await prisma.lifecycleRequest.findFirst({
      where:   { setId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (!row) return res.json(null)
    res.json(await shape(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/approve', requirePermission('LifecycleRequests', 'approve'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const request = await prisma.lifecycleRequest.findUnique({ where: { id } })
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be approved' })

    await prisma.$transaction(async (tx) => {
      await applyApproval(tx, request, req.user.userId)
    })

    // Notify the requester
    const meta = STEP_META[request.toStep]
    await notify(
      request.requestedById,
      `${meta?.emoji ?? '✅'} Request Approved`,
      `Your ${meta?.label ?? request.toStep} request has been approved by ${req.user.name ?? 'Admin'}`,
      id
    )

    res.json({ message: 'Request approved' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/reject', requirePermission('LifecycleRequests', 'reject'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { rejectionNote } = req.body
    if (!rejectionNote?.trim()) return res.status(400).json({ message: 'rejectionNote is required' })

    const request = await prisma.lifecycleRequest.findUnique({ where: { id } })
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be rejected' })

    const updated = await prisma.lifecycleRequest.update({
      where: { id },
      data: { status: 'rejected', rejectionNote: rejectionNote.trim(), approvedById: req.user.userId, approvedAt: new Date() },
    })

    // Notify the requester
    const meta = STEP_META[request.toStep]
    await notify(
      request.requestedById,
      `❌ Request Rejected`,
      `Your ${meta?.label ?? request.toStep} request was rejected: ${rejectionNote.trim()}`,
      id
    )

    res.json(await shape(updated))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:id  — Withdraw / cancel a pending request
// Rules:
//   • Ground team can only withdraw their OWN requests
//   • Manager / SuperAdmin can withdraw any pending request
//   • Rolls the device/set lifecycleStatus back to fromStep
//   • Deletes the LifecycleRequest row entirely
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requirePermission('LifecycleRequests', 'create'), async (req, res) => {
  try {
    const id        = parseInt(req.params.id)
    const isManager = ['manager', 'superadmin'].includes(norm(req.user.role))

    const request = await prisma.lifecycleRequest.findUnique({ where: { id } })
    if (!request)                    return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be withdrawn' })

    // Ground team can only withdraw their own request
    if (!isManager && request.requestedById !== req.user.userId) {
      return res.status(403).json({ message: 'You can only withdraw your own requests' })
    }

    await prisma.$transaction(async (tx) => {
      // Roll device back to fromStep
      if (request.deviceId) {
        await tx.device.update({
          where: { id: request.deviceId },
          data:  { lifecycleStatus: request.fromStep, updatedAt: new Date() },
        })
        await tx.deviceHistory.create({
          data: {
            deviceId:    request.deviceId,
            fromStatus:  request.toStep,
            toStatus:    request.fromStep,
            changedById: req.user.userId,
            note: `[LR#${id}] Request withdrawn — rolled back to ${request.fromStep}`,
          },
        })
      }
      // Roll set back to fromStep
      if (request.setId) {
        await tx.deviceSet.update({
          where: { id: request.setId },
          data:  { lifecycleStatus: request.fromStep, updatedAt: new Date() },
        })
        await tx.device.updateMany({
          where: { setId: request.setId },
          data:  { lifecycleStatus: request.fromStep, updatedAt: new Date() },
        })
      }
      // Delete the request row
      await tx.lifecycleRequest.delete({ where: { id } })
    })

    res.json({ message: 'Request withdrawn successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router