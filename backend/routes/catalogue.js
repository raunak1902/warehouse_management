/**
 * routes/catalogue.js
 * ───────────────────
 * Command Centre API — manages product types, set types, brands, sizes, colors, pinpoints.
 * All write operations require Manager or SuperAdmin role.
 * Read operations are open to all authenticated users.
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/auth.js'
import { isManagerOrAbove } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT TYPES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/catalogue/product-types — active types (all roles)
// ?includeInactive=true  → also returns inactive types (manager+ only, used for reactivation UI)
router.get('/product-types', async (req, res) => {
  try {
    const wantsInactive = req.query.includeInactive === 'true'
    // Only managers may see inactive types
    const role = (req.user?.role || '').toLowerCase().replace(/[\s_-]/g, '')
    const isManager = role === 'manager' || role === 'superadmin'
    const where = (wantsInactive && isManager) ? {} : { isActive: true }
    const types = await prisma.productTypeConfig.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    res.json(types)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product types' })
  }
})

// POST /api/catalogue/product-types — create new type (manager+)
router.post('/product-types', isManagerOrAbove, async (req, res) => {
  try {
    const { typeId, label, prefix, icon, color } = req.body
    if (!typeId || !label || !prefix) {
      return res.status(400).json({ error: 'typeId, label and prefix are required' })
    }
    const id = typeId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const pfx = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Check duplicates
    const existing = await prisma.productTypeConfig.findUnique({ where: { typeId: id } })
    if (existing) return res.status(409).json({ error: `Type ID "${id}" already exists` })

    // Check prefix collision across BOTH device types and set types — prefix must be globally unique
    const prefixInDeviceTypes = await prisma.productTypeConfig.findFirst({ where: { prefix: pfx } })
    if (prefixInDeviceTypes) return res.status(409).json({ error: `Prefix "${pfx}" is already used by device type "${prefixInDeviceTypes.label}"` })
    const prefixInSetTypes = await prisma.setTypeConfig.findFirst({ where: { prefix: pfx } })
    if (prefixInSetTypes) return res.status(409).json({ error: `Prefix "${pfx}" is already used by set type "${prefixInSetTypes.label}" — prefixes must be unique across all device and set types` })

    const newType = await prisma.productTypeConfig.create({
      data: {
        typeId: id,
        label: label.trim(),
        prefix: pfx,
        icon: icon || 'Package',
        color: color || 'gray',
        isBuiltin: false,
        isActive: true,
      },
    })
    res.status(201).json(newType)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create product type' })
  }
})

// PUT /api/catalogue/product-types/:typeId — update (manager+)
router.put('/product-types/:typeId', isManagerOrAbove, async (req, res) => {
  try {
    const { typeId } = req.params
    const { label, icon, color, isActive } = req.body
    const existing = await prisma.productTypeConfig.findUnique({ where: { typeId } })
    if (!existing) return res.status(404).json({ error: 'Type not found' })

    const updated = await prisma.productTypeConfig.update({
      where: { typeId },
      data: {
        ...(label !== undefined && { label }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product type' })
  }
})

// DELETE /api/catalogue/product-types/:typeId — soft delete (manager+, non-builtin only)
router.delete('/product-types/:typeId', isManagerOrAbove, async (req, res) => {
  try {
    const { typeId } = req.params
    const existing = await prisma.productTypeConfig.findUnique({ where: { typeId } })
    if (!existing) return res.status(404).json({ error: 'Type not found' })
    if (existing.isBuiltin) return res.status(403).json({ error: 'Built-in types cannot be deleted' })

    // Check if any devices use this type
    const deviceCount = await prisma.device.count({ where: { type: typeId } })
    if (deviceCount > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${deviceCount} device(s) use this type. Deactivate instead.`,
      })
    }

    await prisma.productTypeConfig.update({ where: { typeId }, data: { isActive: false } })
    res.json({ ok: true, message: `Type "${existing.label}" deactivated` })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product type' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// SET TYPES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/catalogue/set-types — active types (all roles)
// ?includeInactive=true  → also returns inactive types (manager+ only, used for reactivation UI)
router.get('/set-types', async (req, res) => {
  try {
    const wantsInactive = req.query.includeInactive === 'true'
    const role = (req.user?.role || '').toLowerCase().replace(/[\s_-]/g, '')
    const isManager = role === 'manager' || role === 'superadmin'
    const where = (wantsInactive && isManager) ? {} : { isActive: true }
    const types = await prisma.setTypeConfig.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    res.json(types)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch set types' })
  }
})

// POST /api/catalogue/set-types
router.post('/set-types', isManagerOrAbove, async (req, res) => {
  try {
    const { setTypeId, label, prefix, icon, color, componentSlots } = req.body
    if (!setTypeId || !label || !prefix || !componentSlots) {
      return res.status(400).json({ error: 'setTypeId, label, prefix and componentSlots are required' })
    }
    if (!Array.isArray(componentSlots) || componentSlots.length === 0) {
      return res.status(400).json({ error: 'componentSlots must be a non-empty array' })
    }

    const id = setTypeId.trim()
    const pfx = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    const existing = await prisma.setTypeConfig.findUnique({ where: { setTypeId: id } })
    if (existing) return res.status(409).json({ error: `Set type ID "${id}" already exists` })

    // Check prefix collision across BOTH set types and device types — prefix must be globally unique
    const pfxInSetTypes = await prisma.setTypeConfig.findFirst({ where: { prefix: pfx } })
    if (pfxInSetTypes) return res.status(409).json({ error: `Prefix "${pfx}" is already used by set type "${pfxInSetTypes.label}"` })
    const pfxInDeviceTypes = await prisma.productTypeConfig.findFirst({ where: { prefix: pfx } })
    if (pfxInDeviceTypes) return res.status(409).json({ error: `Prefix "${pfx}" is already used by device type "${pfxInDeviceTypes.label}" — prefixes must be unique across all device and set types` })

    const newType = await prisma.setTypeConfig.create({
      data: {
        setTypeId: id,
        label: label.trim(),
        prefix: pfx,
        icon: icon || 'Layers',
        color: color || 'gray',
        componentSlots,
        isBuiltin: false,
        isActive: true,
      },
    })
    res.status(201).json(newType)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create set type' })
  }
})

// PUT /api/catalogue/set-types/:setTypeId
router.put('/set-types/:setTypeId', isManagerOrAbove, async (req, res) => {
  try {
    const { setTypeId } = req.params
    const { label, icon, color, componentSlots, isActive } = req.body
    const existing = await prisma.setTypeConfig.findUnique({ where: { setTypeId } })
    if (!existing) return res.status(404).json({ error: 'Set type not found' })

    const updated = await prisma.setTypeConfig.update({
      where: { setTypeId },
      data: {
        ...(label !== undefined && { label }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(componentSlots !== undefined && { componentSlots }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update set type' })
  }
})

// DELETE /api/catalogue/set-types/:setTypeId
// Always soft-deactivates (never hard-deletes). Builtins can be deactivated but not destroyed.
router.delete('/set-types/:setTypeId', isManagerOrAbove, async (req, res) => {
  try {
    const { setTypeId } = req.params
    const existing = await prisma.setTypeConfig.findUnique({ where: { setTypeId } })
    if (!existing) return res.status(404).json({ error: 'Set type not found' })

    const setCount = await prisma.deviceSet.count({ where: { setType: setTypeId } })
    await prisma.setTypeConfig.update({ where: { setTypeId }, data: { isActive: false } })
    res.json({ ok: true, setCount })
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate set type' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BRANDS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.catalogueBrand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(brands)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch brands' })
  }
})

router.post('/brands', isManagerOrAbove, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Brand name is required' })
    const brand = await prisma.catalogueBrand.upsert({
      where: { name: name.trim() },
      update: { isActive: true },
      create: { name: name.trim() },
    })
    res.status(201).json(brand)
  } catch (err) {
    res.status(500).json({ error: 'Failed to add brand' })
  }
})

router.delete('/brands/:id', isManagerOrAbove, async (req, res) => {
  try {
    await prisma.catalogueBrand.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete brand' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// SIZES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/sizes', async (req, res) => {
  try {
    const sizes = await prisma.catalogueSize.findMany({
      where: { isActive: true },
      orderBy: { value: 'asc' },
    })
    res.json(sizes)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sizes' })
  }
})

router.post('/sizes', isManagerOrAbove, async (req, res) => {
  try {
    const { value } = req.body
    if (!value?.trim()) return res.status(400).json({ error: 'Size value is required' })
    const size = await prisma.catalogueSize.upsert({
      where: { value: value.trim() },
      update: { isActive: true },
      create: { value: value.trim() },
    })
    res.status(201).json(size)
  } catch (err) {
    res.status(500).json({ error: 'Failed to add size' })
  }
})

router.delete('/sizes/:id', isManagerOrAbove, async (req, res) => {
  try {
    await prisma.catalogueSize.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete size' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/colors', async (req, res) => {
  try {
    const colors = await prisma.catalogueColor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(colors)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch colors' })
  }
})

router.post('/colors', isManagerOrAbove, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Color name is required' })
    const color = await prisma.catalogueColor.upsert({
      where: { name: name.trim() },
      update: { isActive: true },
      create: { name: name.trim() },
    })
    res.status(201).json(color)
  } catch (err) {
    res.status(500).json({ error: 'Failed to add color' })
  }
})

router.delete('/colors/:id', isManagerOrAbove, async (req, res) => {
  try {
    await prisma.catalogueColor.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete color' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PINPOINTS (location suggestions)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/catalogue/pinpoints?state=X&district=Y
router.get('/pinpoints', async (req, res) => {
  try {
    const { state, district } = req.query
    if (!state || !district) return res.status(400).json({ error: 'state and district are required' })
    const pinpoints = await prisma.savedPinpoint.findMany({
      where: { state, district },
      orderBy: { pinpoint: 'asc' },
      select: { pinpoint: true },
    })
    res.json(pinpoints.map(p => p.pinpoint))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pinpoints' })
  }
})

// POST /api/catalogue/pinpoints — save a new pinpoint
router.post('/pinpoints', async (req, res) => {
  try {
    const { state, district, pinpoint } = req.body
    if (!state || !district || !pinpoint) {
      return res.status(400).json({ error: 'state, district and pinpoint are required' })
    }
    await prisma.savedPinpoint.upsert({
      where: { state_district_pinpoint: { state, district, pinpoint: pinpoint.trim() } },
      update: {},
      create: { state, district, pinpoint: pinpoint.trim() },
    })
    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save pinpoint' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION PRESETS (warehouse-specific location suggestions, e.g. "Rack A", "Shelf 3")
// Global — not scoped per warehouse or zone. Free text is still allowed in the UI.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/catalogue/location-presets — all active presets (all roles)
router.get('/location-presets', async (req, res) => {
  try {
    const presets = await prisma.catalogueLocationPreset.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(presets)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location presets' })
  }
})

// POST /api/catalogue/location-presets — add preset (manager+)
router.post('/location-presets', isManagerOrAbove, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Preset name is required' })

    const preset = await prisma.catalogueLocationPreset.create({
      data: { name: name.trim(), isActive: true },
    })
    res.status(201).json(preset)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A preset with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to create location preset' })
  }
})

// DELETE /api/catalogue/location-presets/:id — hard delete (manager+)
// No device references to check — presets are suggestions only (free text is stored on device)
router.delete('/location-presets/:id', isManagerOrAbove, async (req, res) => {
  try {
    await prisma.catalogueLocationPreset.delete({
      where: { id: parseInt(req.params.id) },
    })
    res.json({ message: 'Location preset deleted' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Preset not found' })
    res.status(500).json({ error: 'Failed to delete location preset' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BULK FETCH (single call to load everything on app start)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const [productTypes, setTypes, brands, sizes, colors, locationPresets] = await Promise.all([
      prisma.productTypeConfig.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      prisma.setTypeConfig.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      prisma.catalogueBrand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.catalogueSize.findMany({ where: { isActive: true }, orderBy: { value: 'asc' } }),
      prisma.catalogueColor.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.catalogueLocationPreset.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    ])
    res.json({ productTypes, setTypes, brands, sizes, colors, locationPresets })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catalogue' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// seedBuiltinTypes — called once on server startup
// Safe upsert: skips any type that already exists. Only inserts the canonical
// builtin device types (TV, TAB, TTV, AST, IST, TST, MB, BAT, MSE, W).
// This ensures ground team requests never fail with "Unknown device type"
// even if the manager never opened CommandCentre to add these types manually.
// ─────────────────────────────────────────────────────────────────────────────
const BUILTIN_DEVICE_TYPES = [
  { typeId: 'TV',  label: 'TV',             prefix: 'TV',  icon: 'Tv',       color: 'blue',   sortOrder: 1  },
  { typeId: 'TAB', label: 'Tablet',          prefix: 'TAB', icon: 'Tablet',   color: 'indigo', sortOrder: 2  },
  { typeId: 'TTV', label: 'Touch TV',        prefix: 'TTV', icon: 'Monitor',  color: 'cyan',   sortOrder: 3  },
  { typeId: 'AST', label: 'A-Frame Stand',   prefix: 'AST', icon: 'LayoutGrid', color: 'orange', sortOrder: 4 },
  { typeId: 'IST', label: 'I-Frame Stand',   prefix: 'IST', icon: 'Monitor',  color: 'purple', sortOrder: 5  },
  { typeId: 'TST', label: 'Tablet Stand',    prefix: 'TST', icon: 'Layers',   color: 'pink',   sortOrder: 6  },
  { typeId: 'MB',  label: 'Media Box',       prefix: 'MB',  icon: 'Box',      color: 'teal',   sortOrder: 7  },
  { typeId: 'BAT', label: 'Battery Pack',    prefix: 'BAT', icon: 'Battery',  color: 'yellow', sortOrder: 8  },
  { typeId: 'MSE', label: 'Mouse',           prefix: 'MSE', icon: 'Mouse',    color: 'slate',  sortOrder: 9  },
  { typeId: 'W',   label: 'Wires',           prefix: 'W',   icon: 'Zap',      color: 'amber',  sortOrder: 10 },
]

export async function seedBuiltinTypes() {
  try {
    let seeded = 0
    for (const t of BUILTIN_DEVICE_TYPES) {
      const existing = await prisma.productTypeConfig.findUnique({ where: { typeId: t.typeId } })
      if (!existing) {
        await prisma.productTypeConfig.create({
          data: { ...t, isBuiltin: true, isActive: true },
        })
        seeded++
        console.log(`[SeedBuiltins] Created product type: ${t.typeId} (${t.label})`)
      }
    }
    if (seeded === 0) {
      console.log('[SeedBuiltins] All builtin types already present — nothing to do.')
    } else {
      console.log(`[SeedBuiltins] Seeded ${seeded} missing builtin type(s).`)
    }
  } catch (err) {
    console.error('[SeedBuiltins] Failed:', err.message)
  }
}


export default router