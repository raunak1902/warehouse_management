import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware, { isSuperAdmin } from "../middleware/auth.js";
import { bustPermissionCache } from "../middleware/Permissions.js";

const router = express.Router();
const prisma = new PrismaClient();

// All routes require SuperAdmin
router.use(authMiddleware, isSuperAdmin);

// ── GET all roles ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { users: true, rolePermissions: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(
      roles.map((r) => ({
        id:              r.id,
        name:            r.name,
        description:     r.description,
        createdAt:       r.createdAt,
        userCount:       r._count.users,
        permissionCount: r._count.rolePermissions,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single role with its permissions ──────────────────────────────────────
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) return res.status(404).json({ message: "Role not found" });

    res.json({
      id:          role.id,
      name:        role.name,
      description: role.description,
      createdAt:   role.createdAt,
      userCount:   role._count.users,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE role ───────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "Role name is required" });

  try {
    const role = await prisma.role.create({
      data: { name: name.trim(), description: description?.trim() },
      include: { _count: { select: { users: true, rolePermissions: true } } },
    });
    res.status(201).json({
      id:              role.id,
      name:            role.name,
      description:     role.description,
      createdAt:       role.createdAt,
      userCount:       role._count.users,
      permissionCount: role._count.rolePermissions,
    });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "A role with that name already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE role ───────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "Role name is required" });

  try {
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Role not found" });

    // Protect SuperAdmin role name from being changed
    if (existing.name.toLowerCase().replace(/[\s_-]/g, "") === "superadmin" &&
        name.toLowerCase().replace(/[\s_-]/g, "") !== "superadmin") {
      return res.status(400).json({ message: "Cannot rename the SuperAdmin role" });
    }

    const role = await prisma.role.update({
      where: { id },
      data: { name: name.trim(), description: description?.trim() },
      include: { _count: { select: { users: true, rolePermissions: true } } },
    });

    res.json({
      id:              role.id,
      name:            role.name,
      description:     role.description,
      createdAt:       role.createdAt,
      userCount:       role._count.users,
      permissionCount: role._count.rolePermissions,
    });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "A role with that name already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE role ───────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Never delete SuperAdmin
    if (role.name.toLowerCase().replace(/[\s_-]/g, "") === "superadmin") {
      return res.status(400).json({ message: "Cannot delete the SuperAdmin role" });
    }

    // Block deletion if users are assigned to this role (prevents orphaned users)
    if (role._count.users > 0) {
      return res.status(400).json({
        message: `Cannot delete role '${role.name}' — ${role._count.users} user(s) are assigned to it. Reassign them first.`,
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ message: "Role deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET permissions assigned to a role ────────────────────────────────────────
router.get("/:id/permissions", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const rps = await prisma.rolePermission.findMany({
      where: { roleId: id },
      include: { permission: true },
    });
    res.json(rps.map((rp) => rp.permission));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ASSIGN permissions to a role (full replace) ───────────────────────────────
// Body: { permissionIds: [1, 2, 3] }
router.put("/:id/permissions", async (req, res) => {
  const roleId = parseInt(req.params.id);
  const { permissionIds } = req.body;

  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ message: "permissionIds must be an array" });
  }

  try {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Use a transaction: delete existing, insert new
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissionIds.length > 0
        ? [
            prisma.rolePermission.createMany({
              data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    // Return updated list
    const updated = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    bustPermissionCache(roleId); // invalidate in-memory cache
    res.json({
      roleId,
      permissionCount: updated.length,
      permissions: updated.map((rp) => rp.permission),
    });
  } catch (err) {

    res.status(500).json({ error: err.message });
  }
});

export default router;