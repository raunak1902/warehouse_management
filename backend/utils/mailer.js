/**
 * backend/utils/mailer.js
 * ────────────────────────
 * Resend HTTP API for sending emails — works on Render free tier.
 * Nodemailer SMTP is blocked by Render's firewall.
 *
 * Required env var on Render:
 *   RESEND_API_KEY = re_xxxxxxxxxxxx  (from resend.com)
 *
 * From address: uses Resend's shared domain for testing.
 * For production: verify your own domain on resend.com and update FROM_ADDRESS.
 */

import { Resend } from 'resend'

const FROM_ADDRESS = process.env.RESEND_FROM || 'EDSignage <onboarding@resend.dev>'

const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

// ── Send welcome email with temporary password ────────────────────────────────
export async function sendWelcomeEmail({ to, name, tempPassword }) {
  const resend = getResend()
  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: 'Your EDSignage Account Has Been Created',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#1e40af;margin-bottom:8px;">Welcome to EDSignage, ${name}!</h2>
        <p style="color:#374151;margin-bottom:24px;">Your account has been created. Use the temporary password below to log in.</p>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
          <p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:4px;color:#111827;font-family:monospace;">${tempPassword}</p>
        </div>
        <p style="color:#374151;margin-bottom:8px;">After logging in, you will be asked to set a new password immediately.</p>
        <p style="color:#6b7280;font-size:13px;">If you did not expect this email, please contact your administrator.</p>
      </div>
    `,
  })
}

// ── Send password reset email with temporary password ─────────────────────────
export async function sendPasswordResetEmail({ to, name, tempPassword }) {
  const resend = getResend()
  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: 'Your EDSignage Password Has Been Reset',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#dc2626;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#374151;margin-bottom:24px;">Hi ${name}, your password has been reset by an administrator. Use the temporary password below to log in.</p>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
          <p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:4px;color:#111827;font-family:monospace;">${tempPassword}</p>
        </div>
        <p style="color:#374151;margin-bottom:8px;">You will be required to set a new password after logging in.</p>
        <p style="color:#6b7280;font-size:13px;">If you did not request this, contact your administrator immediately.</p>
      </div>
    `,
  })
}

// ── Send OTP for forgot-password flow ─────────────────────────────────────────
export async function sendOtpEmail({ to, name, otp }) {
  const resend = getResend()
  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: 'Your EDSignage Password Reset OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#1e40af;margin-bottom:8px;">Password Reset OTP</h2>
        <p style="color:#374151;margin-bottom:24px;">Hi ${name}, use the OTP below to reset your password. Valid for <strong>10 minutes</strong>.</p>
        <div style="background:#fff;border:2px solid #3b82f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">One-Time Password</p>
          <p style="margin:0;font-size:40px;font-weight:bold;letter-spacing:8px;color:#1e40af;font-family:monospace;">${otp}</p>
        </div>
        <p style="color:#374151;margin-bottom:8px;">This OTP expires in 10 minutes and can only be used once.</p>
        <p style="color:#6b7280;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}