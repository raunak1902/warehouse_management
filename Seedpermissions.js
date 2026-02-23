/**
 * seedPermissions.js
 * ------------------
 * Run once:  node seedPermissions.js
 *
 * - Creates every permission that exists in your routes
 * - Assigns the correct subset to SuperAdmin, Manager, and GroundTeam
 * - Safe to re-run (upserts permissions, replaces role assignments)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// ALL PERMISSIONS
// module matches the resource; operation matches the HTTP action
// ─────────────────────────────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  // ── Users ──────────────────────────────────────────────────────────────────
  { module: "Users", operation: "create",  description: "Create new user accounts" },
  { module: "Users", operation: "read",    description: "View user list and details" },
  { module: "Users", operation: "update",  description: "Edit user information and status" },
  { module: "Users", operation: "delete",  description: "Delete user accounts" },

  // ── Roles ──────────────────────────────────────────────────────────────────
  { module: "Roles", operation: "create",  description: "Create new roles" },
  { module: "Roles", operation: "read",    description: "View roles" },
  { module: "Roles", operation: "update",  description: "Edit role details" },
  { module: "Roles", operation: "delete",  description: "Delete roles" },

  // ── Permissions ────────────────────────────────────────────────────────────
  { module: "Permissions", operation: "create",  description: "Create new permissions" },
  { module: "Permissions", operation: "read",    description: "View permissions" },
  { module: "Permissions", operation: "update",  description: "Edit permissions" },
  { module: "Permissions", operation: "delete",  description: "Delete permissions" },
  { module: "Permissions", operation: "assign",  description: "Assign permissions to roles" },

  // ── Devices ────────────────────────────────────────────────────────────────
  { module: "Devices", operation: "create",         description: "Add new devices to inventory" },
  { module: "Devices", operation: "read",           description: "View devices and their details" },
  { module: "Devices", operation: "update",         description: "Edit device information" },
  { module: "Devices", operation: "delete",         description: "Delete devices from inventory" },
  { module: "Devices", operation: "bulk_add",       description: "Bulk-add multiple devices at once" },
  { module: "Devices", operation: "assign",         description: "Assign devices directly to clients (Manager)" },
  { module: "Devices", operation: "request_assign", description: "Submit an assignment request (GroundTeam)" },
  { module: "Devices", operation: "approve_assign", description: "Approve or reject assignment requests" },
  { module: "Devices", operation: "request_deploy", description: "Submit a deployment request (GroundTeam)" },
  { module: "Devices", operation: "approve_deploy", description: "Approve or reject deployment requests" },
  { module: "Devices", operation: "request_return", description: "Submit a return request (GroundTeam)" },
  { module: "Devices", operation: "approve_return", description: "Approve or reject return requests" },
  { module: "Devices", operation: "view_history",   description: "View device lifecycle history" },

  // ── Sets ───────────────────────────────────────────────────────────────────
  { module: "Sets", operation: "create",      description: "Create device sets (MakeSets)" },
  { module: "Sets", operation: "read",        description: "View device sets" },
  { module: "Sets", operation: "update",      description: "Update set details and lifecycle" },
  { module: "Sets", operation: "delete",      description: "Delete or disassemble device sets" },
  { module: "Sets", operation: "disassemble", description: "Disassemble a set into individual devices" },

  // ── Clients ────────────────────────────────────────────────────────────────
  { module: "Clients", operation: "create",  description: "Create new client accounts" },
  { module: "Clients", operation: "read",    description: "View clients and their assigned devices" },
  { module: "Clients", operation: "update",  description: "Edit client information" },
  { module: "Clients", operation: "delete",  description: "Delete clients" },

  // ── Assignment Requests (the Assigning tab) ────────────────────────────────
  { module: "AssignmentRequests", operation: "create",  description: "Create assignment requests" },
  { module: "AssignmentRequests", operation: "read",    description: "View assignment requests" },
  { module: "AssignmentRequests", operation: "approve", description: "Approve assignment requests" },
  { module: "AssignmentRequests", operation: "reject",  description: "Reject assignment requests" },

  // ── Ground Requests (team request workflow) ────────────────────────────────
  { module: "GroundRequests", operation: "create",  description: "Submit ground team change requests" },
  { module: "GroundRequests", operation: "read",    description: "View ground team requests" },
  { module: "GroundRequests", operation: "approve", description: "Approve ground team requests" },
  { module: "GroundRequests", operation: "reject",  description: "Reject ground team requests" },

  // ── Reports / Dashboard ────────────────────────────────────────────────────
  { module: "Reports", operation: "read", description: "View dashboard statistics and reports" },

  // ── Barcode ────────────────────────────────────────────────────────────────
  { module: "Barcode", operation: "scan",     description: "Scan barcodes to look up devices" },
  { module: "Barcode", operation: "generate", description: "Generate and print barcodes" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROLE → PERMISSION MAPPING
// ─────────────────────────────────────────────────────────────────────────────

// SuperAdmin gets absolutely everything
const SUPERADMIN_PERMISSIONS = ALL_PERMISSIONS.map(p => `${p.module}.${p.operation}`);

// Manager: full CRUD on everything EXCEPT SuperAdmin panel (users/roles/permissions mgmt)
// Can approve/reject all requests
const MANAGER_PERMISSIONS = [
  // Devices — full CRUD + all approvals
  "Devices.create", "Devices.read", "Devices.update", "Devices.delete",
  "Devices.bulk_add", "Devices.assign",
  "Devices.approve_assign", "Devices.approve_deploy", "Devices.approve_return",
  "Devices.view_history",
  // Sets
  "Sets.create", "Sets.read", "Sets.update", "Sets.delete", "Sets.disassemble",
  // Clients
  "Clients.create", "Clients.read", "Clients.update", "Clients.delete",
  // Assignment Requests
  "AssignmentRequests.create", "AssignmentRequests.read",
  "AssignmentRequests.approve", "AssignmentRequests.reject",
  // Ground Requests — can view and approve/reject
  "GroundRequests.read", "GroundRequests.approve", "GroundRequests.reject",
  // Reports
  "Reports.read",
  // Barcode
  "Barcode.scan", "Barcode.generate",
];

// GroundTeam: view-only on most things, can only submit requests
const GROUNDTEAM_PERMISSIONS = [
  // Devices — view only, submit requests only
  "Devices.read", "Devices.view_history",
  "Devices.request_assign", "Devices.request_deploy", "Devices.request_return",
  // Sets — view only
  "Sets.read",
  // Clients — view only (needed for assigning page dropdowns)
  "Clients.read",
  // Assignment Requests — can create and view own
  "AssignmentRequests.create", "AssignmentRequests.read",
  // Ground Requests — can submit and view own
  "GroundRequests.create", "GroundRequests.read",
  // Reports
  "Reports.read",
  // Barcode
  "Barcode.scan",
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🌱 Starting permission seed...\n");

  // 1. Upsert all permissions
  console.log(`📋 Creating/updating ${ALL_PERMISSIONS.length} permissions...`);
  const permissionRecords = [];
  for (const perm of ALL_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { module_operation: { module: perm.module, operation: perm.operation } },
      update: { description: perm.description },
      create: perm,
    });
    permissionRecords.push(record);
    process.stdout.write(`  ✓ ${perm.module}.${perm.operation}\n`);
  }

  // Helper: get permission IDs for a list of "module.operation" keys
  const getIds = (keys) =>
    keys.map((key) => {
      const [module, operation] = key.split(".");
      const record = permissionRecords.find(
        (p) => p.module === module && p.operation === operation
      );
      if (!record) {
        console.warn(`  ⚠️  Permission not found: ${key}`);
        return null;
      }
      return record.id;
    }).filter(Boolean);

  // 2. Assign permissions to each role
  const roleAssignments = [
    { name: "SuperAdmin", keys: SUPERADMIN_PERMISSIONS },
    { name: "Manager",    keys: MANAGER_PERMISSIONS    },
    { name: "GroundTeam", keys: GROUNDTEAM_PERMISSIONS },
  ];

  console.log("\n🔐 Assigning permissions to roles...");
  for (const { name, keys } of roleAssignments) {
    const role = await prisma.role.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (!role) {
      console.warn(`  ⚠️  Role '${name}' not found in DB — skipping`);
      continue;
    }

    const permissionIds = getIds(keys);

    // Full replace: delete existing, insert new
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      }),
    ]);

    console.log(`  ✓ ${name}: ${permissionIds.length} permissions assigned`);
  }

  console.log("\n✅ Seed complete!\n");

  // 3. Print summary table
  console.log("Permission summary:");
  console.log("─".repeat(60));
  const modules = [...new Set(ALL_PERMISSIONS.map(p => p.module))];
  for (const module of modules) {
    const ops = ALL_PERMISSIONS.filter(p => p.module === module).map(p => p.operation);
    console.log(`  ${module.padEnd(22)} ${ops.join(", ")}`);
  }
  console.log("─".repeat(60));
}

seed()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());