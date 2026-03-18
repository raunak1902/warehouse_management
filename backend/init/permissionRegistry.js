import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 🔐 CENTRAL PERMISSION REGISTRY
 * 
 * This is the SINGLE SOURCE OF TRUTH for all permissions in the system.
 * 
 * When you add new features/modules:
 * 1. Add permissions here
 * 2. Run the server
 * 3. Permissions will auto-sync to the database
 * 
 * Permission format: { module, operation, description }
 */
export const ALL_PERMISSIONS = [
  // ═══════════════════════════════════════════════════════════════
  // DEVICES
  // ═══════════════════════════════════════════════════════════════
  { module: "Devices", operation: "create", description: "Create devices" },
  { module: "Devices", operation: "read", description: "View devices" },
  { module: "Devices", operation: "update", description: "Update devices" },
  { module: "Devices", operation: "delete", description: "Delete devices" },

  // ═══════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════
  { module: "Clients", operation: "create", description: "Create clients" },
  { module: "Clients", operation: "read", description: "View clients" },
  { module: "Clients", operation: "update", description: "Update clients" },
  { module: "Clients", operation: "delete", description: "Delete clients" },

  // ═══════════════════════════════════════════════════════════════
  // REQUESTS
  // ═══════════════════════════════════════════════════════════════
  { module: "Requests", operation: "create", description: "Create requests" },
  { module: "Requests", operation: "approve", description: "Approve requests" },
  { module: "Requests", operation: "reject", description: "Reject requests" },

  // ═══════════════════════════════════════════════════════════════
  // INVENTORY
  // ═══════════════════════════════════════════════════════════════
  { module: "Inventory", operation: "create", description: "Add inventory" },
  { module: "Inventory", operation: "read", description: "View inventory" },
  { module: "Inventory", operation: "update", description: "Update inventory" },

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════
  { module: "Lifecycle", operation: "create", description: "Create lifecycle events" },
  { module: "Lifecycle", operation: "update", description: "Update lifecycle" },

  // ═══════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════
  { module: "Users", operation: "create", description: "Create users" },
  { module: "Users", operation: "read", description: "View users" },
  { module: "Users", operation: "update", description: "Update users" },
  { module: "Users", operation: "delete", description: "Delete users" },

  // ═══════════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════════
  { module: "Roles", operation: "create", description: "Create roles" },
  { module: "Roles", operation: "read", description: "View roles" },
  { module: "Roles", operation: "update", description: "Update roles" },
  { module: "Roles", operation: "delete", description: "Delete roles" },

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════
  { module: "Notifications", operation: "read", description: "View notifications" },

  // ═══════════════════════════════════════════════════════════════
  // WAREHOUSES (NEW - Added for warehouse management)
  // ═══════════════════════════════════════════════════════════════
  { module: "Warehouses", operation: "create", description: "Create warehouses" },
  { module: "Warehouses", operation: "read", description: "View warehouses" },
  { module: "Warehouses", operation: "update", description: "Update warehouses" },
  { module: "Warehouses", operation: "delete", description: "Delete warehouses" },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM LOCATIONS (NEW - Added for custom location management)
  // ═══════════════════════════════════════════════════════════════
  { module: "CustomLocations", operation: "create", description: "Create custom locations" },
  { module: "CustomLocations", operation: "read", description: "View custom locations" },
  { module: "CustomLocations", operation: "update", description: "Update custom locations" },
  { module: "CustomLocations", operation: "delete", description: "Delete custom locations" },
];

/**
 * 👥 ROLE LIST
 * 
 * Define all system roles here.
 * These will be auto-created on server start.
 */
export const ROLE_LIST = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "USER"
];

/**
 * 🧠 MAIN SYNC FUNCTION
 * 
 * This function:
 * 1. Creates/updates all permissions from ALL_PERMISSIONS
 * 2. Creates all roles from ROLE_LIST
 * 3. Maps permissions to roles based on business logic
 * 
 * IDEMPOTENT: Safe to run multiple times without duplicating data
 */
export async function syncPermissions() {
  console.log("[INIT] 🔐 Syncing permissions...");

  try {
    // -----------------------------------------
    // 1. UPSERT PERMISSIONS
    // -----------------------------------------
    const permissionMap = {};

    for (const perm of ALL_PERMISSIONS) {
      const record = await prisma.permission.upsert({
        where: {
          module_operation: {
            module: perm.module,
            operation: perm.operation
          }
        },
        update: {
          description: perm.description
        },
        create: perm
      });

      permissionMap[`${perm.module}_${perm.operation}`] = record;
    }

    console.log(`[INIT] ✅ Permissions synced: ${Object.keys(permissionMap).length}`);

    // -----------------------------------------
    // 2. UPSERT ROLES
    // -----------------------------------------
    console.log("[INIT] 👥 Syncing roles...");

    const roleMap = {};

    for (const roleName of ROLE_LIST) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName }
      });

      roleMap[roleName] = role;
    }

    console.log("[INIT] ✅ Roles synced");

    // -----------------------------------------
    // 3. ROLE-PERMISSION MAPPING
    // -----------------------------------------
    console.log("[INIT] 🔗 Syncing role-permissions...");

    const superAdmin = roleMap["SUPER_ADMIN"];
    const admin = roleMap["ADMIN"];
    const manager = roleMap["MANAGER"];
    const user = roleMap["USER"];

    for (const key in permissionMap) {
      const perm = permissionMap[key];

      // ═══════════════════════════════════════════════════════════
      // SUPER_ADMIN → ALL PERMISSIONS
      // ═══════════════════════════════════════════════════════════
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdmin.id,
            permissionId: perm.id
          }
        },
        update: {},
        create: {
          roleId: superAdmin.id,
          permissionId: perm.id
        }
      });

      // ═══════════════════════════════════════════════════════════
      // ADMIN → Almost all (except critical deletions)
      // ═══════════════════════════════════════════════════════════
      if (!["Roles_delete"].includes(key)) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: admin.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: admin.id,
            permissionId: perm.id
          }
        });
      }

      // ═══════════════════════════════════════════════════════════
      // MANAGER → Limited (read, create, and request-related)
      // ═══════════════════════════════════════════════════════════
      if (
        perm.operation === "read" ||
        perm.operation === "create" ||
        perm.module === "Requests"
      ) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: manager.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: manager.id,
            permissionId: perm.id
          }
        });
      }

      // ═══════════════════════════════════════════════════════════
      // USER → Read-only access
      // ═══════════════════════════════════════════════════════════
      if (perm.operation === "read") {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: user.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: user.id,
            permissionId: perm.id
          }
        });
      }
    }

    console.log("[INIT] ✅ Role-permission mapping complete");

  } catch (error) {
    console.error("[INIT] ❌ Permission sync failed:", error.message);
    throw error;
  }
}