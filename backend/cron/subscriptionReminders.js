/**
 * backend/cron/subscriptionReminders.js
 * ──────────────────────────────────────
 * Runs once daily at 09:00 server time.
 * Checks Device and DeviceSet records for upcoming/expired subscriptionEndDate.
 * Sends in-app notifications + SSE push to all managers/admins.
 * Logs each reminder in SubscriptionReminder to prevent duplicate sends.
 *
 * Reminder windows:
 *   "7day"   — subscriptionEndDate is exactly 7 days from today
 *   "2day"   — subscriptionEndDate is exactly 2 days from today
 *   "expired" — subscriptionEndDate is today (or in the past and not yet notified)
 */

import { PrismaClient } from '@prisma/client'
import { broadcastToManagers } from '../routes/notifications.js'

const prisma = new PrismaClient()

// ── helpers ────────────────────────────────────────────────────────────────────
const startOf = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
const endOf   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x }

function targetDate(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d
}

async function notifyManagers(title, body, meta) {
  try {
    const managers = await prisma.user.findMany({
      where: { role: { name: { in: ['Manager', 'SuperAdmin'] } } },
      select: { id: true },
    })
    await Promise.all(managers.map(m =>
      prisma.notification.create({ data: { userId: m.id, title, body } }).catch(() => {})
    ))
    // SSE push
    await broadcastToManagers({ _type: 'subscription_reminder', ...meta, title, body })
  } catch (_) {}
}

async function alreadySent(deviceId, setId, reminderType) {
  try {
    const where = reminderType === '7day' || reminderType === '2day'
      ? (deviceId ? { deviceId, reminderType } : { setId, reminderType })
      : (deviceId ? { deviceId, reminderType } : { setId, reminderType })
    const existing = await prisma.subscriptionReminder.findFirst({ where })
    return !!existing
  } catch { return false }
}

async function markSent(deviceId, setId, reminderType) {
  try {
    await prisma.subscriptionReminder.create({
      data: { deviceId: deviceId ?? null, setId: setId ?? null, reminderType },
    })
  } catch (_) {} // unique constraint will silently prevent duplicates
}

// ── main check ─────────────────────────────────────────────────────────────────
export async function runSubscriptionCheck() {
  console.log('[SubscriptionReminder] Running check at', new Date().toISOString())

  const windows = [
    { label: '7day',    days: 7,  emoji: '⚠️',  urgency: 'in 7 days'  },
    { label: '2day',    days: 2,  emoji: '🔴',  urgency: 'in 2 days'  },
    { label: 'expired', days: 0,  emoji: '🚨',  urgency: 'TODAY'      },
  ]

  for (const { label, days, emoji, urgency } of windows) {
    const from = startOf(targetDate(days))
    const to   = endOf(targetDate(days))

    // ── Devices ──────────────────────────────────────────────────────────────
    const devices = await prisma.device.findMany({
      where: {
        subscriptionEndDate: { gte: from, lte: to },
        lifecycleStatus:     { notIn: ['available', 'returned'] },
      },
      include: { client: { select: { name: true } } },
    })

    for (const d of devices) {
      if (await alreadySent(d.id, null, label)) continue
      const title = `${emoji} Subscription Expiring ${urgency}`
      const body  = `Device ${d.code}${d.client ? ` (${d.client.name})` : ''} — subscription ends ${d.subscriptionEndDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`
      await notifyManagers(title, body, {
        deviceId: d.id, deviceCode: d.code,
        clientName: d.client?.name ?? null,
        subscriptionEndDate: d.subscriptionEndDate,
        reminderType: label,
      })
      await markSent(d.id, null, label)
      console.log(`[SubscriptionReminder] ${label} sent for device ${d.code}`)
    }

    // ── Device Sets ───────────────────────────────────────────────────────────
    const sets = await prisma.deviceSet.findMany({
      where: {
        subscriptionEndDate: { gte: from, lte: to },
        lifecycleStatus:     { notIn: ['available', 'returned'] },
      },
      include: { client: { select: { name: true } } },
    })

    for (const s of sets) {
      if (await alreadySent(null, s.id, label)) continue
      const title = `${emoji} Subscription Expiring ${urgency}`
      const body  = `Set ${s.code}${s.client ? ` (${s.client.name})` : ''} — subscription ends ${s.subscriptionEndDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`
      await notifyManagers(title, body, {
        setId: s.id, setCode: s.code,
        clientName: s.client?.name ?? null,
        subscriptionEndDate: s.subscriptionEndDate,
        reminderType: label,
      })
      await markSent(null, s.id, label)
      console.log(`[SubscriptionReminder] ${label} sent for set ${s.code}`)
    }
  }

  console.log('[SubscriptionReminder] Check complete')
}

// ── scheduler — runs daily at 09:00 ──────────────────────────────────────────
export function startSubscriptionCron() {
  const msUntil9am = () => {
    const now  = new Date()
    const next = new Date()
    next.setHours(9, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next - now
  }

  const scheduleNext = () => {
    const delay = msUntil9am()
    console.log(`[SubscriptionReminder] Next run in ${Math.round(delay / 60000)} minutes`)
    setTimeout(async () => {
      await runSubscriptionCheck().catch(console.error)
      // Schedule next day
      setInterval(async () => {
        await runSubscriptionCheck().catch(console.error)
      }, 24 * 60 * 60 * 1000)
    }, delay)
  }

  scheduleNext()
}