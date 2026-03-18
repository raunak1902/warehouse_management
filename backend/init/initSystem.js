// backend/init/initSystem.js

import bcrypt from "bcryptjs"; // ✅ FIXED: Changed from "bcrypt" to "bcryptjs" to match server.js
import { PrismaClient } from "@prisma/client";
import { syncPermissions } from "./permissionRegistry.js";

const prisma = new PrismaClient();

/**
 * 🚀 SYSTEM INITIALIZATION
 * 
 * This function runs every time the server starts and ensures:
 * 1. All permissions are synced from the registry
 * 2. All roles are created with proper permission mappings
 * 3. A SuperAdmin account exists for first login
 * 
 * This is IDEMPOTENT - safe to run multiple times without duplicating data
 */
export async function initSystem() {
  try {
    console.log("\n[INIT] 🚀 Starting system initialization...");

    // -----------------------------------------
    // VALIDATE REQUIRED ENVIRONMENT VARIABLES
    // -----------------------------------------
    const requiredEnvVars = [
      'SUPERADMIN_EMAIL',
      'SUPERADMIN_PASSWORD',
      'SUPERADMIN_NAME',
      'JWT_SECRET',
      'DATABASE_URL'
    ];

    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate password strength
    if (process.env.SUPERADMIN_PASSWORD.length < 12) {
      console.warn("[INIT] ⚠️  WARNING: SuperAdmin password is weak (should be at least 12 characters)");
      console.warn("[INIT] ⚠️  Please change it after first login!");
    }

    // -----------------------------------------
    // STEP 1: SYNC PERMISSIONS + ROLES + MAPPINGS
    // -----------------------------------------
    await syncPermissions();

    // -----------------------------------------
    // STEP 2: CHECK IF SUPERADMIN EXISTS
    // -----------------------------------------
    // Find SUPER_ADMIN role
    const superAdminRole = await prisma.role.findUnique({
      where: { name: "SUPER_ADMIN" }
    });

    if (!superAdminRole) {
      throw new Error("❌ SUPER_ADMIN role not found. Permission sync failed.");
    }

    // Check if SuperAdmin user already exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { 
        roleId: superAdminRole.id,
        email: process.env.SUPERADMIN_EMAIL 
      }
    });

    if (!existingSuperAdmin) {
      console.log("[INIT] ⚠️  No SuperAdmin found → creating...");

      // Hash password securely
      const hashedPassword = await bcrypt.hash(
        process.env.SUPERADMIN_PASSWORD,
        10
      );

      // Create Super Admin
      await prisma.user.create({
        data: {
          name: process.env.SUPERADMIN_NAME || "Super Admin",
          email: process.env.SUPERADMIN_EMAIL,
          password: hashedPassword,
          roleId: superAdminRole.id,
          status: "ACTIVE"
        }
      });

      console.log("[INIT] ✅ SuperAdmin created successfully");
      console.log(`[INIT] 📧 Email: ${process.env.SUPERADMIN_EMAIL}`);
      console.log("[INIT] 🔐 IMPORTANT: Change password after first login!");
    } else {
      console.log("[INIT] 👑 SuperAdmin already exists → skipping creation");
      console.log(`[INIT] 📧 Email: ${existingSuperAdmin.email}`);
    }

    console.log("[INIT] ✅ System initialization complete\n");

  } catch (error) {
    console.error("[INIT] ❌ Initialization failed:", error.message);
    console.error("[INIT] Stack trace:", error.stack);
    throw error; // Re-throw to stop server startup
  } finally {
    // Don't disconnect here - we need the connection for the rest of the app
    // await prisma.$disconnect();
  }
}