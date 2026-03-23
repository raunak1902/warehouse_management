/**
 * backend/routes/auth.js
 * ───────────────────────
 * Password change endpoint (NO EMAIL - OTP/forgot password routes removed)
 *
 *  POST /api/auth/change-password   — logged-in user changes own password
 */

import express        from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt         from 'bcryptjs'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma  = new PrismaClient()

// ── helpers ───────────────────────────────────────────────────────────────────
const validatePassword = (pw) => {
  if (!pw || pw.length < 8)
    return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw))
    return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(pw))
    return 'Password must contain at least one lowercase letter'
  if (!/[0-9]/.test(pw))
    return 'Password must contain at least one number'
  if (!/[@#$!%*?&]/.test(pw))
    return 'Password must contain at least one special character (@#$!%*?&)'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// Logged-in user changes their own password — must provide current password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ message: 'All fields are required' })

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: 'New passwords do not match' })

    const pwError = validatePassword(newPassword)
    if (pwError) return res.status(400).json({ message: pwError })

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch)
      return res.status(400).json({ message: 'Current password is incorrect' })

    // Check if new password is same as current password
    if (await bcrypt.compare(newPassword, user.password))
      return res.status(400).json({ message: 'New password must be different from the current password' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        password:           hashed,
        mustChangePassword: false,
        passwordChangedAt:  new Date(),
      },
    })

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router