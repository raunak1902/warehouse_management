// backend/routes/customLocations.js
// ─────────────────────────────────────────────────────────────────────────────
// Custom deployment location routes
// Stores user-defined state/district/site combos as autocomplete suggestions.
// Usage count & lastUsed are updated each time a combo is reused.
// ─────────────────────────────────────────────────────────────────────────────

import express          from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware   from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/custom-locations
// Returns saved deployment locations, optionally filtered by state/district.
// Results are ordered by most-used first, then most-recently used.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { state, district, limit = 50 } = req.query;

    const where = {};
    if (state)    where.state    = state;
    if (district) where.district = district;

    const locations = await prisma.customDeploymentLocation.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { lastUsed:   'desc' },
      ],
      take: parseInt(limit),
    });

    res.json(locations);
  } catch (error) {
    console.error('Error fetching custom locations:', error);
    res.status(500).json({ error: 'Failed to fetch custom locations' });
  }
});

// GET /api/custom-locations/recent
// Returns the most recently used locations — useful for "last used" suggestions
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const locations = await prisma.customDeploymentLocation.findMany({
      orderBy: { lastUsed: 'desc' },
      take:    parseInt(limit),
      select: {
        state:    true,
        district: true,
        site:     true,
        lastUsed: true,
      },
    });

    res.json(locations);
  } catch (error) {
    console.error('Error fetching recent locations:', error);
    res.status(500).json({ error: 'Failed to fetch recent locations' });
  }
});

// GET /api/custom-locations/popular
// Returns the most frequently used locations — useful for autocomplete ranking
router.get('/popular', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const locations = await prisma.customDeploymentLocation.findMany({
      orderBy: { usageCount: 'desc' },
      take:    parseInt(limit),
      select: {
        state:      true,
        district:   true,
        site:       true,
        usageCount: true,
      },
    });

    res.json(locations);
  } catch (error) {
    console.error('Error fetching popular locations:', error);
    res.status(500).json({ error: 'Failed to fetch popular locations' });
  }
});

// POST /api/custom-locations
// Creates a new location or increments usageCount if it already exists (upsert).
// Called automatically when a device is assigned to a deployment site.
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { state, district, site } = req.body;

    if (!state || !district || !site) {
      return res.status(400).json({
        error: 'State, district, and site are all required',
      });
    }

    const location = await prisma.customDeploymentLocation.upsert({
      where: {
        state_district_site: { state, district, site },
      },
      update: {
        usageCount: { increment: 1 },
        lastUsed:   new Date(),
      },
      create: {
        state,
        district,
        site,
        usageCount: 1,
        lastUsed:   new Date(),
      },
    });

    res.json(location);
  } catch (error) {
    console.error('Error saving custom location:', error);
    res.status(500).json({ error: 'Failed to save custom location' });
  }
});

// DELETE /api/custom-locations/:id
// Removes a saved location. Blocked if any device is currently deployed there.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const location = await prisma.customDeploymentLocation.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Prevent deletion if devices are still deployed at this site
    const deviceCount = await prisma.device.count({
      where: {
        deploymentState:    location.state,
        deploymentDistrict: location.district,
        deploymentSite:     location.site,
      },
    });

    if (deviceCount > 0) {
      return res.status(400).json({
        error: `Cannot delete location used by ${deviceCount} device(s)`,
      });
    }

    await prisma.customDeploymentLocation.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom location:', error);
    res.status(500).json({ error: 'Failed to delete custom location' });
  }
});

export default router;