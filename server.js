require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
const cors = require("cors");
app.use(cors()); // allow all origins for now
app.use(express.json());

// ── Environment validation ────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!JWT_SECRET || !MONGO_URI) {
  console.error("❌ Missing JWT_SECRET or MONGO_URI in .env file");
  process.exit(1);
}

// ── Database ──────────────────────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Database connected"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
  });

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const handoffRoutes = require("./routes/handoff");
const foodRoutes = require("./routes/food");
const itemRoutes = require("./routes/items");
const dashboardRoutes = require("./routes/dashboard");

app.get("/", (req, res) => res.send("SwapShop API is running 🚀"));

app.use("/auth", authRoutes);           // POST /auth/signup, POST /auth/login
app.use("/projects", projectRoutes);    // CRUD + search for Relay Board
app.use("/projects", handoffRoutes);    // Handoff protocol on top of projects
app.use("/food", foodRoutes);           // Proximity Pulse + Dibs system
app.use("/items", itemRoutes);
const dashboardRoutes = require("./routes/dashboard");
app.use("/dashboard", dashboardRoutes);          // Unified item listing (Day 8)
app.use("/dashboard", dashboardRoutes); // Impact metrics + leaderboard (Day 9)

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});