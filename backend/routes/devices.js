import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// BARCODE UTILITY FUNCTIONS
// ==========================================

/**
 * Generate unique barcode for device
 * Format: EDSG-{TYPE}-{TIMESTAMP}-{RANDOM}
 */
const generateBarcode = (deviceType) => {
  const prefix = 'EDSG' // EDSignage
  const typeCode = getTypeCode(deviceType)
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  
  return `${prefix}-${typeCode}-${timestamp}-${random}`
}

/**
 * Get type code from device type
 */
const getTypeCode = (type) => {
  const typeCodes = {
    tv: 'TV',
    tablet: 'TAB',
    stand: 'ATV',
    istand: 'ITV',
    mediaBox: 'MBX',
    battery: 'BAT',
    fabrication: 'FAB',
  }
  return typeCodes[type] || 'DEV'
}

// ==========================================
// GET ALL DEVICES
// ==========================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        client: true, // Include client information
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// ==========================================
// GET DEVICE BY BARCODE (NEW - for scanner)
// ==========================================
router.get("/barcode/:barcode", authMiddleware, async (req, res) => {
  try {
    const { barcode } = req.params;

    const device = await prisma.device.findUnique({
      where: { barcode: barcode.toUpperCase() },
      include: {
        client: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    console.error("Error fetching device by barcode:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

// ==========================================
// GET SINGLE DEVICE BY ID
// ==========================================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id: parseInt(id) },
      include: {
        client: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

// ==========================================
// GET DEVICE BY CODE
// ==========================================
router.get("/code/:code", authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;

    const device = await prisma.device.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        client: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    console.error("Error fetching device by code:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

// ==========================================
// CREATE NEW DEVICE (UPDATED - with barcode)
// ==========================================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      code,
      type,
      brand,
      size,
      model,
      color,
      gpsId,
      mfgDate,
      lifecycleStatus,
      location,
      state,
      district,
      pinpoint,
      clientId,
      barcode, // NEW: Optional barcode (user can provide their own)
    } = req.body;

    // Validate required fields
    if (!code || !type) {
      return res.status(400).json({ 
        error: "Code and type are required fields" 
      });
    }

    // Check if code already exists
    const existingDevice = await prisma.device.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingDevice) {
      return res.status(400).json({ 
        error: "Device code already exists" 
      });
    }

    // Generate barcode if not provided by user
    let finalBarcode = barcode ? barcode.toUpperCase() : generateBarcode(type);

    // Check if barcode already exists
    const existingBarcode = await prisma.device.findUnique({
      where: { barcode: finalBarcode },
    });

    if (existingBarcode) {
      // If auto-generated barcode exists (very rare), generate another
      if (!barcode) {
        finalBarcode = generateBarcode(type) + '-' + Math.random().toString(36).substring(2, 4).toUpperCase();
      } else {
        return res.status(400).json({ 
          error: "Barcode already exists. Please use a unique barcode." 
        });
      }
    }

    // If clientId is provided, verify client exists
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: parseInt(clientId) },
      });

      if (!client) {
        return res.status(400).json({ 
          error: "Client not found" 
        });
      }
    }

    // Create device
    const device = await prisma.device.create({
      data: {
        code: code.toUpperCase(),
        barcode: finalBarcode, // NEW: Save barcode
        type,
        brand: brand || null,
        size: size || null,
        model: model || null,
        color: color || null,
        gpsId: gpsId || null,
        mfgDate: mfgDate ? new Date(mfgDate) : null,
        lifecycleStatus: lifecycleStatus || "warehouse",
        location: location || null,
        state: state || null,
        district: district || null,
        pinpoint: pinpoint || null,
        clientId: clientId ? parseInt(clientId) : null,
      },
      include: {
        client: true,
      },
    });

    res.status(201).json(device);
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ error: "Failed to create device" });
  }
});

