/**
 * routes/lifecycleRequests.js
 * ────────────────────────────
 * Unified lifecycle request system.
 * Handles multipart/form-data for proof file uploads.
 *
 * Lifecycle step order (strictly enforced):
 *   available → assigning → ready_to_deploy → in_transit →
 *   received  → installed → active
 *   active / under_maintenance → under_maintenance | return_initiated | lost
 *   return_initiated → return_transit → returned → (re-opens for assigning)
 *
 * Auto-approve: Manager / SuperAdmin submissions skip the pending queue.
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware    from '../middleware/auth.js'
import { requirePermission } from '../middleware/Permissions.js'
import {
  multerUpload, processAndSaveFile, classifyMime,
} from '../middleware/proofUpload.js'
import { broadcastToManagers } from './notifications.js'

const router = express.Router()
const prisma  = new PrismaClient()

router.use(authMiddleware)

const norm = (r) => (r ?? '').toLowerCase().replace(/[\s_-]/g, '')

// ── Server base URL (used to build file URLs) ─────────────────────────────────
// SERVER_BASE_URL must be set as an environment variable on Render.
// Without it, proof file URLs are saved as localhost:5000 in the DB —
// unreachable from any browser in production.
const serverBaseUrl = () => {
  if (!process.env.SERVER_BASE_URL) {
    console.warn('[WARNING] SERVER_BASE_URL is not set. Proof URLs will be saved as localhost and will not load in production!')
  }
  return process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 5000}`
}

// ── Step gating ───────────────────────────────────────────────────────────────
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
  returned:          ['assigning'],
  lost:              ['health_update'],
  // Legacy aliases
  warehouse:         ['assigning'],
  assign_requested:  ['ready_to_deploy'],
  assigned:          ['ready_to_deploy'],
  deploy_requested:  ['in_transit'],
  deployed:          ['under_maintenance', 'return_initiated', 'lost'],
  return_requested:  ['return_transit'],
}

// ── Steps that REQUIRE proof (except 'assigning') ─────────────────────────────
const PROOF_REQUIRED_STEPS = new Set([
  'ready_to_deploy', 'in_transit', 'received', 'installed',
  'active', 'under_maintenance', 'return_initiated', 'return_transit',
  'returned', 'lost',
])
const HEALTH_REQUIRES_PROOF = new Set(['repair', 'damaged', 'lost'])

export const STEP_META = {
  assigning:         { label: 'Assigning to Client',   emoji: '🔗', color: 'blue'   },
  ready_to_deploy:   { label: 'Ready to Deploy',       emoji: '✅', color: 'teal'   },
  in_transit:        { label: 'In Transit',            emoji: '🚚', color: 'amber'  },
  received:          { label: 'Received at Site',      emoji: '📦', color: 'purple' },
  installed:         { label: 'Installed',             emoji: '🔧', color: 'indigo' },
  active:            { label: 'Active / Live',         emoji: '🟢', color: 'green'  },
  under_maintenance: { label: 'Under Maintenance',     emoji: '🛠', color: 'orange' },
  return_initiated:  { label: 'Return Initiated',      emoji: '↩️', color: 'rose'   },
  return_transit:    { label: 'Return In Transit',     emoji: '🚛', color: 'pink'   },
  returned:          { label: 'Returned to Warehouse', emoji: '🏭', color: 'slate'  },
  lost:              { label: 'Lost',                  emoji: '❌', color: 'red'    },
  health_update:     { label: 'Health Status Update',  emoji: '🩺', color: 'cyan'   },
}

// ── Enrich request with names + proofUrls ─────────────────────────────────────
async function shape(r) {
  const [reqUser, appUser, device, set, proofFiles] = await Promise.all([
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
    prisma.proofFile.findMany({
      where:   { requestId: r.id },
      orderBy: { createdAt: 'asc' },
      select:  { url: true, thumbUrl: true, fileType: true, fileName: true, sizeKb: true },
    }),
  ])

  return {
    id:              r.id,
    toStep:          r.toStep,
    fromStep:        r.fromStep,
    stepLabel:       STEP_META[r.toStep]?.label ?? r.toStep,
    deviceId:        r.deviceId,
    setId:           r.setId,
    deviceCode:      device?.code       ?? null,
    deviceType:      device?.type       ?? set?.setTypeName ?? null,
    setCode:         set?.code          ?? null,
    healthStatus:    r.healthStatus,
    healthNote:      r.healthNote,
    note:            r.note,
    status:          r.status,
    rejectionNote:   r.rejectionNote,
    autoApproved:    r.autoApproved,
    requestedById:   r.requestedById,
    requestedByName: reqUser?.name  ?? 'Unknown',
    approvedById:    r.approvedById,
    approvedByName:  appUser?.name  ?? null,
    rejectedByName:  r.status === 'rejected' ? (appUser?.name ?? null) : null,
    createdAt:       r.createdAt,
    approvedAt:      r.approvedAt,
    // Proof attachments — thumbUrl preferred for timeline, url for lightbox
    proofUrls:  proofFiles.map(f => f.url),
    thumbUrls:  proofFiles.map(f => f.thumbUrl ?? f.url),
    proofFiles: proofFiles,
  }
}

async function notify(userId, title, body, requestId) {
  try {
    await prisma.notification.create({ data: { userId, title, body, requestId } })
  } catch (_) { /* non-critical */ }
}

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

