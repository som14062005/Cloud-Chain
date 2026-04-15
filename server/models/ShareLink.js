const mongoose = require("mongoose");

const shareLinkSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: "File", required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },   // when link dies
  maxUses: { type: Number, default: 1 },       // e.g. 1 = one-time link
  usedCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ShareLink", shareLinkSchema);