// ==========================================
// UPDATE DEVICE (UPDATED - with barcode)
// ==========================================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      barcode, // NEW: Can update barcode
      type,
      brand,
      size,
      model,
      color,
      gpsId,
      mfgDate,
      lifecycleStatus,
      location,
      state,
      district,
      pinpoint,
      clientId,
    } = req.body;

    // Check if device exists
    const existingDevice = await prisma.device.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingDevice) {
      return res.status(404).json({ error: "Device not found" });
    }

    // If code is being changed, check if new code is available
    if (code && code.toUpperCase() !== existingDevice.code) {
      const codeExists = await prisma.device.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (codeExists) {
        return res.status(400).json({ 
          error: "Device code already exists" 
        });
      }
    }

    // NEW: If barcode is being changed, check if new barcode is available
    if (barcode && barcode.toUpperCase() !== existingDevice.barcode) {
      const barcodeExists = await prisma.device.findUnique({
        where: { barcode: barcode.toUpperCase() },
      });

      if (barcodeExists) {
        return res.status(400).json({ 
          error: "Barcode already exists" 
        });
      }
    }

    // If clientId is provided, verify client exists
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: parseInt(clientId) },
      });

      if (!client) {
        return res.status(400).json({ 
          error: "Client not found" 
        });
      }
    }

    // Update device
    const updatedDevice = await prisma.device.update({
      where: { id: parseInt(id) },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(barcode && { barcode: barcode.toUpperCase() }), // NEW: Update barcode
        ...(type && { type }),
        brand: brand !== undefined ? brand : existingDevice.brand,
        size: size !== undefined ? size : existingDevice.size,
        model: model !== undefined ? model : existingDevice.model,
        color: color !== undefined ? color : existingDevice.color,
        gpsId: gpsId !== undefined ? gpsId : existingDevice.gpsId,
        mfgDate: mfgDate !== undefined 
          ? (mfgDate ? new Date(mfgDate) : null) 
          : existingDevice.mfgDate,
        lifecycleStatus: lifecycleStatus !== undefined 
          ? lifecycleStatus 
          : existingDevice.lifecycleStatus,
        location: location !== undefined ? location : existingDevice.location,
        state: state !== undefined ? state : existingDevice.state,
        district: district !== undefined ? district : existingDevice.district,
        pinpoint: pinpoint !== undefined ? pinpoint : existingDevice.pinpoint,
        clientId: clientId !== undefined 
          ? (clientId ? parseInt(clientId) : null) 
          : existingDevice.clientId,
      },
      include: {
        client: true,
      },
    });

    res.json(updatedDevice);
  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// ==========================================
// DELETE DEVICE
// ==========================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if device exists
    const device = await prisma.device.findUnique({
      where: { id: parseInt(id) },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Delete device
    await prisma.device.delete({
      where: { id: parseInt(id) },
    });

    res.json({ 
      message: "Device deleted successfully",
      deletedDevice: device 
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

// ==========================================
// BULK OPERATIONS
// ==========================================

// Assign multiple devices to a client
router.post("/bulk/assign", authMiddleware, async (req, res) => {
  try {
    const { deviceIds, clientId } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ 
        error: "deviceIds must be a non-empty array" 
      });
    }

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
    });

    if (!client) {
      return res.status(400).json({ error: "Client not found" });
    }

    // Update devices
    const result = await prisma.device.updateMany({
      where: {
        id: {
          in: deviceIds.map(id => parseInt(id)),
        },
      },
      data: {
        clientId: parseInt(clientId),
        lifecycleStatus: "assigning",
      },
    });

    res.json({ 
      message: `${result.count} devices assigned to client`,
      count: result.count 
    });
  } catch (error) {
    console.error("Error in bulk assign:", error);
    res.status(500).json({ error: "Failed to assign devices" });
  }
});