async function applyApproval(tx, req, approverId) {
  const now          = new Date()
  const isHealthUpdate = req.toStep === 'health_update'

  const update = isHealthUpdate
    ? { healthStatus: req.healthStatus, updatedAt: now }
    : { lifecycleStatus: req.toStep, healthStatus: req.healthStatus, updatedAt: now }

  // ✨ FIXED: Bug #4 - Require warehouse location for returns
  if (req.toStep === 'returned') {
    update.client    = { disconnect: true }
    update.deployedAt = null
    update.subscriptionEndDate = null
    
    // Extract warehouse location from note JSON (set by LifecycleActionModal)
    let hasLocation = false
    try {
      const meta = JSON.parse(req.note || '{}')
      if (meta.warehouseId) {
        // Use relation connect for warehouseId — direct scalar may not be exposed
        // depending on prisma client version; connect works universally
        update.warehouse                 = { connect: { id: parseInt(meta.warehouseId) } }
        update.warehouseZone             = meta.warehouseZone             || null
        update.warehouseSpecificLocation = meta.warehouseSpecificLocation || null
        // Also store the raw id so DeviceLocationHistory logging can read it back
        update._warehouseIdRaw           = parseInt(meta.warehouseId)
        hasLocation = true
      }
    } catch (_) { /* note may not be JSON if set manually */ }
    
    // ✨ NEW: Require warehouse location for returns
    if (!hasLocation) {
      throw new Error('Warehouse location is required when returning a device to warehouse. Please specify the warehouse, zone, and location.')
    }
  }
  if (req.toStep === 'assigning' && req.note) {
    try {
      const meta = JSON.parse(req.note)
      if (meta.clientId) update.client = { connect: { id: parseInt(meta.clientId) } }
      if (meta.subscriptionEnd) update.subscriptionEndDate = new Date(meta.subscriptionEnd)
    } catch (_) {}
  }
  if (req.toStep === 'active') update.deployedAt = now

  if (req.deviceId) {
    const cur = await tx.device.findUnique({
      where: { id: req.deviceId },
      select: { lifecycleStatus: true, healthStatus: true, setId: true },
    })
    // Strip private helper key before passing to Prisma
    const warehouseIdForRaw = update._warehouseIdRaw ?? null
    delete update._warehouseIdRaw
    await tx.device.update({ where: { id: req.deviceId }, data: update })
    // Apply warehouseId via raw SQL — avoids Prisma relation/scalar ambiguity on older clients
    if (warehouseIdForRaw) {
      await tx.$executeRaw`UPDATE "Device" SET "warehouseId" = ${warehouseIdForRaw} WHERE "id" = ${req.deviceId}`
    }
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
    // Log DeviceLocationHistory for all movement-implying lifecycle steps
    const MOVEMENT_STEPS = new Set(['in_transit', 'received', 'installed', 'active', 'returned'])
    if (!isHealthUpdate && MOVEMENT_STEPS.has(req.toStep)) {
      try {
        if (req.toStep === 'returned' && warehouseIdForRaw) {
          await tx.deviceLocationHistory.create({
            data: {
              deviceId:                 req.deviceId,
              warehouseId:              warehouseIdForRaw,
              warehouseZone:            update.warehouseZone             || null,
              warehouseSpecificLocation:update.warehouseSpecificLocation || null,
              changedById:              approverId,
              changeReason:             'returned',
              notes:                    'Device returned to warehouse',
            },
          })
        } else {
          // Deployment steps — fetch current deployment location after update
          const updatedDev = await tx.device.findUnique({
            where: { id: req.deviceId },
            select: { state: true, district: true, location: true, clientId: true },
          })
          await tx.deviceLocationHistory.create({
            data: {
              deviceId:          req.deviceId,
              clientId:          updatedDev?.clientId     || null,
              deploymentState:   updatedDev?.state        || null,
              deploymentDistrict:updatedDev?.district     || null,
              deploymentSite:    updatedDev?.location     || null,
              changedById:       approverId,
              changeReason:      req.toStep,
              notes:             'Lifecycle step: ' + (STEP_META[req.toStep]?.label ?? req.toStep),
            },
          })
        }
      } catch (_) { /* non-fatal */ }
    }
    if (cur?.setId) await syncSetHealth(tx, cur.setId)
  }

  if (req.setId) {
    const setUpdate = {
      ...(isHealthUpdate ? {} : { lifecycleStatus: req.toStep }),
      healthStatus:    req.healthStatus,
      updatedAt:       now,
    }
    if (req.toStep === 'returned') {
      setUpdate.client = { disconnect: true }
      setUpdate.subscriptionEndDate = null
      // Extract warehouse location from note JSON
      try {
        const meta = JSON.parse(req.note || '{}')
        if (meta.warehouseId) {
          setUpdate.warehouse                 = { connect: { id: parseInt(meta.warehouseId) } }
          setUpdate.warehouseZone             = meta.warehouseZone             || null
          setUpdate.warehouseSpecificLocation = meta.warehouseSpecificLocation || null
          setUpdate._warehouseIdRaw           = parseInt(meta.warehouseId)
        }
      } catch (_) { /* non-JSON note */ }
    }
    if (req.toStep === 'assigning' && req.note) {
      try {
        const m = JSON.parse(req.note)
        if (m.clientId) setUpdate.client = { connect: { id: parseInt(m.clientId) } }
        if (m.subscriptionEnd) setUpdate.subscriptionEndDate = new Date(m.subscriptionEnd)
      } catch (_) {}
    }
    // Strip private helper key before passing to Prisma
    const setWarehouseIdForRaw = setUpdate._warehouseIdRaw ?? null
    delete setUpdate._warehouseIdRaw
    await tx.deviceSet.update({ where: { id: req.setId }, data: setUpdate })
    // Apply warehouseId via raw SQL — avoids Prisma relation/scalar ambiguity on older clients
    if (setWarehouseIdForRaw) {
      await tx.$executeRaw`UPDATE "DeviceSet" SET "warehouseId" = ${setWarehouseIdForRaw} WHERE "id" = ${req.setId}`
    }

    const updatedSet = await tx.deviceSet.findUnique({
      where: { id: req.setId },
      select: { clientId: true, state: true, district: true, location: true, code: true, setTypeName: true },
    })
    if (!isHealthUpdate) {
      // Lifecycle step change — cascade status + location + clientId to all members
      const memberUpdate = { lifecycleStatus: req.toStep, updatedAt: now }
      let memberClientId = updatedSet ? (updatedSet.clientId ?? null) : undefined
      if (updatedSet) {
        if (['active', 'installed', 'received', 'under_maintenance'].includes(req.toStep)) {
          memberUpdate.state    = updatedSet.state    ?? null
          memberUpdate.district = updatedSet.district ?? null
          memberUpdate.location = updatedSet.location ?? null
        } else if (req.toStep === 'returned') {
          memberClientId        = null
          memberUpdate.state    = null
          memberUpdate.district = null
          memberUpdate.location = null
          // Cascade warehouse zone/specific to all components via updateMany (scalars are fine here)
          // warehouseId is set via raw query below to avoid Prisma relation ambiguity
          try {
            const meta = JSON.parse(req.note || '{}')
            if (meta.warehouseId) {
              memberUpdate._returnWarehouseId        = parseInt(meta.warehouseId)
              memberUpdate.warehouseZone             = meta.warehouseZone             || null
              memberUpdate.warehouseSpecificLocation = meta.warehouseSpecificLocation || null
            }
          } catch (_) { /* non-JSON note */ }
        }
      }
      // Extract private keys before passing memberUpdate to Prisma
      const returnWarehouseIdForMembers = memberUpdate._returnWarehouseId ?? null
      delete memberUpdate._returnWarehouseId

      await tx.device.updateMany({ where: { setId: req.setId }, data: memberUpdate })
      // Update clientId via raw query — Prisma generated client may not expose scalar FK
      if (memberClientId !== undefined) {
        if (memberClientId === null) {
          await tx.$executeRaw`UPDATE "Device" SET "clientId" = NULL WHERE "setId" = ${req.setId}`
        } else {
          await tx.$executeRaw`UPDATE "Device" SET "clientId" = ${memberClientId} WHERE "setId" = ${req.setId}`
        }
      }
      // Update warehouseId for all components via raw SQL (avoids Prisma relation ambiguity)
      if (returnWarehouseIdForMembers) {
        await tx.$executeRaw`UPDATE "Device" SET "warehouseId" = ${returnWarehouseIdForMembers} WHERE "setId" = ${req.setId}`
      }
      // ── Log DeviceHistory for every component device — set moved ────────────
      const setCode     = updatedSet?.code        ?? `Set#${req.setId}`
      const setTypeName = updatedSet?.setTypeName  ?? ''
      const stepLabel   = STEP_META[req.toStep]?.label ?? req.toStep
      const components  = await tx.device.findMany({ where: { setId: req.setId }, select: { id: true, lifecycleStatus: true } })
      await Promise.all(components.map(d =>
        tx.deviceHistory.create({
          data: {
            deviceId:    d.id,
            fromStatus:  d.lifecycleStatus,
            toStatus:    req.toStep,
            changedById: approverId,
            note: (() => {
              let base = `[SET_MOVE] Via set ${setCode} (${setTypeName}) → ${stepLabel}`
              if (req.healthStatus !== 'ok') base += ` | Health: ${req.healthStatus}`
              if (req.healthNote) base += ` | Note: ${req.healthNote}`
              if (req.note) {
                try {
                  const m = JSON.parse(req.note)
                  if (m && typeof m === 'object') {
                    if (m.clientName) base += ` | Client: ${m.clientName}`
                    else if (m.clientId) base += ` | Client ID: ${m.clientId}`
                    if (m.returnType === 'days' && m.returnDays) base += ` | Return: ${m.returnDays} days`
                    else if (m.returnType === 'months' && m.returnMonths) base += ` | Return: ${m.returnMonths} months`
                    else if (m.returnType === 'date' && m.returnDate) base += ` | Return by: ${new Date(m.returnDate).toLocaleDateString('en-IN')}`
                    if (m.subscriptionEnd) base += ` | Sub end: ${new Date(m.subscriptionEnd).toLocaleDateString('en-IN')}`
                    if (m.state) base += ` | State: ${m.state}`
                    if (m.district) base += ` | District: ${m.district}`
                  } else { base += ` | ${req.note}` }
                } catch { base += ` | ${req.note}` }
              }
              return base
            })(),
          },
        })
      ))
    } else {
      // Health update on set — log for all components too
      const setCode     = updatedSet?.code        ?? `Set#${req.setId}`
      const setTypeName = updatedSet?.setTypeName  ?? ''
      const components  = await tx.device.findMany({ where: { setId: req.setId }, select: { id: true, lifecycleStatus: true } })
      await Promise.all(components.map(d =>
        tx.deviceHistory.create({
          data: {
            deviceId:    d.id,
            fromStatus:  d.lifecycleStatus,
            toStatus:    d.lifecycleStatus,
            changedById: approverId,
            note: `[SET_HEALTH] Via set ${setCode} (${setTypeName}) — Health updated to ${req.healthStatus}` +
              (req.healthNote ? ` | Note: ${req.healthNote}` : ''),
          },
        })
      ))
    }
    // Always re-derive set health from the worst component after any change
    await syncSetHealth(tx, req.setId)
  }

  await tx.lifecycleRequest.update({
    where: { id: req.id },
    data: { status: 'approved', approvedById: approverId, approvedAt: now },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const { status, clientId, requestedById, toStep, deviceId, setId } = req.query
    const isGroundTeam = norm(req.user.role) === 'groundteam'

    const where = {
      ...(isGroundTeam ? { requestedById: req.user.userId } : {}),
      ...(status   ? { status }  : {}),
      ...(toStep   ? { toStep }  : {}),
      ...(deviceId ? { deviceId: parseInt(deviceId) } : {}),
      ...(setId    ? { setId:    parseInt(setId)    } : {}),
      ...(requestedById && !isGroundTeam ? { requestedById: parseInt(requestedById) } : {}),
    }

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

    const rows = await prisma.lifecycleRequest.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(await Promise.all(rows.map(shape)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /summary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const pending = await prisma.lifecycleRequest.findMany({
      where: { status: 'pending' },
      select: { id: true, requestedById: true, deviceId: true, setId: true, toStep: true },
    })
    const userIds = [...new Set(pending.map(r => r.requestedById))]
    const users   = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
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
// GET /device/:deviceId/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/device/:deviceId/history', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId)
    const requests = await prisma.lifecycleRequest.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(await Promise.all(requests.map(shape)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /set/:setId/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/set/:setId/history', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const setId = parseInt(req.params.setId)
    const requests = await prisma.lifecycleRequest.findMany({
      where: { setId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(await Promise.all(requests.map(shape)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /  — submit lifecycle request (multipart/form-data)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  requirePermission('LifecycleRequests', 'create'),
  // Accept up to 3 proof files in field 'proofFiles'
  multerUpload.array('proofFiles', 3),
  async (req, res) => {
    try {
      // Fields come from FormData as strings
      const deviceId     = req.body.deviceId     ? parseInt(req.body.deviceId)  : null
      const setId        = req.body.setId        ? parseInt(req.body.setId)     : null
      const toStep       = req.body.toStep
      const healthStatus = req.body.healthStatus ?? 'ok'
      const healthNote   = req.body.healthNote   ?? null
      const note         = req.body.note         ?? null
      const uploadedFiles = req.files ?? []

      // ── Basic validation ────────────────────────────────────────────────────
      if (!toStep) return res.status(400).json({ message: 'toStep is required' })
      if (!deviceId && !setId) return res.status(400).json({ message: 'deviceId or setId is required' })
      if (healthStatus !== 'ok' && !healthNote?.trim())
        return res.status(400).json({ message: 'healthNote is required when health is not OK' })

      // ── Proof file requirement check ────────────────────────────────────────
      const proofRequiredByStep   = PROOF_REQUIRED_STEPS.has(toStep)
      const proofRequiredByHealth = HEALTH_REQUIRES_PROOF.has(healthStatus)
      const proofRequired         = proofRequiredByStep || proofRequiredByHealth

      if (proofRequired && uploadedFiles.length === 0) {
        return res.status(400).json({
          message: proofRequiredByHealth
            ? `Proof files are required when health status is '${healthStatus}'. Please attach at least one image, video, or document.`
            : `Proof files are required for the '${toStep}' step. Please attach at least one image, video, or document.`,
        })
      }

      // ── SET-LOCK: block individual lifecycle steps on set-member devices ───────
      if (deviceId && toStep !== 'health_update') {
        const deviceCheck = await prisma.device.findUnique({
          where: { id: deviceId },
          select: { setId: true, code: true, deviceSet: { select: { code: true } } },
        })
        if (deviceCheck?.setId) {
          const isSuperAdmin = (req.user?.role ?? '').toLowerCase().replace(/[\s_-]/g, '') === 'superadmin'
          const override = req.body.superAdminOverride === 'true' || req.body.superAdminOverride === true
          if (!isSuperAdmin || !override) {
            const setLabel = deviceCheck.deviceSet?.code ?? `Set #${deviceCheck.setId}`
            return res.status(403).json({
              message: `Device ${deviceCheck.code} is part of ${setLabel}. Lifecycle steps must be performed on the set, not individual components. Only health updates are allowed individually.`,
              setId: deviceCheck.setId,
              setCode: deviceCheck.deviceSet?.code ?? null,
              locked: true,
            })
          }
          // SuperAdmin override — log warning
          console.warn(`[SET-LOCK OVERRIDE] SuperAdmin userId=${req.user.userId} submitting individual lifecycle request for device ${deviceCheck.code} (setId=${deviceCheck.setId}), toStep=${toStep}`)
        }
      }

      // ── Step gating ─────────────────────────────────────────────────────────
      let currentStep = 'available'
      if (deviceId) {
        const d = await prisma.device.findUnique({ where: { id: deviceId }, select: { lifecycleStatus: true } })
        if (!d) return res.status(404).json({ message: 'Device not found' })
        currentStep = d.lifecycleStatus
      } else {
        const s = await prisma.deviceSet.findUnique({ where: { id: setId }, select: { lifecycleStatus: true } })
        if (!s) return res.status(404).json({ message: 'Set not found' })
        currentStep = s.lifecycleStatus
      }

      const validNextSteps = VALID_NEXT_STEPS[currentStep] ?? []
      const isHealthUpdate = toStep === 'health_update'
      if (!isHealthUpdate && !validNextSteps.includes(toStep)) {
        return res.status(400).json({
          message: `Cannot move from '${currentStep}' to '${toStep}'. Valid: ${validNextSteps.join(', ') || 'none'}`,
        })
      }

      const isManager = ['manager', 'superadmin'].includes(norm(req.user.role))

      // ── Duplicate pending check ──────────────────────────────────────────────
      if (!isManager) {
        const existing = await prisma.lifecycleRequest.findFirst({
          where: {
            requestedById: req.user.userId,
            status: 'pending',
            ...(deviceId ? { deviceId } : { setId }),
          },
        })
        if (existing)
          return res.status(409).json({ message: 'You already have a pending request for this device/set.' })
      }

      // ── Process + save uploaded proof files ──────────────────────────────────
      const processedFiles = await Promise.all(
        uploadedFiles.map(f => processAndSaveFile(f, serverBaseUrl()))
      )

      const requestData = {
        requestedById: req.user.userId,
        fromStep:   currentStep,
        toStep,
        healthStatus,
        healthNote: healthNote?.trim()  || null,
        note:       note?.trim()        || null,
        deviceId,
        setId,
        status:     'pending',
      }

      if (isManager) {
        // ── Manager: create + auto-approve atomically + save proof files ────────
        const result = await prisma.$transaction(async (tx) => {
          const row = await tx.lifecycleRequest.create({ data: requestData })

          // Save proof files linked to this request
          if (processedFiles.length > 0) {
            await tx.proofFile.createMany({
              data: processedFiles.map((pf, i) => ({
                requestId:  row.id,
                fileName:   uploadedFiles[i].originalname,
                storedName: pf.storedName,
                fileType:   pf.fileType,
                mimeType:   uploadedFiles[i].mimetype,
                sizeKb:     pf.sizeKb,
                url:        pf.url,
                thumbUrl:   pf.thumbUrl ?? null,
              })),
            })
          }

          await applyApproval(tx, row, req.user.userId)
          await tx.lifecycleRequest.update({ where: { id: row.id }, data: { autoApproved: true } })
          return tx.lifecycleRequest.findUnique({ where: { id: row.id } })
        })

        return res.status(201).json({ ...(await shape(result)), autoApproved: true })
      }

      // ── GroundTeam: create as pending + save proof files ─────────────────────
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.lifecycleRequest.create({ data: requestData })

        if (processedFiles.length > 0) {
          await tx.proofFile.createMany({
            data: processedFiles.map((pf, i) => ({
              requestId:  created.id,
              fileName:   uploadedFiles[i].originalname,
              storedName: pf.storedName,
              fileType:   pf.fileType,
              mimeType:   uploadedFiles[i].mimetype,
              sizeKb:     pf.sizeKb,
              url:        pf.url,
              thumbUrl:   pf.thumbUrl ?? null,
            })),
          })
        }
        return created
      })

      // Notify managers (DB notification + SSE broadcast)
      const managers = await prisma.user.findMany({
        where: { role: { name: { in: ['MANAGER', 'SUPER_ADMIN'] } } },
        select: { id: true },
      })
      const meta = STEP_META[toStep]
      await Promise.all(managers.map(m =>
        notify(m.id,
          `${meta?.emoji ?? '📋'} New ${meta?.label ?? toStep} Request`,
          `${req.user.name ?? 'Ground team'} submitted a request for ${deviceId ? `device #${deviceId}` : `set #${setId}`}` +
          (processedFiles.length > 0 ? ` (${processedFiles.length} proof file${processedFiles.length > 1 ? 's' : ''} attached)` : ''),
          row.id)
      ))

      // SSE — push instant pop-up to all connected managers/admins
      const shaped = await shape(row)
      await broadcastToManagers({
        id:              shaped.id,
        toStep:          shaped.toStep,
        stepLabel:       shaped.stepLabel,
        deviceCode:      shaped.deviceCode,
        setCode:         shaped.setCode,
        deviceType:      shaped.deviceType,
        requestedByName: shaped.requestedByName,
        note:            shaped.note,
        healthStatus:    shaped.healthStatus,
        createdAt:       shaped.createdAt,
        proofCount:      processedFiles.length,
      })

      res.status(201).json(shaped)
    } catch (err) {
      // Multer file size / type errors come through here
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 50 MB per file.' })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Maximum 3 files allowed.' })
      }
      res.status(500).json({ error: err.message })
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// GET /device/:deviceId/pending
// GET /set/:setId/pending
// ─────────────────────────────────────────────────────────────────────────────
router.get('/device/:deviceId/pending', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId)
    const row = await prisma.lifecycleRequest.findFirst({ where: { deviceId, status: 'pending' }, orderBy: { createdAt: 'desc' } })
    if (!row) return res.json(null)
    res.json(await shape(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/set/:setId/pending', requirePermission('LifecycleRequests', 'read'), async (req, res) => {
  try {
    const setId = parseInt(req.params.setId)
    const row = await prisma.lifecycleRequest.findFirst({ where: { setId, status: 'pending' }, orderBy: { createdAt: 'desc' } })
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

    await prisma.$transaction(async (tx) => { await applyApproval(tx, request, req.user.userId) })

    const meta = STEP_META[request.toStep]
    await notify(request.requestedById, `${meta?.emoji ?? '✅'} Request Approved`,
      `Your ${meta?.label ?? request.toStep} request has been approved by ${req.user.name ?? 'Admin'}`, id)

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

    const meta = STEP_META[request.toStep]
    await notify(request.requestedById, `❌ Request Rejected`,
      `Your ${meta?.label ?? request.toStep} request was rejected: ${rejectionNote.trim()}`, id)

    res.json(await shape(updated))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:id  — Withdraw a pending request
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requirePermission('LifecycleRequests', 'create'), async (req, res) => {
  try {
    const id        = parseInt(req.params.id)
    const isManager = ['manager', 'superadmin'].includes(norm(req.user.role))

    const request = await prisma.lifecycleRequest.findUnique({ where: { id } })
    if (!request)                     return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be withdrawn' })
    if (!isManager && request.requestedById !== req.user.userId)
      return res.status(403).json({ message: 'You can only withdraw your own requests' })

    await prisma.$transaction(async (tx) => {
      if (request.deviceId) {
        await tx.device.update({ where: { id: request.deviceId }, data: { lifecycleStatus: request.fromStep, updatedAt: new Date() } })
        await tx.deviceHistory.create({
          data: { deviceId: request.deviceId, fromStatus: request.toStep, toStatus: request.fromStep, changedById: req.user.userId,
            note: `[LR#${id}] Request withdrawn — rolled back to ${request.fromStep}` },
        })
      }
      if (request.setId) {
        await tx.deviceSet.update({ where: { id: request.setId }, data: { lifecycleStatus: request.fromStep, updatedAt: new Date() } })
        await tx.device.updateMany({ where: { setId: request.setId }, data: { lifecycleStatus: request.fromStep, updatedAt: new Date() } })
      }
      // ProofFiles are deleted via CASCADE when request is deleted
      await tx.lifecycleRequest.delete({ where: { id } })
    })

    res.json({ message: 'Request withdrawn successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router