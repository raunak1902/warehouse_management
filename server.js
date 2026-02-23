import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authMiddleware from "./middleware/auth.js";

// Routes
import deviceRoutes             from "./routes/devices.js";
import setsRouter               from "./routes/sets.js";
import migrateTypesRouter       from "./routes/migrateTypes.js";
import assignmentRequestsRouter from "./routes/Assignmentrequests.js";
import clientsRouter            from "./routes/clients.js";
import usersRouter              from "./routes/users.js";
import rolesRouter              from "./routes/roles.js";
import permissionsRouter        from "./routes/Permissions.js";
import groundRequestsRouter     from "./routes/groundRequests.js";

dotenv.config();

const app    = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: [
    "http://localhost:5174",
    "http://10.156.23.45:5174",
    "https://10.156.23.45:5174",
  ],
  credentials: true,
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ message: "Backend is running 🚀" }));

// ── Login ─────────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
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
      { userId: user.id, role: user.role.name },
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
app.use("/api/assignment-requests", assignmentRequestsRouter);
app.use("/api/clients",             clientsRouter);
app.use("/api/users",               usersRouter);
app.use("/api/roles",               rolesRouter);
app.use("/api/permissions",         permissionsRouter);
app.use("/api/ground-requests",     groundRequestsRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error:   "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});