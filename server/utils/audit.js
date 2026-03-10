const AuditLog = require("../models/AuditLog");

async function logAudit(userId, fileId, action, toUser = null) {
  console.log("🧾 Logging audit:", { userId, fileId, action, toUser });
  try {
    await AuditLog.create({ userId, fileId, action, toUser });
  } catch (err) {
    console.log("Failed to write audit log:", err);
  }
}

module.exports = { logAudit };
