import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import authMiddleware from "./middleware/auth.js";
import { initSystem } from "./init/initSystem.js";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Routes
import deviceRoutes             from "./routes/devices.js";
import setsRouter               from "./routes/sets.js";
import migrateTypesRouter       from "./routes/migrateTypes.js";

import clientsRouter            from "./routes/clients.js";
import usersRouter              from "./routes/users.js";
import rolesRouter              from "./routes/roles.js";
import permissionsRouter        from "./routes/Permissions.js";

import lifecycleRequestsRouter  from "./routes/lifecycleRequests.js";
import notificationsRouter      from "./routes/notifications.js";
import returnsRouter            from "./routes/returns.js";
import catalogueRouter          from "./routes/catalogue.js";
import inventoryRequestsRouter  from "./routes/inventoryRequests.js";
import deletionRequestsRouter   from "./routes/deletionRequests.js";

// ═══ Warehouse & Location Routes ═══
import warehouseRoutes          from "./routes/warehouses.js";
import customLocationRoutes     from "./routes/customLocations.js";

import { startSubscriptionCron } from "./cron/subscriptionReminders.js";
import { seedBuiltinTypes }       from "./routes/catalogue.js";

dotenv.config();

const app    = express();
app.set('trust proxy', 1);
const prisma = new PrismaClient();

// ═══ CORS Configuration (Production-Ready) ═══
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ["http://localhost:5174"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// ═══ Rate Limiting for Login (Security) ═══
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Static: serve uploaded proof files ───────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ message: "Backend is running 🚀" }));

// ── Health Check with DB Connection Test ──────────────────────────────────────
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: "unhealthy",
      database: "disconnected",
      error: error.message 
    });
  }
});

// ── Login (with Rate Limiting) ────────────────────────────────────────────────
app.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.status?.toLowerCase() === "inactive") {
      return res.status(403).json({ message: "Account is inactive. Contact your administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { userId: user.id, role: user.role.name, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role.name,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/devices",             deviceRoutes);
app.use("/api/sets",                setsRouter);
app.use("/api/migrate-types",       migrateTypesRouter);

app.use("/api/clients",             clientsRouter);
app.use("/api/users",               usersRouter);
app.use("/api/roles",               rolesRouter);
app.use("/api/permissions",         permissionsRouter);

app.use("/api/lifecycle-requests",   lifecycleRequestsRouter);
app.use("/api/notifications",        notificationsRouter);
app.use("/api/returns",              returnsRouter);
app.use("/api/catalogue",            catalogueRouter);
app.use("/api/inventory-requests",   inventoryRequestsRouter);
app.use("/api/deletion-requests",    deletionRequestsRouter);

// ═══ Warehouse & Location Routes ═══
app.use("/api/warehouses",           warehouseRoutes);
app.use("/api/custom-locations",     customLocationRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error:   "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 🔥 STEP 1: RUN SYSTEM INIT (Critical - creates permissions, roles, SuperAdmin)
    await initSystem();

    // 🔥 STEP 2: START SERVER
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);

      // Seed builtin types and start cron jobs
      seedBuiltinTypes().catch(console.error);
      startSubscriptionCron();
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  console.log("✅ Database connection closed");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 SIGTERM received, shutting down...");
  await prisma.$disconnect();
  console.log("✅ Database connection closed");
  process.exit(0);
});