const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileId:    { type: mongoose.Schema.Types.ObjectId, ref: "File", required: true },
  action:    { type: String, required: true },
  toUser:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
