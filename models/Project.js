const mongoose = require("mongoose");
const { Schema } = mongoose;

const projectSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true },
  percentComplete: { type: Number, default: 0, min: 0, max: 100 },
  missingLink: { type: String, trim: true }, // e.g. "Needs Climate Data"
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  currentOwnerId: { type: Schema.Types.ObjectId, ref: "User" }, // changes after handoff
  status: {
    type: String,
    enum: ["active", "handed-off", "complete"],
    default: "active",
  },
  itemType: {
    type: String,
    enum: ["research", "durable", "perishable"],
    default: "research",
  },
  region: {
    type: String,
    enum: ["global", "local"],
    default: "global",
  },
  createdAt: { type: Date, default: Date.now },
});

// Text index for semantic search (Day 10)
projectSchema.index({ title: "text", description: "text", missingLink: "text", category: "text" });
// Index for filtering by status/category
projectSchema.index({ status: 1, category: 1 });

module.exports = mongoose.model("Project", projectSchema);