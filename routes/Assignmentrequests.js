import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'
import { requirePermission } from '../middleware/Permissions.js'

const router = express.Router()
const prisma = new PrismaClient()

const computeReturnDate = ({ returnType, returnDays, returnMonths, returnDate }) => {
  const now = new Date()
  if (returnType === 'days' && returnDays) { const d = new Date(now); d.setDate(d.getDate() + parseInt(returnDays)); return d }
  if (returnType === 'months' && returnMonths) { const d = new Date(now); d.setMonth(d.getMonth() + parseInt(returnMonths)); return d }
  if (returnType === 'date' && returnDate) return new Date(returnDate)
  return null
}

router.get('/', authMiddleware, requirePermission('AssignmentRequests', 'read'), async (req, res) => {
  try {
    const { status, clientId } = req.query
    const where = {}
    if (status) where.status = status
    if (clientId) where.clientId = parseInt(clientId)
    const requests = await prisma.assignmentRequest.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', authMiddleware, requirePermission('AssignmentRequests', 'create'), async (req, res) => {
  try {
    const { requestType, deviceId, setId, clientId, healthStatus, healthComment, returnType, returnDays, returnMonths, returnDate } = req.body
    if (!requestType || !clientId) return res.status(400).json({ error: 'requestType and clientId are required' })
    if (requestType === 'device' && !deviceId) return res.status(400).json({ error: 'deviceId required' })
    if (requestType === 'set' && !setId) return res.status(400).json({ error: 'setId required' })
    if (!['ok', 'repair', 'damage'].includes(healthStatus)) return res.status(400).json({ error: 'Invalid healthStatus' })
    if ((healthStatus === 'repair' || healthStatus === 'damage') && !healthComment?.trim()) return res.status(400).json({ error: 'healthComment required' })
    if (!returnType || !['days', 'months', 'date'].includes(returnType)) return res.status(400).json({ error: 'Invalid returnType' })
    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } })
    if (!client) return res.status(400).json({ error: 'Client not found' })
    const computedReturnDate = computeReturnDate({ returnType, returnDays, returnMonths, returnDate })
    const request = await prisma.assignmentRequest.create({
      data: {
        requestType, deviceId: deviceId ? parseInt(deviceId) : null, setId: setId ? parseInt(setId) : null,
        clientId: parseInt(clientId), healthStatus: healthStatus || 'ok', healthComment: healthComment?.trim() || null,
        returnType, returnDays: returnDays ? parseInt(returnDays) : null, returnMonths: returnMonths ? parseInt(returnMonths) : null,
        returnDate: returnDate ? new Date(returnDate) : null, computedReturnDate, status: 'pending', requestedBy: req.user?.userId || null,
      },
    })
    res.status(201).json(request)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/approve', authMiddleware, requirePermission('AssignmentRequests', 'approve'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const request = await prisma.assignmentRequest.findUnique({ where: { id } })
    if (!request) return res.status(404).json({ error: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' })
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.assignmentRequest.update({ where: { id }, data: { status: 'approved', approvedBy: req.user?.userId || null, approvedAt: new Date() } })
      if (request.requestType === 'device' && request.deviceId) {
        await tx.device.update({ where: { id: request.deviceId }, data: { clientId: request.clientId, lifecycleStatus: 'assigning', healthStatus: request.healthStatus } })
      } else if (request.requestType === 'set' && request.setId) {
        await tx.deviceSet.update({ where: { id: request.setId }, data: { clientId: request.clientId, lifecycleStatus: 'assigning', healthStatus: request.healthStatus } })
        await tx.device.updateMany({ where: { setId: request.setId }, data: { clientId: request.clientId, lifecycleStatus: 'assigning' } })
      }
      return updated
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/reject', authMiddleware, requirePermission('AssignmentRequests', 'reject'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.assignmentRequest.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Request not found' })
    const updated = await prisma.assignmentRequest.update({ where: { id }, data: { status: 'rejected' } })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/device/:deviceId', authMiddleware, requirePermission('AssignmentRequests', 'read'), async (req, res) => {
  try {
    const requests = await prisma.assignmentRequest.findMany({ where: { deviceId: parseInt(req.params.deviceId) }, orderBy: { createdAt: 'desc' } })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/set/:setId', authMiddleware, requirePermission('AssignmentRequests', 'read'), async (req, res) => {
  try {
    const requests = await prisma.assignmentRequest.findMany({ where: { setId: parseInt(req.params.setId) }, orderBy: { createdAt: 'desc' } })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router