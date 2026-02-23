import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import authMiddleware, { isSuperAdmin } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// All routes require login + SuperAdmin role
router.use(authMiddleware, isSuperAdmin);

// ── GET all users ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      users.map((u) => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        role:      u.role.name,
        status:    u.status,
        createdAt: u.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE user ───────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, email, password, role: roleName, status = "Active" } = req.body;

  if (!name || !email || !password || !roleName) {
    return res.status(400).json({ message: "name, email, password and role are required" });
  }

  try {
    const role = await prisma.role.findFirst({
      where: { name: { equals: roleName, mode: "insensitive" } },
    });
    if (!role) return res.status(400).json({ message: `Role '${roleName}' not found` });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, roleId: role.id, status },
      include: { role: true },
    });

    res.status(201).json({
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role.name,
      status:    user.status,
      createdAt: user.createdAt,
    });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "Email already in use" });
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE user ───────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, email, password, role: roleName, status } = req.body;

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) return res.status(404).json({ message: "User not found" });

    // Prevent demoting the last SuperAdmin
    const normExisting = existing.role.name.toLowerCase().replace(/[\s_-]/g, "");
    const normNew      = roleName?.toLowerCase().replace(/[\s_-]/g, "");
    if (normExisting === "superadmin" && normNew !== "superadmin") {
      const count = await prisma.user.count({
        where: { role: { name: { equals: "SuperAdmin", mode: "insensitive" } } },
      });
      if (count <= 1) {
        return res.status(400).json({ message: "Cannot demote the last SuperAdmin" });
      }
    }

    const role = await prisma.role.findFirst({
      where: { name: { equals: roleName, mode: "insensitive" } },
    });
    if (!role) return res.status(400).json({ message: `Role '${roleName}' not found` });

    const updateData = { name, email, roleId: role.id, status };
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    res.json({
      id:     updated.id,
      name:   updated.name,
      email:  updated.email,
      role:   updated.role.name,
      status: updated.status,
    });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "Email already in use" });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE user ───────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Block deleting SuperAdmin accounts
    const normRole = user.role.name.toLowerCase().replace(/[\s_-]/g, "");
    if (normRole === "superadmin") {
      return res.status(400).json({ message: "Cannot delete a SuperAdmin account" });
    }

    // Block deleting yourself
    if (id === req.user?.userId) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;