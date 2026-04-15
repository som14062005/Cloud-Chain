const express = require("express");
const router = express.Router();
const verifyJWT = require("../utils/auth");
const AWS = require('aws-sdk');
const { logAudit } = require("../utils/audit");
const User = require("../models/User");
const File = require("../models/File");
const Access = require("../models/Access");
const Log = require("../models/Log");
const AuditLog = require("../models/AuditLog");
const { sendEmail } = require("../utils/mailer");
const crypto = require("crypto");
const ShareLink = require("../models/ShareLink");

const s3 = new AWS.S3({ region: process.env.AWS_REGION });

// ─── CRON: EXPIRE ACCESSES (PUBLIC) ───────────────────────────────────────────
router.post("/cron/expire", async (req, res) => {
  try {
    const expiredGrants = await Access.find({
      expiryTime: { $lt: new Date(), $ne: null }
    }).populate('fromId toId fileId');

    let expiredCount = 0;

    for (const grant of expiredGrants) {
      const owner = grant.fromId;
      const recipient = grant.toId;
      const file = grant.fileId;

      // ✅ Email OWNER
      await sendEmail({
        to: owner.email,
        subject: `ConsentChain: Access Expired — ${file.name}`,
        body: `Hi ${owner.name || owner.email},\n\nYour shared access to "${file.name}" for ${recipient.email} has expired.\n\n— ConsentChain`
      });

      // ✅ Email RECIPIENT  
      await sendEmail({
        to: recipient.email,
        subject: `ConsentChain: Access Expired — ${file.name}`,
        body: `Hi ${recipient.name || recipient.email},\n\nYour access to "${file.name}" (shared by ${owner.email}) has expired.\n\n— ConsentChain`
      });

      // Mark expired
      grant.expiryTime = null;
      await grant.save();
      expiredCount++;
    }

    res.json({ expiredCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── RESOLVE SHARE LINK (PUBLIC) ─────────────────────────────────────
// ─── RESOLVE SHARE LINK (PUBLIC) ─────────────────────────────────────
router.get("/link/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const link = await ShareLink.findOne({ token }).populate("fileId");
    if (!link || !link.fileId)
      return res.status(404).json({ error: "Link not found" });

    // ✅ Only check expiry — no usedCount check
    if (new Date() > link.expiresAt)
      return res.status(410).json({ error: "Link expired" });

    const file = link.fileId;
    const s3Url = s3.getSignedUrl("getObject", {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 300,
    });

    res.json({
      downloadUrl: s3Url,
      filename: file.name,
      mimetype: file.mimetype,
      fileId: String(file._id),   // ✅ frontend uses this to verify access
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});



router.use(verifyJWT);

// ─── UPLOAD REQUEST ───────────────────────────────────────────────────────────
router.post("/upload-request", async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType)
    return res.status(400).json({ error: "Missing filename/contentType" });

  const key = `consentchain/${Date.now()}-${filename}`;
  const url = s3.getSignedUrl('putObject', {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Expires: 300
  });

  res.json({ url, key });
});

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
router.post("/upload", verifyJWT, async (req, res) => {
  const email = req.user.email;
  if (!req.body || !req.body.key)
    return res.status(400).json({ error: "Missing body — send JSON with key/filename/mimetype" });

  const { key, filename, mimetype } = req.body;
  if (!key || !filename)
    return res.status(400).json({ error: "Missing key/filename" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const createdFile = await File.create({
      name: filename,
      url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      ownerId: user._id,
      s3Key: key,
      mimetype,
    });

    res.json({ message: "File registered!", file: createdFile });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GRANT ACCESS ─────────────────────────────────────────────────────────────
router.post("/grant", async (req, res) => {
  const { toEmail, fileId, expiryTime } = req.body;
  const fromEmail = req.user.email;

  if (!fileId || !toEmail)
    return res.status(400).json({ error: "Missing toEmail or fileId" });
  if (toEmail.toLowerCase() === fromEmail.toLowerCase())
    return res.status(400).json({ error: "You cannot grant access to yourself" });

  try {
    const fromUser = await User.findOne({ email: fromEmail });
    const toUser = await User.findOne({ email: toEmail });
    if (!fromUser || !toUser)
      return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (String(file.ownerId) !== String(fromUser._id))
      return res.status(403).json({ error: "You do not own this file" });

    const existingAccess = await Access.findOne({
      fromId: fromUser._id,
      toId: toUser._id,
      fileId,
    });
    if (existingAccess)
      return res.status(400).json({ error: "Access already granted" });

    await Access.create({
      fromId: fromUser._id,
      toId: toUser._id,
      fileId,
      expiryTime: expiryTime ? new Date(expiryTime) : null,
    });

    await logAudit(fromUser._id, fileId, "granted", toUser._id);

    // ✅ SES: Notify recipient
    const expiryNote = expiryTime
      ? `\nAccess expires: ${new Date(expiryTime).toLocaleString()}`
      : "\nAccess: Permanent (no expiry)";

    await sendEmail({
      to: toUser.email,
      subject: `ConsentChain: Access Granted — ${file.name}`,
      body: `Hi ${toUser.name || toUser.email},\n\n${fromUser.name || fromUser.email} has granted you access to the file: "${file.name}".${expiryNote}\n\nLog in to ConsentChain to view it.\n\n— ConsentChain`
    });

    res.json({ message: `Access granted to ${toEmail} for file ${file.name}` });
  } catch (error) {
    console.error("Grant access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── REVOKE ACCESS ────────────────────────────────────────────────────────────
router.post("/revoke", async (req, res) => {
  const { toEmail, fileId } = req.body;
  const fromEmail = req.user.email;

  if (!fileId || !toEmail)
    return res.status(400).json({ error: "Missing toEmail or fileId" });

  try {
    const [fromUser, toUser] = await Promise.all([
      User.findOne({ email: fromEmail }),
      User.findOne({ email: toEmail }),
    ]);
    if (!fromUser || !toUser)
      return res.status(404).json({ error: "User(s) not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (String(file.ownerId) !== String(fromUser._id))
      return res.status(403).json({ error: "You do not own this file" });

    const accessRecord = await Access.findOne({
      fileId,
      fromId: fromUser._id,
      toId: toUser._id,
    });
    if (!accessRecord)
      return res.status(400).json({ error: "Access not found to revoke" });

    await Access.findByIdAndDelete(accessRecord._id);
    await logAudit(fromUser._id, fileId, "revoked", toUser._id);

    // ✅ SES: Notify recipient
    await sendEmail({
      to: toUser.email,
      subject: `ConsentChain: Access Revoked — ${file.name}`,
      body: `Hi ${toUser.name || toUser.email},\n\n${fromUser.name || fromUser.email} has revoked your access to the file: "${file.name}".\n\nYou no longer have access to this file.\n\n— ConsentChain`
    });

    res.json({ message: `Access revoked from ${toEmail}` });
  } catch (error) {
    console.error("Revoke access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GLOBAL LOGS ──────────────────────────────────────────────────────────────
router.get("/logs", async (req, res) => {
  const email = req.user.email;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const files = await File.find({ ownerId: user._id }, "_id name");
    const fileIds = files.map((f) => f._id);
    const fileMap = {};
    files.forEach((f) => { fileMap[String(f._id)] = f.name; });

    const logs = await Log.find({ fileId: { $in: fileIds } })
      .populate("userId", "email")
      .sort({ timestamp: -1 });

    const formatted = logs.map((log) => ({
      fileName: fileMap[String(log.fileId)] || "Unknown File",
      downloadedBy: log.userId?.email || "Unknown User",
      downloadedAt: log.timestamp,
    }));

    res.json({ logs: formatted });
  } catch (err) {
    console.error("Global logs error:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// ─── LOGS BY FILE ─────────────────────────────────────────────────────────────
router.get("/logs/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const email = req.user.email;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (String(file.ownerId) !== String(user._id))
      return res.status(403).json({ error: "You do not have access to this file's logs" });

    const downloadLogs = await Log.find({ fileId })
      .populate("userId", "name")
      .sort({ timestamp: -1 });

    const auditLogs = await AuditLog.find({ fileId })
      .populate("userId", "name")
      .populate("toUser", "email")
      .sort({ timestamp: -1 });

    const formattedDownloads = downloadLogs.map((log) => ({
      type: "download",
      by: log.userId.name,
      at: log.timestamp,
    }));

    const formattedAudits = auditLogs.map((log) => ({
      type: log.action,
      by: log.userId.name,
      to: log.toUser ? log.toUser.email : null,
      at: log.timestamp,
    }));

    res.json({ logs: [...formattedDownloads, ...formattedAudits] });
  } catch (error) {
    console.error("Fetch logs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PREVIEW ──────────────────────────────────────────────────────────────────
router.get("/preview/:fileId", async (req, res) => {
  const email = req.user.email;
  const { fileId } = req.params;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isOwner = String(file.ownerId) === String(user._id);
    const access = await Access.findOne({ fileId, toId: user._id });
    if (!isOwner && !access) return res.status(403).json({ error: "Access denied" });
    if (access?.expiryTime && new Date() > new Date(access.expiryTime))
      return res.status(403).json({ error: "Access expired" });

    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 300
    });

    const mime = file.mimetype || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${file.name}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const https = require("https");
    https.get(signedUrl, (s3Stream) => {
      s3Stream.pipe(res);
    }).on("error", () => res.status(500).json({ error: "Preview failed" }));

  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Preview failed" });
  }
});

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
router.get("/download/:fileId", async (req, res) => {
  const email = req.user.email;
  const { fileId } = req.params;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isOwner = String(file.ownerId) === String(user._id);
    const access = await Access.findOne({ fileId, toId: user._id });

    if (!isOwner && !access)
      return res.status(403).json({ error: "Access denied" });

    if (access?.expiryTime && new Date() > new Date(access.expiryTime)) {
      await AuditLog.create({
        userId: access.fromId,
        fileId: file._id,
        action: "expired",
        toUser: user._id,
        timestamp: new Date(),
      });

      // ✅ SES: Notify owner of expired access attempt
      const owner = await User.findById(file.ownerId);
      if (owner) {
        await sendEmail({
          to: owner.email,
          subject: `ConsentChain: Expired Access Attempt — ${file.name}`,
          body: `Hi ${owner.name || owner.email},\n\n${user.name || user.email} tried to access "${file.name}" but their access has expired.\n\n— ConsentChain`
        });
      }

      return res.status(403).json({ error: "Access expired" });
    }

    await Log.create({ fileId: file._id, userId: user._id });

    // ✅ SES: Notify owner of download (only if downloader is not owner)
    if (!isOwner) {
      const owner = await User.findById(file.ownerId);
      if (owner) {
        await sendEmail({
          to: owner.email,
          subject: `ConsentChain: File Downloaded — ${file.name}`,
          body: `Hi ${owner.name || owner.email},\n\n${user.name || user.email} just downloaded your file: "${file.name}".\n\nLog in to ConsentChain to view full activity logs.\n\n— ConsentChain`
        });
      }
    }

    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 300
    });

    res.json({
      downloadUrl: url,
      filename: file.name,
      mimetype: file.mimetype
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── MY FILES ─────────────────────────────────────────────────────────────────
router.get("/myfiles", async (req, res) => {
  const email = req.user.email;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const files = await File.find({ ownerId: user._id });
    res.json({ files });
  } catch (error) {
    console.error("My files error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SHARED FILES ─────────────────────────────────────────────────────────────
router.get("/shared", async (req, res) => {
  const email = req.user.email;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const accesses = await Access.find({ toId: user._id })
      .populate("fromId", "name")
      .populate("fileId", "name mimetype");

    const now = new Date();
    const sharedFiles = accesses
      .filter((a) => {
        if (!a.fileId) return false;
        if (a.expiryTime && new Date(a.expiryTime) < now) return false;
        return true;
      })
      .map((a) => ({
        _id: a.fileId._id,
        owner: a.fromId.name,
        filename: a.fileId.name,
        mimetype: a.fileId.mimetype,
      }));

    res.json({ sharedFiles });
  } catch (error) {
    console.error("Shared files error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GRANTED ACCESS ───────────────────────────────────────────────────────────
router.get("/granted", async (req, res) => {
  const email = req.user.email;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const accesses = await Access.find({ fromId: user._id })
      .populate("toId", "email name")
      .populate("fileId", "name mimetype");

    const now = new Date();
    const granted = accesses
      .filter((a) => a.fileId)
      .map((a) => {
        let status = "no expiry";
        let remainingMs = null;

        if (a.expiryTime) {
          if (new Date(a.expiryTime) < now) {
            status = "expired";
          } else {
            status = "active";
            remainingMs = new Date(a.expiryTime) - now;
          }
        }

        const formatDuration = (ms) => {
          const totalMins = Math.floor(ms / 60000);
          const days = Math.floor(totalMins / 1440);
          const hours = Math.floor((totalMins % 1440) / 60);
          const mins = totalMins % 60;
          if (days > 0) return `${days}d ${hours}h remaining`;
          if (hours > 0) return `${hours}h ${mins}m remaining`;
          return `${mins}m remaining`;
        };

        return {
          accessId: a._id,
          fileId: a.fileId._id,
          fileName: a.fileId.name,
          mimetype: a.fileId.mimetype,
          sharedWith: a.toId.email,
          sharedWithName: a.toId.name,
          grantedAt: a.grantedAt,
          expiryTime: a.expiryTime,
          status,
          remaining: remainingMs ? formatDuration(remainingMs) : null,
        };
      });

    res.json({ granted });
  } catch (err) {
    console.error("Granted access error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── UPDATE EXPIRY ────────────────────────────────────────────────────────────
router.post("/update-expiry", async (req, res) => {
  const { accessId, expiryTime } = req.body;
  const fromEmail = req.user.email;

  if (!accessId) return res.status(400).json({ error: "Missing accessId" });

  try {
    const fromUser = await User.findOne({ email: fromEmail });
    if (!fromUser) return res.status(404).json({ error: "User not found" });

    const access = await Access.findById(accessId);
    if (!access) return res.status(404).json({ error: "Access record not found" });

    if (String(access.fromId) !== String(fromUser._id))
      return res.status(403).json({ error: "You did not grant this access" });

    if (expiryTime === null && !access.expiryTime)
      return res.status(400).json({ error: "No expiry to remove" });

    if (expiryTime && new Date(expiryTime) <= new Date())
      return res.status(400).json({ error: "New expiry must be in the future" });

    access.expiryTime = expiryTime ? new Date(expiryTime) : null;
    await access.save();

    await logAudit(fromUser._id, access.fileId, "expiry_updated", access.toId);

    // ✅ SES: Notify recipient of expiry update
    const toUser = await User.findById(access.toId);
    const file = await File.findById(access.fileId);
    if (toUser && file) {
      const expiryNote = expiryTime
        ? `New expiry: ${new Date(expiryTime).toLocaleString()}`
        : "Expiry removed — your access is now permanent.";

      await sendEmail({
        to: toUser.email,
        subject: `ConsentChain: Access Expiry Updated — ${file.name}`,
        body: `Hi ${toUser.name || toUser.email},\n\n${fromUser.name || fromUser.email} has updated your access expiry for "${file.name}".\n${expiryNote}\n\n— ConsentChain`
      });
    }

    res.json({
      message: expiryTime ? "Expiry updated successfully" : "Expiry removed — access is now permanent",
      expiryTime: access.expiryTime,
    });
  } catch (err) {
    console.error("Update expiry error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get("/analytics/summary", async (req, res) => {
  const email = req.user.email;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const files = await File.find({ ownerId: user._id }, "_id name");
    const fileIds = files.map((f) => f._id);
    const logs = await Log.find({ fileId: { $in: fileIds } }, "fileId timestamp");

    const fileDownloads = {};
    const dailyDownloads = {};

    for (const log of logs) {
      const fid = String(log.fileId);
      fileDownloads[fid] = (fileDownloads[fid] || 0) + 1;
      const date = log.timestamp.toISOString().slice(0, 10);
      dailyDownloads[date] = (dailyDownloads[date] || 0) + 1;
    }

    const mostAccessed = files
      .map((file) => ({
        fileName: file.name,
        downloadCount: fileDownloads[String(file._id)] || 0,
      }))
      .sort((a, b) => b.downloadCount - a.downloadCount);

    const accessPattern = Object.entries(dailyDownloads)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ totalDownloads: logs.length, mostAccessed, accessPattern });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});
// ─── GENERATE SHARE LINK ─────────────────────────────────────────────
router.post("/generate-link/:fileId", async (req, res) => {
  const email = req.user.email;
  const { fileId } = req.params;
  const { expiresInMinutes = 525600, maxUses = 1 } = req.body; // optional

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (String(file.ownerId) !== String(user._id))
      return res.status(403).json({ error: "You do not own this file" });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

    const linkDoc = await ShareLink.create({
      fileId: file._id,
      ownerId: user._id,
      token,
      expiresAt,
      maxUses,
    });

    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const url = `${frontendBase}/view/${token}`;

    res.json({
      message: "Share link created",
      token,
      url,
      expiresAt: linkDoc.expiresAt,
      maxUses: linkDoc.maxUses,
    });
  } catch (err) {
    console.error("Generate link error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
