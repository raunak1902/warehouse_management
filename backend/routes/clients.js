import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'
import { requirePermission } from '../middleware/Permissions.js'

const router = express.Router()
const prisma  = new PrismaClient()

// ── Lifecycle statuses that mean a device/set is "assigned" to a client ───────
// Range: assigning → ... → return_transit  (everything before "returned")
// "returned", "available", "warehouse", "lost" are NOT assigned.
const ASSIGNED_STATUSES = new Set([
  'assigning',
  'ready_to_deploy',
  'in_transit',
  'received',
  'installed',
  'active',
  'under_maintenance',
  'return_initiated',
  'return_transit',
])

const INCLUDE_CLIENT = {
  devices: {
    where: { setId: null },
    orderBy: { updatedAt: 'desc' },
  },
  deviceSets: {
    include: {
      components: { orderBy: { updatedAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  },
}

const STEP_LABELS = {
  assigning:         'Assigning to Client',
  ready_to_deploy:   'Ready to Deploy',
  in_transit:        'In Transit',
  received:          'Received at Site',
  installed:         'Installed',
  active:            'Active / Live',
  under_maintenance: 'Under Maintenance',
  return_initiated:  'Return Initiated',
  return_transit:    'Return In Transit',
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /  — active clients only (default) | ?archived=true for archived
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, requirePermission('Clients', 'read'), async (req, res) => {
  try {
    const showArchived = req.query.archived === 'true'
    const clients = await prisma.client.findMany({
      where: { isArchived: showArchived },
      include: INCLUDE_CLIENT,
      orderBy: { createdAt: 'desc' },
    })
    res.json(clients)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, requirePermission('Clients', 'read'), async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(req.params.id) },
      include: INCLUDE_CLIENT,
    })
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const assignmentHistory = await prisma.assignmentRequest.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ ...client, assignmentHistory })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, requirePermission('Clients', 'create'), async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body
    if (!name || !phone || !email)
      return res.status(400).json({ error: 'name, phone, and email are required' })
    const client = await prisma.client.create({
      data: {
        name:    name.trim(),
        phone:   phone.trim(),
        email:   email.trim(),
        company: company?.trim()  || null,
        address: address?.trim()  || null,
        notes:   notes?.trim()    || null,
      },
      include: INCLUDE_CLIENT,
    })
    res.status(201).json(client)
  } catch (err) {
    if (err.code === 'P2002')
      return res.status(400).json({ error: 'A client with this email already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, requirePermission('Clients', 'update'), async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body
    const id = parseInt(req.params.id)
    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Client not found' })
    const data = {}
    if (name    !== undefined) data.name    = name.trim()
    if (phone   !== undefined) data.phone   = phone.trim()
    if (email   !== undefined) data.email   = email.trim()
    if (company !== undefined) data.company = company?.trim() || null
    if (address !== undefined) data.address = address?.trim() || null
    if (notes   !== undefined) data.notes   = notes?.trim()   || null
    const client = await prisma.client.update({ where: { id }, data, include: INCLUDE_CLIENT })
    res.json(client)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:id  — SOFT DELETE with active-assignment guard
//
// Rules:
//   • If ANY device or set linked to this client has an ASSIGNED status
//     (assigning → return_transit) → block with 409, list exactly what's assigned
//   • If no active assignments → soft-delete: set isArchived=true, preserve all data
//   • Hard delete is NEVER performed — all history stays in DB forever
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, requirePermission('Clients', 'delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        devices: {
          where: { setId: null }, // standalone only — sets handled separately
          select: { id: true, code: true, type: true, lifecycleStatus: true },
        },
        deviceSets: {
          select: { id: true, code: true, setTypeName: true, lifecycleStatus: true },
        },
      },
    })
    if (!client) return res.status(404).json({ error: 'Client not found' })

    // ── Check for active assignments ──────────────────────────────────────────
    const activeDevices = client.devices.filter(d => ASSIGNED_STATUSES.has(d.lifecycleStatus))
    const activeSets    = client.deviceSets.filter(s => ASSIGNED_STATUSES.has(s.lifecycleStatus))

    if (activeDevices.length > 0 || activeSets.length > 0) {
      // Build a detailed list for the frontend to display
      const assignedItems = [
        ...activeDevices.map(d => ({
          type:   'device',
          code:   d.code,
          kind:   d.type,
          status: STEP_LABELS[d.lifecycleStatus] ?? d.lifecycleStatus,
        })),
        ...activeSets.map(s => ({
          type:   'set',
          code:   s.code,
          kind:   s.setTypeName,
          status: STEP_LABELS[s.lifecycleStatus] ?? s.lifecycleStatus,
        })),
      ]

      return res.status(409).json({
        error:         'CLIENT_HAS_ACTIVE_ASSIGNMENTS',
        message:       `Cannot archive "${client.name}" — ${assignedItems.length} item${assignedItems.length !== 1 ? 's are' : ' is'} currently assigned. Complete or return all assignments first.`,
        assignedItems, // full list for the UI to render
        counts: {
          devices: activeDevices.length,
          sets:    activeSets.length,
        },
      })
    }

    // ── No active assignments — safe to soft-delete ───────────────────────────
    await prisma.client.update({
      where: { id },
      data: {
        isArchived:    true,
        archivedAt:    new Date(),
        archivedById:  req.user?.userId ?? null,
      },
    })

    res.json({ message: `Client "${client.name}" has been archived successfully.` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/restore  — reactivate an archived client
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/restore', authMiddleware, requirePermission('Clients', 'delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client)            return res.status(404).json({ error: 'Client not found' })
    if (!client.isArchived) return res.status(400).json({ error: 'Client is not archived' })

    const restored = await prisma.client.update({
      where: { id },
      data: {
        isArchived:   false,
        archivedAt:   null,
        archivedById: null,
      },
      include: INCLUDE_CLIENT,
    })
    res.json(restored)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:id/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/history', authMiddleware, requirePermission('Clients', 'read'), async (req, res) => {
  try {
    const history = await prisma.assignmentRequest.findMany({
      where: { clientId: parseInt(req.params.id) },
      orderBy: { createdAt: 'desc' },
    })
    res.json(history)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router