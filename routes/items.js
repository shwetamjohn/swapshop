const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const FoodItem = require("../models/FoodItem");
const authMiddleware = require("../middleware/authMiddleware");

// ── GET /items — Unified listing across all item types ────────────────────────
// Query: ?type=research|durable|perishable&region=global|local
//
// research  → comes from Project model (Relay Board)
// durable   → comes from Project model with itemType=durable (textbooks, equipment)
// perishable → comes from FoodItem model (Proximity Pulse)
// no type   → returns everything merged

router.get("/", async (req, res) => {
  try {
    const { type, region } = req.query;
    let results = [];

    const fetchProjects = !type || type === "research" || type === "durable";
    const fetchFood = !type || type === "perishable";

    if (fetchProjects) {
      const projectFilter = {};
      if (type) projectFilter.itemType = type; // "research" or "durable"
      if (region) projectFilter.region = region;

      const projects = await Project.find(projectFilter)
        .populate("authorId", "name email")
        .populate("currentOwnerId", "name email")
        .sort({ createdAt: -1 });

      results = results.concat(
        projects.map((p) => ({
          ...p.toObject(),
          _itemCategory: "project", // tag so frontend knows what type this is
        }))
      );
    }

    if (fetchFood) {
      const foodItems = await FoodItem.find({ status: "available" })
        .populate("postedBy", "name email")
        .sort({ expiresAt: 1 }); // most urgent first

      results = results.concat(
        foodItems.map((f) => {
          const obj = f.toObject();
          obj.urgency = f.getUrgency();
          obj._itemCategory = "food";
          delete obj.dibsCode; // never expose pickup code in list
          return obj;
        })
      );
    }

    res.json({ count: results.length, items: results });
  } catch (err) {
    console.error("List items error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /items/durable — Post a durable item (textbook, charger, etc.) ───────
router.post("/durable", authMiddleware, async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    const item = new Project({
      title,
      description,
      category,
      itemType: "durable",
      region: "local",
      authorId: req.userId,
      currentOwnerId: req.userId,
      percentComplete: 0,
    });

    await item.save();
    res.status(201).json({ message: "Durable item posted", item });
  } catch (err) {
    console.error("Post durable error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;