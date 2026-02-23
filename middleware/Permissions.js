/**
 * middleware/permissions.js
 * ─────────────────────────
 * DB-backed permission checks.
 *
 * Usage:
 *   import { requirePermission } from '../middleware/permissions.js'
 *   router.get('/', authMiddleware, requirePermission('Devices', 'read'), handler)
 *
 * SuperAdmin always passes — no DB lookup needed.
 * All other roles are checked against RolePermission in the DB.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normalize = (s) => (s ?? "").toLowerCase().replace(/[\s_-]/g, "");

// In-memory cache: roleId → Set<"Module.operation">
// Cleared whenever we detect a change (or just on server restart).
const permCache = new Map(); // roleId → { ts: number, perms: Set<string> }
const CACHE_TTL_MS = 60_000; // 1 minute

async function getRolePermissions(roleId) {
  const cached = permCache.get(roleId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.perms;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  const perms = new Set(
    rows.map((rp) => `${rp.permission.module}.${rp.permission.operation}`)
  );
  permCache.set(roleId, { ts: Date.now(), perms });
  return perms;
}

/** Call this after saving new role permissions to bust the cache for that role. */
export const bustPermissionCache = (roleId) => permCache.delete(roleId);

/**
 * requirePermission(module, operation)
 * Returns an Express middleware that checks if the current user's role
 * has the given permission. SuperAdmin always passes.
 */
export const requirePermission = (module, operation) => async (req, res, next) => {
  try {
    const userRole = normalize(req.user?.role ?? "");

    // SuperAdmin bypasses all permission checks
    if (userRole === "superadmin") return next();

    // Get the role record to find its ID
    const role = await prisma.role.findFirst({
      where: { name: { equals: req.user?.role, mode: "insensitive" } },
      select: { id: true },
    });

    if (!role) {
      return res.status(403).json({
        message: `Access denied — role '${req.user?.role}' not found`,
      });
    }

    const perms = await getRolePermissions(role.id);
    const key = `${module}.${operation}`;

    if (!perms.has(key)) {
      return res.status(403).json({
        message: `Access denied — missing permission: ${key}`,
      });
    }

    next();
  } catch (err) {
    console.error("[requirePermission] Error:", err.message);
    res.status(500).json({ error: "Permission check failed" });
  }
};

/**
 * requireAnyPermission(pairs)
 * Passes if the user has AT LEAST ONE of the given [module, operation] pairs.
 * Useful for routes that managers and ground team can both access (but differently).
 */
export const requireAnyPermission = (...pairs) => async (req, res, next) => {
  try {
    const userRole = normalize(req.user?.role ?? "");
    if (userRole === "superadmin") return next();

    const role = await prisma.role.findFirst({
      where: { name: { equals: req.user?.role, mode: "insensitive" } },
      select: { id: true },
    });

    if (!role) {
      return res.status(403).json({ message: "Access denied — role not found" });
    }

    const perms = await getRolePermissions(role.id);
    const hasAny = pairs.some(([m, op]) => perms.has(`${m}.${op}`));

    if (!hasAny) {
      const required = pairs.map(([m, op]) => `${m}.${op}`).join(" or ");
      return res.status(403).json({
        message: `Access denied — requires one of: ${required}`,
      });
    }

    next();
  } catch (err) {
    console.error("[requireAnyPermission] Error:", err.message);
    res.status(500).json({ error: "Permission check failed" });
  }
};

export default requirePermission;