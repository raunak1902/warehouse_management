/**
 * backend/routes/auth.js
 * ───────────────────────
 * Password management endpoints:
 *
 *  POST /api/auth/change-password   — logged-in user changes own password
 *  POST /api/auth/forgot-password   — sends OTP to email
 *  POST /api/auth/verify-otp        — validates OTP, returns reset token
 *  POST /api/auth/reset-password    — sets new password using reset token
 */

import express        from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt         from 'bcryptjs'
import crypto         from 'crypto'
import authMiddleware from '../middleware/auth.js'
import { sendOtpEmail } from '../utils/mailer.js'

const router = express.Router()
const prisma  = new PrismaClient()

const OTP_EXPIRY_MINUTES   = 10
const RESET_TOKEN_MINUTES  = 15

// ── helpers ───────────────────────────────────────────────────────────────────
const generateOtp        = () => String(Math.floor(100000 + Math.random() * 900000))
const generateResetToken = () => crypto.randomBytes(32).toString('hex')

const validatePassword = (pw) => {
  if (!pw || pw.length < 8)
    return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(pw))
    return 'Password must contain at least one letter'
  if (!/[0-9]/.test(pw))
    return 'Password must contain at least one number'
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Sends a 6-digit OTP to the user's registered email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Always return success — don't reveal whether email exists
    if (!user) {
      return res.json({ message: 'If that email is registered, an OTP has been sent.' })
    }

    if (user.status?.toLowerCase() === 'inactive') {
      return res.status(403).json({ message: 'This account is inactive. Contact your administrator.' })
    }

    const otp     = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const expiry  = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { otpHash, otpExpiresAt: expiry, otpResetToken: null, otpResetTokenExp: null },
    })

    await sendOtpEmail({ to: user.email, name: user.name, otp })

    res.json({ message: 'If that email is registered, an OTP has been sent.' })
  } catch (err) {
    console.error('[forgot-password]', err)
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Validates OTP — returns a short-lived reset token on success
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' })

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user || !user.otpHash || !user.otpExpiresAt)
      return res.status(400).json({ message: 'Invalid or expired OTP' })

    if (new Date() > user.otpExpiresAt)
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' })

    const isMatch = await bcrypt.compare(String(otp).trim(), user.otpHash)
    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' })

    // OTP is valid — issue a single-use reset token, clear OTP
    const resetToken    = generateResetToken()
    const resetTokenExp = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpHash:         null,
        otpExpiresAt:    null,
        otpResetToken:   resetToken,
        otpResetTokenExp: resetTokenExp,
      },
    })

    res.json({ resetToken, message: 'OTP verified. You may now reset your password.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// Sets a new password using the reset token from verify-otp
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body

    if (!email || !resetToken || !newPassword || !confirmPassword)
      return res.status(400).json({ message: 'All fields are required' })

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: 'Passwords do not match' })

    const pwError = validatePassword(newPassword)
    if (pwError) return res.status(400).json({ message: pwError })

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user || !user.otpResetToken || !user.otpResetTokenExp)
      return res.status(400).json({ message: 'Invalid or expired reset token. Please start over.' })

    if (new Date() > user.otpResetTokenExp)
      return res.status(400).json({ message: 'Reset token has expired. Please start over.' })

    if (user.otpResetToken !== resetToken)
      return res.status(400).json({ message: 'Invalid reset token. Please start over.' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password:           hashed,
        mustChangePassword: false,
        passwordChangedAt:  new Date(),
        otpResetToken:      null,
        otpResetTokenExp:   null,
      },
    })

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router