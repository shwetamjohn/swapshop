const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },

  // Day 12 — Role-based access
  // "user"     → basic access, Proximity Pulse only
  // "verified" → credential-verified, can access Relay Board
  // "admin"    → full access
  role: {
    type: String,
    enum: ["user", "verified", "admin"],
    default: "user",
  },

  // Trust badge (computed from stats in dashboard, stored for quick access)
  trustScore: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);