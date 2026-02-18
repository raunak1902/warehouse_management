import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authMiddleware from "./middleware/auth.js";

// Import routes
import deviceRoutes from "./routes/devices.js";
import setsRouter from './routes/sets.js';
import migrateTypesRouter from './routes/migrateTypes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: [
    "http://localhost:5174",
    "http://10.156.23.45:5174",
    "https://10.156.23.45:5174"
  ],
  credentials: true
}));

app.use(express.json());

// ==========================================
// BASIC ROUTES
// ==========================================

app.get("/", (req, res) => {
  res.json({ message: "Backend is running 🚀" });
});

// 🔐 Protected Route
app.get("/test-db", authMiddleware, async (req, res) => {
  try {
    const roles = await prisma.role.findMany();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// 🔐 Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role.name
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API ROUTES
// ==========================================

// Device routes
app.use("/api/devices", deviceRoutes);

// Sets routes
app.use('/api/sets', setsRouter);

// Device type migration routes
app.use('/api/migrate-types', migrateTypesRouter);

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on network at port ${PORT}`);
});


// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});