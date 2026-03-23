/**
 * backend/routes/users.js
 * ────────────────────────
 * SuperAdmin-only user management (NO EMAIL SENDING)
 *
 * Changes:
 *  - CREATE: Generates temp password, returns it in response (no email)
 *  - UPDATE: Password changes not allowed here
 *  - POST /:id/reset-password: Generates new temp password, returns it (no email)
 */

import express        from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt         from 'bcryptjs'
import authMiddleware, { isSuperAdmin } from '../middleware/auth.js'

const router = express.Router()
const prisma  = new PrismaClient()

router.use(authMiddleware, isSuperAdmin)

// ── Generate a random readable temp password ──────────────────────────────────
// Format: 3 uppercase + 3 digits + 3 lowercase + 1 symbol = 10 chars
const generateTempPassword = () => {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const symbols = '@#$!'
  const rand    = (str) => str[Math.floor(Math.random() * str.length)]

  const parts = [
    rand(upper), rand(upper), rand(upper),
    rand(digits), rand(digits), rand(digits),
    rand(lower), rand(lower), rand(lower),
    rand(symbols),
  ]
  // Shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]]
  }
  return parts.join('')
}

// ── GET all users ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(
      users.map((u) => ({
        id:                 u.id,
        name:               u.name,
        email:              u.email,
        role:               u.role.name,
        status:             u.status,
        createdAt:          u.createdAt,
        mustChangePassword: u.mustChangePassword,
        passwordChangedAt:  u.passwordChangedAt,
        accountLockedUntil: u.accountLockedUntil,
        failedLoginAttempts: u.failedLoginAttempts,
      }))
    )
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── CREATE user ───────────────────────────────────────────────────────────────
// Password is generated and RETURNED in response (SuperAdmin must share manually)
router.post('/', async (req, res) => {
  const { name, email, role: roleName, status = 'Active' } = req.body

  if (!name || !email || !roleName)
    return res.status(400).json({ message: 'name, email, and role are required' })

  try {
    const role = await prisma.role.findFirst({
      where: { name: { equals: roleName, mode: 'insensitive' } },
    })
    if (!role) return res.status(400).json({ message: `Role '${roleName}' not found` })

    const tempPassword = generateTempPassword()
    const hashed       = await bcrypt.hash(tempPassword, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email:              email.toLowerCase().trim(),
        password:           hashed,
        roleId:             role.id,
        status,
        mustChangePassword: true,
        failedLoginAttempts: 0,
      },
      include: { role: true },
    })

    // Return temp password in response (SuperAdmin sees it ONCE)
    res.status(201).json({
      id:                 user.id,
      name:               user.name,
      email:              user.email,
      role:               user.role.name,
      status:             user.status,
      createdAt:          user.createdAt,
      mustChangePassword: user.mustChangePassword,
      tempPassword:       tempPassword, // ← SuperAdmin must copy this!
    })
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Email already in use' })
    res.status(500).json({ error: err.message })
  }
})

// ── UPDATE user ───────────────────────────────────────────────────────────────
// Password changes are intentionally NOT allowed here
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { name, email, role: roleName, status } = req.body

  try {
    const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } })
    if (!existing) return res.status(404).json({ message: 'User not found' })

    // Prevent demoting the last SuperAdmin
    const normExisting = existing.role.name.toLowerCase().replace(/[\s_-]/g, '')
    const normNew      = roleName?.toLowerCase().replace(/[\s_-]/g, '')
    if (normExisting === 'superadmin' && normNew !== 'superadmin') {
      const count = await prisma.user.count({
        where: { role: { name: { equals: 'SuperAdmin', mode: 'insensitive' } } },
      })
      if (count <= 1)
        return res.status(400).json({ message: 'Cannot demote the last SuperAdmin' })
    }

    const role = await prisma.role.findFirst({
      where: { name: { equals: roleName, mode: 'insensitive' } },
    })
    if (!role) return res.status(400).json({ message: `Role '${roleName}' not found` })

    const updated = await prisma.user.update({
      where: { id },
      data: { name, email: email?.toLowerCase().trim(), roleId: role.id, status },
      include: { role: true },
    })

    res.json({
      id:     updated.id,
      name:   updated.name,
      email:  updated.email,
      role:   updated.role.name,
      status: updated.status,
      mustChangePassword: updated.mustChangePassword,
    })
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Email already in use' })
    res.status(500).json({ error: err.message })
  }
})

// ── POST /:id/reset-password ──────────────────────────────────────────────────
// SuperAdmin triggers a password reset for any user.
// Generates a new temp password and RETURNS it (SuperAdmin must share manually)
router.post('/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const tempPassword = generateTempPassword()
    const hashed       = await bcrypt.hash(tempPassword, 10)

    await prisma.user.update({
      where: { id },
      data: {
        password:            hashed,
        mustChangePassword:  true,
        passwordChangedAt:   null,
        failedLoginAttempts: 0,
        accountLockedUntil:  null,
      },
    })

    // Return temp password in response (SuperAdmin sees it ONCE)
    res.json({ 
      message: `Password reset for ${user.name}`,
      tempPassword: tempPassword, // ← SuperAdmin must copy this!
      email: user.email,
      name: user.name,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE user ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const normRole = user.role.name.toLowerCase().replace(/[\s_-]/g, '')
    if (normRole === 'superadmin')
      return res.status(400).json({ message: 'Cannot delete a SuperAdmin account' })

    if (id === req.user?.userId)
      return res.status(400).json({ message: 'You cannot delete your own account' })

    await prisma.user.delete({ where: { id } })
    res.json({ message: 'User deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router