// Unassign devices from client
router.post("/bulk/unassign", authMiddleware, async (req, res) => {
  try {
    const { deviceIds } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ 
        error: "deviceIds must be a non-empty array" 
      });
    }

    const result = await prisma.device.updateMany({
      where: {
        id: {
          in: deviceIds.map(id => parseInt(id)),
        },
      },
      data: {
        clientId: null,
        lifecycleStatus: "warehouse",
        state: null,
        district: null,
        pinpoint: null,
      },
    });

    res.json({ 
      message: `${result.count} devices unassigned`,
      count: result.count 
    });
  } catch (error) {
    console.error("Error in bulk unassign:", error);
    res.status(500).json({ error: "Failed to unassign devices" });
  }
});

// Update lifecycle status for multiple devices
router.post("/bulk/update-lifecycle", authMiddleware, async (req, res) => {
  try {
    const { deviceIds, lifecycleStatus, location, state, district, pinpoint } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ 
        error: "deviceIds must be a non-empty array" 
      });
    }

    if (!lifecycleStatus) {
      return res.status(400).json({ 
        error: "lifecycleStatus is required" 
      });
    }

    const updateData = {
      lifecycleStatus,
    };

    if (location !== undefined) updateData.location = location;
    if (state !== undefined) updateData.state = state;
    if (district !== undefined) updateData.district = district;
    if (pinpoint !== undefined) updateData.pinpoint = pinpoint;

    const result = await prisma.device.updateMany({
      where: {
        id: {
          in: deviceIds.map(id => parseInt(id)),
        },
      },
      data: updateData,
    });

    res.json({ 
      message: `${result.count} devices updated`,
      count: result.count 
    });
  } catch (error) {
    console.error("Error in bulk update lifecycle:", error);
    res.status(500).json({ error: "Failed to update devices" });
  }
});

// ==========================================
// FILTER/SEARCH OPERATIONS
// ==========================================

// Get devices by type
router.get("/filter/type/:type", authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;

    const devices = await prisma.device.findMany({
      where: { type },
      include: {
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error filtering devices by type:", error);
    res.status(500).json({ error: "Failed to filter devices" });
  }
});

// Get devices by lifecycle status
router.get("/filter/lifecycle/:status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.params;

    const devices = await prisma.device.findMany({
      where: { lifecycleStatus: status },
      include: {
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error filtering devices by lifecycle:", error);
    res.status(500).json({ error: "Failed to filter devices" });
  }
});

// Get devices by client
router.get("/filter/client/:clientId", authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;

    const devices = await prisma.device.findMany({
      where: { clientId: parseInt(clientId) },
      include: {
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error filtering devices by client:", error);
    res.status(500).json({ error: "Failed to filter devices" });
  }
});

// Advanced search with multiple filters
router.post("/search", authMiddleware, async (req, res) => {
  try {
    const { 
      type, 
      lifecycleStatus, 
      clientId, 
      brand, 
      size, 
      state, 
      district,
      searchCode 
    } = req.body;

    const where = {};

    if (type) where.type = type;
    if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus;
    if (clientId) where.clientId = parseInt(clientId);
    if (brand) where.brand = brand;
    if (size) where.size = size;
    if (state) where.state = state;
    if (district) where.district = district;
    if (searchCode) {
      where.code = {
        contains: searchCode.toUpperCase(),
        mode: 'insensitive',
      };
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error searching devices:", error);
    res.status(500).json({ error: "Failed to search devices" });
  }
});

// ==========================================
// STATISTICS
// ==========================================

// Get device statistics
router.get("/stats/summary", authMiddleware, async (req, res) => {
  try {
    const [
      totalDevices,
      warehouseDevices,
      assigningDevices,
      deployedDevices,
      devicesByType,
    ] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { lifecycleStatus: "warehouse" } }),
      prisma.device.count({ where: { lifecycleStatus: "assigning" } }),
      prisma.device.count({ where: { lifecycleStatus: "deployed" } }),
      prisma.device.groupBy({
        by: ["type"],
        _count: true,
      }),
    ]);

    res.json({
      total: totalDevices,
      warehouse: warehouseDevices,
      assigning: assigningDevices,
      deployed: deployedDevices,
      byType: devicesByType.map(item => ({
        type: item.type,
        count: item._count,
      })),
    });
  } catch (error) {
    console.error("Error fetching device statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;