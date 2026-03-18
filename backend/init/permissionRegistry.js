import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 🔐 CENTRAL PERMISSION REGISTRY
 *
 * Single source of truth for all permissions in the system.
 * Server auto-syncs these to the DB on every start.
 */
export const ALL_PERMISSIONS = [

  // ═══════════════════════════════════════════════════════════════
  // DEVICES
  // ═══════════════════════════════════════════════════════════════
  { module: "Devices", operation: "read",         description: "View devices" },
  { module: "Devices", operation: "create",       description: "Create devices" },
  { module: "Devices", operation: "update",       description: "Update devices" },
  { module: "Devices", operation: "delete",       description: "Delete devices" },
  { module: "Devices", operation: "view_history", description: "View device history" },

  // ═══════════════════════════════════════════════════════════════
  // SETS
  // ═══════════════════════════════════════════════════════════════
  { module: "Sets", operation: "read",        description: "View sets" },
  { module: "Sets", operation: "create",      description: "Create sets" },
  { module: "Sets", operation: "update",      description: "Update sets" },
  { module: "Sets", operation: "delete",      description: "Delete sets" },
  { module: "Sets", operation: "disassemble", description: "Disassemble sets" },

  // ═══════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════
  { module: "Clients", operation: "read",   description: "View clients" },
  { module: "Clients", operation: "create", description: "Create clients" },
  { module: "Clients", operation: "update", description: "Update clients" },
  { module: "Clients", operation: "delete", description: "Delete clients" },

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE REQUESTS
  // ═══════════════════════════════════════════════════════════════
  { module: "LifecycleRequests", operation: "read",    description: "View lifecycle requests" },
  { module: "LifecycleRequests", operation: "create",  description: "Create lifecycle requests" },
  { module: "LifecycleRequests", operation: "approve", description: "Approve lifecycle requests" },
  { module: "LifecycleRequests", operation: "reject",  description: "Reject lifecycle requests" },

  // ═══════════════════════════════════════════════════════════════
  // INVENTORY REQUESTS
  // ═══════════════════════════════════════════════════════════════
  { module: "Inventory", operation: "read",    description: "View inventory" },
  { module: "Inventory", operation: "create",  description: "Add inventory" },
  { module: "Inventory", operation: "update",  description: "Update inventory" },
  { module: "Inventory", operation: "approve", description: "Approve inventory requests" },
  { module: "Inventory", operation: "reject",  description: "Reject inventory requests" },

  // ═══════════════════════════════════════════════════════════════
  // REQUESTS (general)
  // ═══════════════════════════════════════════════════════════════
  { module: "Requests", operation: "create",  description: "Create requests" },
  { module: "Requests", operation: "approve", description: "Approve requests" },
  { module: "Requests", operation: "reject",  description: "Reject requests" },

  // ═══════════════════════════════════════════════════════════════
  // RETURNS
  // ═══════════════════════════════════════════════════════════════
  { module: "Returns", operation: "read",   description: "View returns" },
  { module: "Returns", operation: "update", description: "Manage returns" },

  // ═══════════════════════════════════════════════════════════════
  // CATALOGUE
  // ═══════════════════════════════════════════════════════════════
  { module: "Catalogue", operation: "read",   description: "View catalogue (types, brands, sizes)" },
  { module: "Catalogue", operation: "create", description: "Add catalogue items" },
  { module: "Catalogue", operation: "update", description: "Update catalogue items" },
  { module: "Catalogue", operation: "delete", description: "Delete catalogue items" },

  // ═══════════════════════════════════════════════════════════════
  // WAREHOUSES
  // ═══════════════════════════════════════════════════════════════
  { module: "Warehouses", operation: "read",   description: "View warehouses" },
  { module: "Warehouses", operation: "create", description: "Create warehouses" },
  { module: "Warehouses", operation: "update", description: "Update warehouses" },
  { module: "Warehouses", operation: "delete", description: "Delete warehouses" },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM LOCATIONS
  // ═══════════════════════════════════════════════════════════════
  { module: "CustomLocations", operation: "read",   description: "View custom locations" },
  { module: "CustomLocations", operation: "create", description: "Create custom locations" },
  { module: "CustomLocations", operation: "update", description: "Update custom locations" },
  { module: "CustomLocations", operation: "delete", description: "Delete custom locations" },

  // ═══════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════
  { module: "Users", operation: "read",   description: "View users" },
  { module: "Users", operation: "create", description: "Create users" },
  { module: "Users", operation: "update", description: "Update users" },
  { module: "Users", operation: "delete", description: "Delete users" },

  // ═══════════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════════
  { module: "Roles", operation: "read",   description: "View roles" },
  { module: "Roles", operation: "create", description: "Create roles" },
  { module: "Roles", operation: "update", description: "Update roles" },
  { module: "Roles", operation: "delete", description: "Delete roles" },

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════
  { module: "Notifications", operation: "read", description: "View notifications" },
];

