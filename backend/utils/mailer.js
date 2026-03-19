/**
 * backend/utils/mailer.js
 * ────────────────────────
 * Nodemailer + Gmail using port 465 (SSL) which works on Render.
 *
 * Required env vars:
 *   GMAIL_USER         = youremail@gmail.com
 *   GMAIL_APP_PASSWORD = xxxx xxxx xxxx xxxx
 */

import nodemailer from 'nodemailer'

const createTransport = () =>
  nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ''),
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  })

export async function sendWelcomeEmail({ to, name, tempPassword }) {
  const transporter = createTransport()
  await transporter.sendMail({
    from: `"EDSignage" <${process.env.GMAIL_USER}>`,
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

export async function sendPasswordResetEmail({ to, name, tempPassword }) {
  const transporter = createTransport()
  await transporter.sendMail({
    from: `"EDSignage" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your EDSignage Password Has Been Reset',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#dc2626;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#374151;margin-bottom:24px;">Hi ${name}, your password has been reset by an administrator.</p>
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

export async function sendOtpEmail({ to, name, otp }) {
  const transporter = createTransport()
  await transporter.sendMail({
    from: `"EDSignage" <${process.env.GMAIL_USER}>`,
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