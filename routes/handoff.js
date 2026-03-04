const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const HandoffRequest = require("../models/HandoffRequest");
const authMiddleware = require("../middleware/authMiddleware");

// ── POST /projects/:id/request-handoff — Request to take over a project ──────
router.post("/:id/request-handoff", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Can't request handoff on your own project
    if (project.authorId.toString() === req.userId) {
      return res.status(400).json({ message: "You cannot request a handoff on your own project" });
    }

    // Check for existing pending request from this user
    const existing = await HandoffRequest.findOne({
      projectId: project._id,
      requesterId: req.userId,
      status: "pending",
    });
    if (existing) {
      return res.status(400).json({ message: "You already have a pending request for this project" });
    }

    const request = new HandoffRequest({
      projectId: project._id,
      requesterId: req.userId,
      message: req.body.message || "",
    });

    await request.save();
    res.status(201).json({ message: "Handoff request submitted", request });
  } catch (err) {
    console.error("Request handoff error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /projects/:id/accept-handoff/:requestId — Original author accepts ──
router.patch("/:id/accept-handoff/:requestId", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("authorId", "name email");
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Only the current owner can accept
    if (project.currentOwnerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the current owner can accept a handoff" });
    }

    const handoffReq = await HandoffRequest.findById(req.params.requestId)
      .populate("requesterId", "name email");
    if (!handoffReq || handoffReq.status !== "pending") {
      return res.status(404).json({ message: "Pending handoff request not found" });
    }

    // Auto-generate the digital contract — original author baked in permanently
    const contractText = `
SWAPSHOP HANDOFF CONTRACT
=========================
Project: "${project.title}"
Original Author: ${project.authorId.name} (${project.authorId.email})
New Owner: ${handoffReq.requesterId.name} (${handoffReq.requesterId.email})
Date: ${new Date().toISOString()}

The original author retains permanent co-authorship credit for this project.
This record is immutable and stored in project metadata.
    `.trim();

    // Update handoff request
    handoffReq.status = "accepted";
    handoffReq.contractText = contractText;
    handoffReq.lockedAt = new Date();
    await handoffReq.save();

    // Transfer ownership — authorId stays the same (co-authorship preserved)
    project.currentOwnerId = handoffReq.requesterId._id;
    project.status = "handed-off";
    await project.save();

    // Reject all other pending requests for this project
    await HandoffRequest.updateMany(
      { projectId: project._id, status: "pending", _id: { $ne: handoffReq._id } },
      { status: "rejected" }
    );

    res.json({ message: "Handoff accepted", contract: contractText, project });
  } catch (err) {
    console.error("Accept handoff error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /projects/:id/reject-handoff/:requestId — Reject a request ─────────
router.patch("/:id/reject-handoff/:requestId", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.currentOwnerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const handoffReq = await HandoffRequest.findById(req.params.requestId);
    if (!handoffReq || handoffReq.status !== "pending") {
      return res.status(404).json({ message: "Pending request not found" });
    }

    handoffReq.status = "rejected";
    await handoffReq.save();

    res.json({ message: "Handoff request rejected" });
  } catch (err) {
    console.error("Reject handoff error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /projects/:id/contract — View the handoff contract ───────────────────
router.get("/:id/contract", authMiddleware, async (req, res) => {
  try {
    const contract = await HandoffRequest.findOne({
      projectId: req.params.id,
      status: "accepted",
    }).populate("requesterId", "name email");

    if (!contract) {
      return res.status(404).json({ message: "No accepted contract found for this project" });
    }

    res.json({ contract: contract.contractText, lockedAt: contract.lockedAt });
  } catch (err) {
    console.error("Get contract error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /projects/:id/requests — List all handoff requests (owner only) ───────
router.get("/:id/requests", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.currentOwnerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const requests = await HandoffRequest.find({ projectId: project._id })
      .populate("requesterId", "name email")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    console.error("List requests error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;