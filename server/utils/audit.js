const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function logAudit(userId, fileId, action, toUser = null) {
  console.log("🧾 Logging audit:", { userId, fileId, action, toUser });
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        fileId,
        action,
        toUser,
      },
    });
  } catch (err) {
    console.log("Failed to write audit log:", err);
  }
}

module.exports = { logAudit };
