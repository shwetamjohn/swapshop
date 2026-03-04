const mongoose = require("mongoose");
const { Schema } = mongoose;

const handoffRequestSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  message: { type: String, trim: true }, // why requester wants the project
  contractText: { type: String },        // auto-generated on acceptance
  lockedAt: { type: Date },              // timestamp when contract was finalized
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("HandoffRequest", handoffRequestSchema);