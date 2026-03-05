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
const serverBaseUrl = () =>
  process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 5000}`

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

  if (req.toStep === 'returned') {
    update.clientId  = null
    update.deployedAt = null
  }
  if (req.toStep === 'assigning' && req.note) {
    try {
      const meta = JSON.parse(req.note)
      if (meta.clientId) update.clientId = parseInt(meta.clientId)
    } catch (_) {}
  }
  if (req.toStep === 'active') update.deployedAt = now

  if (req.deviceId) {
    const cur = await tx.device.findUnique({
      where: { id: req.deviceId },
      select: { lifecycleStatus: true, healthStatus: true, setId: true },
    })
    await tx.device.update({ where: { id: req.deviceId }, data: update })
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
    if (cur?.setId) await syncSetHealth(tx, cur.setId)
  }

  if (req.setId) {
    const setUpdate = {
      lifecycleStatus: req.toStep,
      healthStatus:    req.healthStatus,
      updatedAt:       now,
    }
    if (req.toStep === 'returned') { setUpdate.clientId = null }
    if (req.toStep === 'assigning' && req.note) {
      try { const m = JSON.parse(req.note); if (m.clientId) setUpdate.clientId = parseInt(m.clientId) } catch (_) {}
    }
    await tx.deviceSet.update({ where: { id: req.setId }, data: setUpdate })

    const updatedSet = await tx.deviceSet.findUnique({
      where: { id: req.setId },
      select: { clientId: true, state: true, district: true, location: true },
    })
    const memberUpdate = { lifecycleStatus: req.toStep, updatedAt: now }
    if (updatedSet) {
      memberUpdate.clientId = updatedSet.clientId ?? null
      if (['active', 'installed', 'received', 'under_maintenance'].includes(req.toStep)) {
        memberUpdate.state    = updatedSet.state    ?? null
        memberUpdate.district = updatedSet.district ?? null
        memberUpdate.location = updatedSet.location ?? null
      } else if (req.toStep === 'returned') {
        memberUpdate.clientId = null
        memberUpdate.state    = null
        memberUpdate.district = null
        memberUpdate.location = null
      }
    }
    await tx.device.updateMany({ where: { setId: req.setId }, data: memberUpdate })
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
        where: { role: { name: { in: ['Manager', 'SuperAdmin'] } } },
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