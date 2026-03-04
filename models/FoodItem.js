const mongoose = require("mongoose");
const { Schema } = mongoose;

const foodItemSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

  // GeoJSON point — coordinates: [longitude, latitude]
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },

  expiresAt: { type: Date, required: true }, // drives TTL auto-deletion + urgency

  // Dibs system
  dibsBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  dibsAt: { type: Date, default: null },
  dibsCode: { type: String, default: null }, // 6-char private pickup code
  dibsExpiresAt: { type: Date, default: null }, // dibs auto-expire after 30 min

  status: {
    type: String,
    enum: ["available", "claimed", "collected"],
    default: "available",
  },

  itemType: { type: String, default: "perishable" },
  createdAt: { type: Date, default: Date.now },
});

// 2dsphere index required for $near geo queries
foodItemSchema.index({ location: "2dsphere" });

// TTL index — MongoDB auto-deletes documents when expiresAt is reached
foodItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Helper: derive urgency level from expiresAt
foodItemSchema.methods.getUrgency = function () {
  const hoursLeft = (this.expiresAt - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft > 2) return "green";
  if (hoursLeft > 1) return "yellow";
  return "red";
};

module.exports = mongoose.model("FoodItem", foodItemSchema);