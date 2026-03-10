const mongoose = require("mongoose");

const accessSchema = new mongoose.Schema({
  fromId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  toId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileId:    { type: mongoose.Schema.Types.ObjectId, ref: "File", required: true },
  grantedAt: { type: Date, default: Date.now },
  expiryTime:{ type: Date, default: null },
});

// prevent duplicate grants
accessSchema.index({ fromId: 1, toId: 1, fileId: 1 }, { unique: true });

module.exports = mongoose.model("Access", accessSchema);
