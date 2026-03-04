const express = require("express");
const router = express.Router();
const FoodItem = require("../models/FoodItem");
const authMiddleware = require("../middleware/authMiddleware");

// Helper: generate a random 6-char alphanumeric pickup code
function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper: add urgency level to a food item object
function withUrgency(item) {
  const obj = item.toObject();
  obj.urgency = item.getUrgency();
  // Hide dibsCode from public view — only shown to the claimer
  delete obj.dibsCode;
  return obj;
}

// ── POST /food — Post a food/resource item ────────────────────────────────────
// Body: { title, description, lng, lat, expiresInHours }
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, description, lng, lat, expiresInHours } = req.body;

    if (!title || lng === undefined || lat === undefined || !expiresInHours) {
      return res.status(400).json({ message: "title, lng, lat, and expiresInHours are required" });
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const item = new FoodItem({
      title,
      description,
      postedBy: req.userId,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)], // [longitude, latitude]
      },
      expiresAt,
    });

    await item.save();
    res.status(201).json({ message: "Item posted", item: withUrgency(item) });
  } catch (err) {
    console.error("Post food error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /food/nearby — Geofenced query ────────────────────────────────────────
// Query: ?lat=12.9716&lng=77.5946&radius=5000 (radius in meters, default 5km)
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng query params are required" });
    }

    const maxDistance = parseInt(radius) || 5000; // default 5km

    const items = await FoodItem.find({
      status: "available",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: maxDistance,
        },
      },
    }).populate("postedBy", "name");

    // Add urgency and hide private dibs codes
    const result = items.map(withUrgency);
    res.json({ count: result.length, items: result });
  } catch (err) {
    console.error("Nearby food error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /food — List all available items (with urgency color) ─────────────────
router.get("/", async (req, res) => {
  try {
    const items = await FoodItem.find({ status: "available" })
      .populate("postedBy", "name")
      .sort({ expiresAt: 1 }); // most urgent first

    const result = items.map(withUrgency);
    res.json({ count: result.length, items: result });
  } catch (err) {
    console.error("List food error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /food/:id — Single item ───────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id).populate("postedBy", "name email");
    if (!item) return res.status(404).json({ message: "Item not found" });

    res.json(withUrgency(item));
  } catch (err) {
    console.error("Get food error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /food/:id/dibs — Claim an item (atomic, race-condition safe) ─────────
router.post("/:id/dibs", authMiddleware, async (req, res) => {
  try {
    // findOneAndUpdate with condition { dibsBy: null } ensures only ONE person wins
    // even if two requests arrive at the exact same time
    const item = await FoodItem.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "available",
        dibsBy: null, // ← this is the race-condition guard
      },
      {
        dibsBy: req.userId,
        dibsAt: new Date(),
        dibsCode: randomCode(),
        dibsExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min to collect
        status: "claimed",
      },
      { new: true }
    );

    if (!item) {
      return res.status(409).json({ message: "Item already claimed or not available" });
    }

    // Return the private pickup code ONLY to the claimer
    res.json({
      message: "Dibs claimed! Show this code to collect your item.",
      dibsCode: item.dibsCode,
      collectBy: item.dibsExpiresAt,
    });
  } catch (err) {
    console.error("Dibs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /food/:id/dibs — Release a claim (if you change your mind) ─────────
router.delete("/:id/dibs", authMiddleware, async (req, res) => {
  try {
    const item = await FoodItem.findOne({ _id: req.params.id, dibsBy: req.userId });

    if (!item) {
      return res.status(404).json({ message: "No active dibs found for this user on this item" });
    }

    item.dibsBy = null;
    item.dibsAt = null;
    item.dibsCode = null;
    item.dibsExpiresAt = null;
    item.status = "available";
    await item.save();

    res.json({ message: "Dibs released — item is available again" });
  } catch (err) {
    console.error("Release dibs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /food/:id/dibs-code — Get your pickup code (claimer only) ─────────────
router.get("/:id/dibs-code", authMiddleware, async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (!item.dibsBy || item.dibsBy.toString() !== req.userId) {
      return res.status(403).json({ message: "You haven't claimed this item" });
    }

    res.json({
      dibsCode: item.dibsCode,
      collectBy: item.dibsExpiresAt,
      item: item.title,
    });
  } catch (err) {
    console.error("Get dibs code error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /food/:id/collected — Mark as collected (poster confirms pickup) ────
router.patch("/:id/collected", authMiddleware, async (req, res) => {
  try {
    const item = await FoodItem.findOne({ _id: req.params.id, postedBy: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found or not yours" });

    item.status = "collected";
    await item.save();

    res.json({ message: "Item marked as collected" });
  } catch (err) {
    console.error("Collected error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;