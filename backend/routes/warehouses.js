// backend/routes/warehouses.js
// ─────────────────────────────────────────────────────────────────────────────
// Warehouse & WarehouseZone CRUD routes
// Handles: listing warehouses, zones, creating/updating/soft-deleting both
// ─────────────────────────────────────────────────────────────────────────────

import express                from 'express';
import { PrismaClient }       from '@prisma/client';
import authMiddleware         from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ── Warehouse routes ──────────────────────────────────────────────────────────

// GET /api/warehouses
// Returns all active warehouses (pass ?includeInactive=true to include deactivated ones)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const warehouses = await prisma.warehouse.findMany({
      where: includeInactive === 'true' ? {} : { isActive: true },
      include: {
        _count: {
          select: {
            devices:    true,
            deviceSets: true,
            zones:      true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// GET /api/warehouses/:id
// Returns a single warehouse including its active zones
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        zones: {
          where:   { isActive: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { devices: true, deviceSets: true },
        },
      },
    });

    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    res.json(warehouse);
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse' });
  }
});

// POST /api/warehouses
// Creates a new warehouse
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, address, city, state, contactPerson, contactPhone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        address,
        city,
        state,
        contactPerson,
        contactPhone,
        isActive: true,
      },
    });

    res.json(warehouse);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Warehouse with this name already exists' });
    }
    console.error('Error creating warehouse:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

// PUT /api/warehouses/:id
// Updates warehouse details
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, address, city, state, contactPerson, contactPhone, isActive } = req.body;

    const warehouse = await prisma.warehouse.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        address,
        city,
        state,
        contactPerson,
        contactPhone,
        isActive,
        updatedAt: new Date(),
      },
    });

    res.json(warehouse);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    console.error('Error updating warehouse:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

// DELETE /api/warehouses/:id
// Hard-deletes warehouse. Any devices referencing it will have warehouseId set to null
// (ON DELETE SET NULL in schema). Zones are cascade-deleted automatically.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.warehouse.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
});

// ── Zone routes ───────────────────────────────────────────────────────────────

// GET /api/warehouses/:id/zones
// Returns all active zones for a warehouse (pass ?includeInactive=true for all)
router.get('/:id/zones', authMiddleware, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const zones = await prisma.warehouseZone.findMany({
      where: {
        warehouseId: parseInt(req.params.id),
        ...(includeInactive === 'true' ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    res.json(zones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// POST /api/warehouses/:id/zones
// Creates a new zone inside the given warehouse
router.post('/:id/zones', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const warehouseId = parseInt(req.params.id);

    if (!name) {
      return res.status(400).json({ error: 'Zone name is required' });
    }

    // Verify warehouse exists first
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const zone = await prisma.warehouseZone.create({
      data: {
        warehouseId,
        name,
        description,
        isActive: true,
      },
    });

    res.json(zone);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'Zone with this name already exists in this warehouse',
      });
    }
    console.error('Error creating zone:', error);
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// PUT /api/warehouses/:id/zones/:zoneId
// Updates a zone's name, description, or active status
router.put('/:id/zones/:zoneId', authMiddleware, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const zone = await prisma.warehouseZone.update({
      where: { id: parseInt(req.params.zoneId) },
      data:  { name, description, isActive },
    });

    res.json(zone);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Zone not found' });
    }
    console.error('Error updating zone:', error);
    res.status(500).json({ error: 'Failed to update zone' });
  }
});

// DELETE /api/warehouses/:id/zones/:zoneId
// Hard-deletes a zone. Devices that referenced this zone by name keep the old
// text value on their record — no FK constraint on the zone name field.
router.delete('/:id/zones/:zoneId', authMiddleware, async (req, res) => {
  try {
    await prisma.warehouseZone.delete({
      where: { id: parseInt(req.params.zoneId) },
    });

    res.json({ message: 'Zone deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Zone not found' });
    }
    console.error('Error deleting zone:', error);
    res.status(500).json({ error: 'Failed to delete zone' });
  }
});

export default router;