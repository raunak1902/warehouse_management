import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

// CHANGED: removed subscriptionStart/End from Client includes
// deviceSets relation preserved exactly
const INCLUDE_CLIENT = {
  devices: {
    include: { deviceSet: true },
    orderBy: { updatedAt: 'desc' },
  },
  deviceSets: {
    orderBy: { updatedAt: 'desc' },
  },
}

// ─── GET all clients ──────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: INCLUDE_CLIENT,
      orderBy: { createdAt: 'desc' },
    })
    res.json(clients)
  } catch (err) {
    console.error('Error fetching clients:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET single client ────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
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
    console.error('Error fetching client:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── CREATE client ────────────────────────────────────────────
// CHANGED: subscriptionStart and subscriptionEnd no longer accepted
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body

    if (!name || !phone || !email) {
      return res.status(400).json({ error: 'name, phone, and email are required' })
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        company: company?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        // subscriptionStart and subscriptionEnd removed
      },
      include: INCLUDE_CLIENT,
    })

    res.status(201).json(client)
  } catch (err) {
    console.error('Error creating client:', err)
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A client with this email already exists' })
    }
    res.status(500).json({ error: err.message })
  }
})

// ─── UPDATE client ────────────────────────────────────────────
// CHANGED: subscriptionStart and subscriptionEnd no longer accepted
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body
    const id = parseInt(req.params.id)

    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Client not found' })

    const data = {}
    if (name !== undefined)    data.name    = name.trim()
    if (phone !== undefined)   data.phone   = phone.trim()
    if (email !== undefined)   data.email   = email.trim()
    if (company !== undefined) data.company = company?.trim() || null
    if (address !== undefined) data.address = address?.trim() || null
    if (notes !== undefined)   data.notes   = notes?.trim() || null
    // subscriptionStart and subscriptionEnd intentionally excluded

    const client = await prisma.client.update({
      where: { id },
      data,
      include: INCLUDE_CLIENT,
    })

    res.json(client)
  } catch (err) {
    console.error('Error updating client:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── DELETE client ────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    // Unassign all devices first
    await prisma.device.updateMany({
      where: { clientId: id },
      data: { clientId: null, lifecycleStatus: 'warehouse', state: null, district: null, pinpoint: null },
    })

    // Unassign all sets
    await prisma.deviceSet.updateMany({
      where: { clientId: id },
      data: { clientId: null, lifecycleStatus: 'warehouse' },
    })

    await prisma.client.delete({ where: { id } })

    res.json({ message: 'Client deleted successfully' })
  } catch (err) {
    console.error('Error deleting client:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET client assignment history (unchanged) ────────────────
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const history = await prisma.assignmentRequest.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
    })
    res.json(history)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router