/**
 * 👥 ROLE LIST
 */
export const ROLE_LIST = [
  "SUPER_ADMIN",
  "MANAGER",
  "GROUND_TEAM",
];

/**
 * 🔗 ROLE → PERMISSION MAPPING
 *
 * SUPER_ADMIN  → everything (bypassed in middleware anyway)
 * MANAGER      → read all + approve/reject requests + manage catalogue/returns
 * GROUND_TEAM  → read devices/sets/clients + create lifecycle/inventory requests
 */
const ROLE_PERMISSIONS = {

  SUPER_ADMIN: "*", // all permissions

  MANAGER: [
    "Devices.read", "Devices.create", "Devices.update", "Devices.view_history",
    "Sets.read", "Sets.create", "Sets.update", "Sets.disassemble",
    "Clients.read", "Clients.create", "Clients.update",
    "LifecycleRequests.read", "LifecycleRequests.approve", "LifecycleRequests.reject",
    "Inventory.read", "Inventory.approve", "Inventory.reject",
    "Requests.approve", "Requests.reject",
    "Returns.read", "Returns.update",
    "Catalogue.read", "Catalogue.create", "Catalogue.update", "Catalogue.delete",
    "Warehouses.read", "Warehouses.create", "Warehouses.update",
    "CustomLocations.read", "CustomLocations.create",
    "Notifications.read",
  ],

  GROUND_TEAM: [
    "Devices.read", "Devices.view_history",
    "Sets.read",
    "Clients.read",
    "LifecycleRequests.read", "LifecycleRequests.create",
    "Inventory.read", "Inventory.create",
    "Requests.create",
    "Returns.read",
    "Catalogue.read",
    "Warehouses.read",
    "CustomLocations.read", "CustomLocations.create",
    "Notifications.read",
  ],
};

/**
 * 🧠 MAIN SYNC FUNCTION — idempotent, runs on every server start
 */
export async function syncPermissions() {
  console.log("[INIT] 🔐 Syncing permissions...");

  try {
    // 1. UPSERT ALL PERMISSIONS
    const permissionMap = {};
    for (const perm of ALL_PERMISSIONS) {
      const record = await prisma.permission.upsert({
        where: { module_operation: { module: perm.module, operation: perm.operation } },
        update: { description: perm.description },
        create: perm,
      });
      permissionMap[`${perm.module}.${perm.operation}`] = record;
    }
    console.log(`[INIT] ✅ Permissions synced: ${Object.keys(permissionMap).length}`);

    // 2. UPSERT ALL ROLES
    console.log("[INIT] 👥 Syncing roles...");
    const roleMap = {};
    for (const roleName of ROLE_LIST) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
      roleMap[roleName] = role;
    }
    console.log("[INIT] ✅ Roles synced");

    // 3. ASSIGN PERMISSIONS TO ROLES
    console.log("[INIT] 🔗 Syncing role-permissions...");

    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const role = roleMap[roleName];
      if (!role) continue;

      const permKeys = perms === "*" ? Object.keys(permissionMap) : perms;

      for (const key of permKeys) {
        const perm = permissionMap[key];
        if (!perm) {
          console.warn(`[INIT] ⚠️  Permission not found: ${key} (for role ${roleName})`);
          continue;
        }
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }

    console.log("[INIT] ✅ Role-permission mapping complete");

  } catch (error) {
    console.error("[INIT] ❌ Permission sync failed:", error.message);
    throw error;
  }
}