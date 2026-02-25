const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const verifyJWT = require("../utils/auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { logAudit } = require("../utils/audit");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.use(verifyJWT);

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  const email = req.user.email;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "consentchain_files",
      resource_type: "auto",
    });

    const createdFile = await prisma.file.create({
      data: {
        name: file.originalname,
        url: result.secure_url,
        ownerId: user.id,
        publicId: result.public_id,
      },
    });

    res.json({ message: "File uploaded!", file: createdFile });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/grant", async (req, res) => {
  const { toEmail, fileId, expiryTime } = req.body;
  const fromEmail = req.user.email;

  if (!fileId || !toEmail)
    return res.status(400).json({ error: "Missing toEmail or fileId" });

  try {
    const fromUser = await prisma.user.findUnique({
      where: { email: fromEmail },
    });
    const toUser = await prisma.user.findUnique({ where: { email: toEmail } });

    if (!fromUser || !toUser)
      return res.status(404).json({ error: "User not found" });

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: "File not found" });

    if (file.ownerId !== fromUser.id)
      return res.status(403).json({ error: "You do not own this file" });

    const existingAccess = await prisma.access.findFirst({
      where: {
        fromId: fromUser.id,
        toId: toUser.id,
        fileId,
      },
    });

    if (existingAccess)
      return res.status(400).json({ error: "Access already granted" });

    await prisma.access.create({
      data: {
        fromId: fromUser.id,
        toId: toUser.id,
        fileId,
        expiryTime: expiryTime ? new Date(expiryTime) : null,
      },
    });

    await logAudit(fromUser.id, fileId, "granted", toUser.id);

    res.json({ message: `Access granted to ${toEmail} for file ${file.name}` });
  } catch (error) {
    console.error("Grant access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/revoke", async (req, res) => {
  const { toEmail, fileId } = req.body;
  const fromEmail = req.user.email;

  if (!fileId || !toEmail) {
    return res.status(400).json({ error: "Missing toEmail or fileId" });
  }

  try {
    console.log("Revoke Request →", { fromEmail, toEmail, fileId });

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { email: fromEmail } }),
      prisma.user.findUnique({ where: { email: toEmail } }),
    ]);

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: "User(s) not found" });
    }

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.ownerId !== fromUser.id) {
      return res.status(403).json({ error: "You do not own this file" });
    }

    const accessRecord = await prisma.access.findFirst({
      where: {
        fileId: fileId,
        fromId: fromUser.id,
        toId: toUser.id,
      },
    });

    if (!accessRecord) {
      return res.status(400).json({ error: "Access not found to revoke" });
    }

    await prisma.access.delete({
      where: {
        id: accessRecord.id,
      },
    });

    await logAudit(fromUser.id, fileId, "revoked", toUser.id);

    res.json({ message: `Access revoked from ${toEmail}` });
  } catch (error) {
    console.error("Revoke access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/logs/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const email = req.user.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: "File not found" });

    if (file.ownerId !== user.id)
      return res
        .status(403)
        .json({ error: "You do not have access to this file's logs" });

    // Download logs
    const downloadLogs = await prisma.log.findMany({
      where: { fileId },
      include: { user: true },
      orderBy: { timestamp: "desc" },
    });

    // Audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { fileId },
      include: { user: true },
      orderBy: { timestamp: "desc" },
    });

    const toUserIds = [
      ...new Set(auditLogs.map((log) => log.toUser).filter(Boolean)),
    ];

    console.log(
      auditLogs.map((log) => ({ action: log.action, toUser: log.toUser }))
    );

    const toUsers = await prisma.user.findMany({
      where: { id: { in: toUserIds } },
    });
    const toUserMap = Object.fromEntries(
      toUsers.map((user) => [user.id, user.email])
    );

    const formattedDownloads = downloadLogs.map((log) => ({
      type: "download",
      by: log.user.name,
      at: log.timestamp,
    }));

    const formattedAudits = auditLogs.map((log) => ({
      type: log.action, // granted/revoked
      by: log.user.name,
      to: log.toUser ? toUserMap[log.toUser] ?? "Unknown" : null,
      at: log.timestamp,
    }));

    res.json({ logs: [...formattedDownloads, ...formattedAudits] });
  } catch (error) {
    console.error("Fetch logs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/download/:fileId", async (req, res) => {
  const email = req.user.email;
  const { fileId } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { accesses: true },
    });
    if (!file) return res.status(404).json({ error: "File not found" });

    const isOwner = file.ownerId === user.id;

    const access = file.accesses.find((a) => a.toId === user.id);

    if (!isOwner && !access) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (access?.expiryTime && new Date() > new Date(access.expiryTime)) {
      await prisma.auditLog.create({
        data: {
          userId: access.fromId,
          fileId: file.id,
          action: "expired",
          toUser: user.id,
          timestamp: new Date(),
        },
      });

      return res.status(403).json({ error: "Access expired" });
    }

    await prisma.log.create({
      data: {
        fileId: file.id,
        userId: user.id,
        timestamp: new Date(),
      },
    });

    res.json({ url: file.url });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get files owned by the authenticated user
router.get("/myfiles", async (req, res) => {
  const email = req.user.email;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { files: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ files: user.files });
  } catch (error) {
    console.error("My files error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get files shared with the authenticated user
router.get("/shared", async (req, res) => {
  const email = req.user.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const accesses = await prisma.access.findMany({
      where: { toId: user.id },
      include: {
        from: true,
        file: true,
      },
    });

    const sharedFiles = accesses.map((a) => ({
      id: a.file.id,
      owner: a.from.name,
      filename: a.file.name,
    }));

    res.json({ sharedFiles });
  } catch (error) {
    console.error("Shared files error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /analytics/summary
router.get("/analytics/summary", async (req, res) => {
  const email = req.user.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get all files owned by the user
    const files = await prisma.file.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true },
    });

    const fileIds = files.map((f) => f.id);

    // Get logs for all files owned by user
    const logs = await prisma.log.findMany({
      where: { fileId: { in: fileIds } },
      select: { fileId: true, timestamp: true },
    });

    // Process analytics
    const fileDownloads = {};
    const dailyDownloads = {};

    for (const log of logs) {
      fileDownloads[log.fileId] = (fileDownloads[log.fileId] || 0) + 1;

      const date = log.timestamp.toISOString().slice(0, 10);
      dailyDownloads[date] = (dailyDownloads[date] || 0) + 1;
    }

    const mostAccessed = files.map((file) => ({
      fileName: file.name,
      downloadCount: fileDownloads[file.id] || 0,
    }));

    mostAccessed.sort((a, b) => b.downloadCount - a.downloadCount);

    const accessPattern = Object.entries(dailyDownloads)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totalDownloads: logs.length,
      mostAccessed,
      accessPattern,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

module.exports = router;
