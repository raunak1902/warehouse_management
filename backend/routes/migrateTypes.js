/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         DEVICE TYPE MIGRATION — Backend Route                       ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  POST /api/devices/migrate-types                                    ║
 * ║                                                                      ║
 * ║  Auto-migrates all existing devices in the DB from legacy type      ║
 * ║  strings (e.g. "mediaBox", "stand", "a-stand", "custom-MBX")       ║
 * ║  to canonical Device Type IDs (e.g. "MB", "AST", "IST").           ║
 * ║                                                                      ║
 * ║  Safe to run multiple times (idempotent — already-canonical          ║
 * ║  devices are skipped).                                              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

// ─── CANONICAL TYPE DEFINITIONS (mirrors frontend deviceTypeRegistry.js) ──────
// Kept in sync manually. When you add a custom type in the UI, run migration again.
const BUILTIN_DEVICE_TYPES = [
  { id: 'TV',  codePrefix: 'TV',  aliases: ['tv', 'TV'] },
  { id: 'TAB', codePrefix: 'TAB', aliases: ['tablet', 'TAB', 'Tablet'] },
  { id: 'TTV', codePrefix: 'TTV', aliases: ['touch-tv', 'touchtv', 'TTV', 'Touch TV', 'touchscreen'] },
  { id: 'AST', codePrefix: 'ATV', aliases: ['stand', 'a-stand', 'astand', 'AST', 'ATV', 'A stand', 'A-Frame Stand', 'aframe', 'aframestand'] },
  { id: 'IST', codePrefix: 'ITV', aliases: ['istand', 'i-stand', 'IST', 'ITV', 'I stand', 'I-Frame Stand', 'iframe', 'iframestand'] },
  { id: 'TST', codePrefix: 'TST', aliases: ['tablet-stand', 'tabletstand', 'TST', 'Tablet Stand', 'fabrication', 'fab', 'tabstand'] },
  { id: 'MB',  codePrefix: 'MB',  aliases: ['mediaBox', 'MB', 'Media Box', 'media-box', 'mediabox', 'media', 'MBX', 'custom-MBX', 'custom-MB'] },
  { id: 'BAT', codePrefix: 'BAT', aliases: ['battery', 'BAT', 'Battery Pack', 'batterypack', 'batt', 'Battery'] },
]

/**
 * Resolve any legacy type string → canonical type ID.
 * Returns null if the type is already canonical or unknown.
 */
function resolveTypeId(typeString) {
  if (!typeString) return null

  const clean = typeString.toLowerCase().replace(/[\s_-]+/g, '')

  for (const type of BUILTIN_DEVICE_TYPES) {
    // Already canonical
    if (typeString === type.id) return null

    for (const alias of type.aliases) {
      if (alias.toLowerCase().replace(/[\s_-]+/g, '') === clean) {
        return type.id
      }
    }
  }

  // Handle legacy "custom-XXX" → try to find XXX as an id
  if (typeString.startsWith('custom-')) {
    const inner = typeString.replace('custom-', '').toUpperCase()
    const found = BUILTIN_DEVICE_TYPES.find(t => t.id === inner)
    if (found) return found.id
    // Unknown custom type — strip the "custom-" prefix and uppercase
    return inner
  }

  return null // Already fine or truly unknown
}

// ─── GET /migrate-types/preview ───────────────────────────────────────────────
// Shows what WOULD be migrated without making changes.
router.get('/preview', authMiddleware, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      select: { id: true, code: true, type: true },
      orderBy: { type: 'asc' },
    })

    const changes = []
    const alreadyCanonical = []
    const unknownTypes = []

    for (const device of devices) {
      const newType = resolveTypeId(device.type)
      if (newType === null) {
        // Check if it's already a known canonical ID
        const isCanonical = BUILTIN_DEVICE_TYPES.some(t => t.id === device.type)
        if (isCanonical) {
          alreadyCanonical.push({ id: device.id, code: device.code, type: device.type })
        } else {
          unknownTypes.push({ id: device.id, code: device.code, type: device.type })
        }
      } else {
        changes.push({ id: device.id, code: device.code, from: device.type, to: newType })
      }
    }

    // Group changes by from→to for summary
    const summary = {}
    for (const c of changes) {
      const key = `${c.from} → ${c.to}`
      summary[key] = (summary[key] || 0) + 1
    }

    res.json({
      totalDevices: devices.length,
      toMigrate: changes.length,
      alreadyCanonical: alreadyCanonical.length,
      unknownTypes: unknownTypes.length,
      summary,
      changes,
      unknown: unknownTypes,
    })
  } catch (err) {
    console.error('Error previewing migration:', err)
    res.status(500).json({ error: 'Failed to preview migration' })
  }
})

// ─── POST /migrate-types/run ──────────────────────────────────────────────────
// Runs the migration. Safe to run multiple times (idempotent).
router.post('/run', authMiddleware, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      select: { id: true, code: true, type: true },
    })

    const toUpdate = []
    for (const device of devices) {
      const newType = resolveTypeId(device.type)
      if (newType !== null && newType !== device.type) {
        toUpdate.push({ id: device.id, code: device.code, from: device.type, to: newType })
      }
    }

    if (toUpdate.length === 0) {
      return res.json({
        message: 'Nothing to migrate — all devices already have canonical type IDs.',
        migrated: 0,
        changes: [],
      })
    }

    // Run all updates in a single transaction
    await prisma.$transaction(
      toUpdate.map(({ id, to }) =>
        prisma.device.update({ where: { id }, data: { type: to } })
      )
    )

    // Group by from→to for summary
    const summary = {}
    for (const c of toUpdate) {
      const key = `${c.from} → ${c.to}`
      summary[key] = (summary[key] || 0) + 1
    }

    console.log(`[Migration] Migrated ${toUpdate.length} devices:`, summary)

    res.json({
      message: `Successfully migrated ${toUpdate.length} device(s) to canonical type IDs.`,
      migrated: toUpdate.length,
      summary,
      changes: toUpdate,
    })
  } catch (err) {
    console.error('Error running type migration:', err)
    res.status(500).json({ error: 'Failed to run migration: ' + err.message })
  }
})

export default router
