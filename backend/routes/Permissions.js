import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware, { isSuperAdmin } from "../middleware/auth.js";
// bustPermissionCache clears the in-memory role→permission cache in Permissions.js.
// It is optional — if that middleware isn't present the function is a safe no-op.
let bustPermissionCache = (_roleId) => {};

const router = express.Router();
const prisma = new PrismaClient();

// All routes require SuperAdmin
router.use(authMiddleware, isSuperAdmin);

// ── GET all permissions ───────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { operation: "asc" }],
    });
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE permission ─────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { module, operation, description } = req.body;
  if (!module || !operation) {
    return res.status(400).json({ message: "Module and operation are required" });
  }

  try {
    const permission = await prisma.permission.create({
      data: {
        module: module.trim(),
        operation: operation.trim().toLowerCase(),
        description: description?.trim() || null,
      },
    });
    res.status(201).json(permission);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({
        message: `Permission '${module}.${operation}' already exists`,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE permission ─────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { module, operation, description } = req.body;
  if (!module || !operation) {
    return res.status(400).json({ message: "Module and operation are required" });
  }

  try {
    const existing = await prisma.permission.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Permission not found" });

    const permission = await prisma.permission.update({
      where: { id },
      data: {
        module: module.trim(),
        operation: operation.trim().toLowerCase(),
        description: description?.trim() || null,
      },
    });

    // Bust cache for all roles that had this permission
    const affected = await prisma.rolePermission.findMany({
      where: { permissionId: id },
      select: { roleId: true },
    });
    affected.forEach(({ roleId }) => bustPermissionCache(roleId));

    res.json(permission);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({
        message: `Permission '${module}.${operation}' already exists`,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE permission ─────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.permission.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Permission not found" });

    // Bust cache for all roles that had this permission before deleting
    const affected = await prisma.rolePermission.findMany({
      where: { permissionId: id },
      select: { roleId: true },
    });

    // Cascade delete is handled by Prisma schema (onDelete: Cascade on RolePermission)
    await prisma.permission.delete({ where: { id } });

    affected.forEach(({ roleId }) => bustPermissionCache(roleId));

    res.json({ message: "Permission deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;