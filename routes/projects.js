const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, description, category, percentComplete, missingLink, itemType, region } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const project = new Project({
      title, description, category,
      percentComplete: percentComplete || 0,
      missingLink, itemType: itemType || "research",
      region: region || "global",
      authorId: req.userId,
      currentOwnerId: req.userId,
    });
    await project.save();
    res.status(201).json({ message: "Project created", project });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: "Query param q is required" });
    const projects = await Project.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } }
    ).populate("authorId", "name email").sort({ score: { $meta: "textScore" } });
    res.json({ count: projects.length, projects });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status, category, region, itemType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = new RegExp(category, "i");
    if (region) filter.region = region;
    if (itemType) filter.itemType = itemType;
    const projects = await Project.find(filter)
      .populate("authorId", "name email")
      .populate("currentOwnerId", "name email")
      .sort({ createdAt: -1 });
    res.json({ count: projects.length, projects });
  } catch (err) {
    console.error("List projects error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("authorId", "name email")
      .populate("currentOwnerId", "name email");
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.currentOwnerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const allowed = ["title", "description", "category", "percentComplete", "missingLink", "status", "region"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) project[field] = req.body[field];
    });
    await project.save();
    res.json({ message: "Project updated", project });
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;