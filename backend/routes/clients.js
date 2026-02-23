import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'
import { requirePermission } from '../middleware/Permissions.js'

const router = express.Router()
const prisma = new PrismaClient()

const INCLUDE_CLIENT = {
  devices: { include: { deviceSet: true }, orderBy: { updatedAt: 'desc' } },
  deviceSets: { orderBy: { updatedAt: 'desc' } },
}

router.get('/', authMiddleware, requirePermission('Clients', 'read'), async (req, res) => {
  try {
    const clients = await prisma.client.findMany({ include: INCLUDE_CLIENT, orderBy: { createdAt: 'desc' } })
    res.json(clients)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', authMiddleware, requirePermission('Clients', 'read'), async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: parseInt(req.params.id) }, include: INCLUDE_CLIENT })
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const assignmentHistory = await prisma.assignmentRequest.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } })
    res.json({ ...client, assignmentHistory })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', authMiddleware, requirePermission('Clients', 'create'), async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body
    if (!name || !phone || !email) return res.status(400).json({ error: 'name, phone, and email are required' })
    const client = await prisma.client.create({
      data: { name: name.trim(), phone: phone.trim(), email: email.trim(), company: company?.trim() || null, address: address?.trim() || null, notes: notes?.trim() || null },
      include: INCLUDE_CLIENT,
    })
    res.status(201).json(client)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'A client with this email already exists' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', authMiddleware, requirePermission('Clients', 'update'), async (req, res) => {
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
    const client = await prisma.client.update({ where: { id }, data, include: INCLUDE_CLIENT })
    res.json(client)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', authMiddleware, requirePermission('Clients', 'delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.device.updateMany({ where: { clientId: id }, data: { clientId: null, lifecycleStatus: 'warehouse', state: null, district: null, pinpoint: null } })
    await prisma.deviceSet.updateMany({ where: { clientId: id }, data: { clientId: null, lifecycleStatus: 'warehouse' } })
    await prisma.client.delete({ where: { id } })
    res.json({ message: 'Client deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/history', authMiddleware, requirePermission('Clients', 'read'), async (req, res) => {
  try {
    const history = await prisma.assignmentRequest.findMany({ where: { clientId: parseInt(req.params.id) }, orderBy: { createdAt: 'desc' } })
    res.json(history)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router