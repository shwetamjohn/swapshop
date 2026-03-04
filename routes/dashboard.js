const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const FoodItem = require("../models/FoodItem");
const HandoffRequest = require("../models/HandoffRequest");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// ── GET /dashboard — Current user's impact metrics ───────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Projects this user created
    const myProjects = await Project.aggregate([
      { $match: { authorId: { $toObjectId: userId } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Projects this user is currently working on (as currentOwner but not author)
    const assistingProjects = await Project.find({
      currentOwnerId: userId,
      authorId: { $ne: userId },
      status: { $in: ["active", "handed-off"] },
    }).populate("authorId", "name").select("title percentComplete status");

    // Handoffs completed by this user (projects they took over and finished)
    const completedHandoffs = await HandoffRequest.countDocuments({
      requesterId: userId,
      status: "accepted",
    });

    // Food items this user donated
    const foodDonated = await FoodItem.countDocuments({ postedBy: userId });

    // Food items this user claimed/collected
    const foodClaimed = await FoodItem.countDocuments({ dibsBy: userId });

    // Active food listings (still available, posted by user)
    const activeFoodListings = await FoodItem.find({
      postedBy: userId,
      status: "available",
    }).select("title expiresAt");

    // Format project stats
    const projectStats = { active: 0, "handed-off": 0, complete: 0 };
    myProjects.forEach((p) => { projectStats[p._id] = p.count; });

    res.json({
      globalImpact: {
        projectsCreated: Object.values(projectStats).reduce((a, b) => a + b, 0),
        projectsCompleted: projectStats.complete,
        projectsHandedOff: projectStats["handed-off"],
        currentlyAssisting: assistingProjects.length,
        assistingProjects,
        handoffsCompleted: completedHandoffs,
      },
      localImpact: {
        foodItemsDonated: foodDonated,
        foodItemsClaimed: foodClaimed,
        activeFoodListings: activeFoodListings.length,
        activeFoodItems: activeFoodListings,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /dashboard/user/:id — Public stats for any user ──────────────────────
router.get("/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const projectsCreated = await Project.countDocuments({ authorId: userId });
    const projectsCompleted = await Project.countDocuments({ authorId: userId, status: "complete" });
    const handoffsCompleted = await HandoffRequest.countDocuments({ requesterId: userId, status: "accepted" });
    const foodDonated = await FoodItem.countDocuments({ postedBy: userId });

    // Trust score: 10pts per completed project, 15pts per completed handoff, 5pts per food donated
    const trustScore = (projectsCompleted * 10) + (handoffsCompleted * 15) + (foodDonated * 5);

    res.json({
      user,
      stats: {
        projectsCreated,
        projectsCompleted,
        handoffsCompleted,
        foodDonated,
        trustScore,
        trustBadge: trustScore >= 100 ? "gold" : trustScore >= 50 ? "silver" : "bronze",
      },
    });
  } catch (err) {
    console.error("User stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /dashboard/leaderboard — Top contributors ────────────────────────────
router.get("/leaderboard", async (req, res) => {
  try {
    // Aggregate trust scores across all users
    const [projectScores, handoffScores, foodScores] = await Promise.all([
      Project.aggregate([
        { $match: { status: "complete" } },
        { $group: { _id: "$authorId", completedProjects: { $sum: 1 } } },
      ]),
      HandoffRequest.aggregate([
        { $match: { status: "accepted" } },
        { $group: { _id: "$requesterId", completedHandoffs: { $sum: 1 } } },
      ]),
      FoodItem.aggregate([
        { $group: { _id: "$postedBy", foodDonated: { $sum: 1 } } },
      ]),
    ]);

    // Merge scores by userId
    const scoreMap = {};
    projectScores.forEach(({ _id, completedProjects }) => {
      const id = _id.toString();
      scoreMap[id] = (scoreMap[id] || 0) + completedProjects * 10;
    });
    handoffScores.forEach(({ _id, completedHandoffs }) => {
      const id = _id.toString();
      scoreMap[id] = (scoreMap[id] || 0) + completedHandoffs * 15;
    });
    foodScores.forEach(({ _id, foodDonated }) => {
      const id = _id.toString();
      scoreMap[id] = (scoreMap[id] || 0) + foodDonated * 5;
    });

    // Get top 10 user IDs sorted by score
    const topIds = Object.entries(scoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    const users = await User.find({ _id: { $in: topIds } }).select("name email");

    const leaderboard = users.map((u) => ({
      user: { _id: u._id, name: u.name, email: u.email },
      trustScore: scoreMap[u._id.toString()] || 0,
    })).sort((a, b) => b.trustScore - a.trustScore);

    res.json({ leaderboard });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;