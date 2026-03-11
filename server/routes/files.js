const express = require("express");
const router = express.Router();
const verifyJWT = require("../utils/auth");
const AWS = require('aws-sdk');
const axios = require("axios");  
const { logAudit } = require("../utils/audit");
const User = require("../models/User");
const File = require("../models/File");
const Access = require("../models/Access");
const Log = require("../models/Log");
const AuditLog = require("../models/AuditLog");

const s3 = new AWS.S3({ 
  region: process.env.AWS_REGION 
});

router.use(verifyJWT);

router.post("/upload-request", async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) 
    return res.status(400).json({ error: "Missing filename/contentType" });

  const key = `consentchain/${Date.now()}-${filename}`;
  
  const url = s3.getSignedUrl('putObject', {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Expires: 300 // 5 mins
  });

  res.json({ url, key }); // Frontend PUTs directly to S3
});
// UPLOAD
router.post("/upload", verifyJWT, async (req, res) => {
  const email = req.user.email;
  if (!req.body || !req.body.key) {
    return res.status(400).json({ error: "Missing body — send JSON with key/filename/mimetype" });
  }
  const { key, filename, mimetype } = req.body; // From frontend after S3 upload
  
  if (!key || !filename) 
    return res.status(400).json({ error: "Missing key/filename" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const createdFile = await File.create({
  name: filename,
  url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,  // ✅ FIXED
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


// GRANT ACCESS
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
    res.json({ message: `Access granted to ${toEmail} for file ${file.name}` });
  } catch (error) {
    console.error("Grant access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// REVOKE ACCESS
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
    res.json({ message: `Access revoked from ${toEmail}` });
  } catch (error) {
    console.error("Revoke access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GLOBAL LOGS — all download logs for files owned by this user
router.get("/logs", async (req, res) => {
  const email = req.user.email;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get all files owned by this user
    const files = await File.find({ ownerId: user._id }, "_id name");
    const fileIds = files.map((f) => f._id);

    // Build a fileId → fileName map for quick lookup
    const fileMap = {};
    files.forEach((f) => { fileMap[String(f._id)] = f.name; });

    // Fetch all download logs for those files
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


// LOGS
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
// PREVIEW — streams file inline (no download, no audit log)
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

    const streamUrl = file.previewUrl || file.url;
    const mime = file.previewUrl ? "application/pdf" : (file.mimetype || "application/octet-stream");

    const response = await axios.get(streamUrl, { responseType: "stream" });

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${file.name}"`);
    // ✅ X-Frame-Options line REMOVED
    response.data.pipe(res);

  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Preview failed" });
  }
});


// DOWNLOAD
// DOWNLOAD
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
      return res.status(403).json({ error: "Access expired" });
    }

    await Log.create({ fileId: file._id, userId: user._id });

    // ✅ S3 pre-signed download URL (5 mins)
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



// MY FILES
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

// SHARED FILES
// SHARED FILES
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
      // ✅ Filter out expired access records
      .filter((a) => {
        if (!a.fileId) return false; // file deleted
        if (a.expiryTime && new Date(a.expiryTime) < now) return false; // expired
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


// GRANTED ACCESS — files I shared with others
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


// UPDATE EXPIRY
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

    // ✅ Can only remove expiry if one already exists
    if (expiryTime === null && !access.expiryTime)
      return res.status(400).json({ error: "No expiry to remove" });

    // ✅ New expiry must be in the future
    if (expiryTime && new Date(expiryTime) <= new Date())
      return res.status(400).json({ error: "New expiry must be in the future" });

    access.expiryTime = expiryTime ? new Date(expiryTime) : null;
    await access.save();

    await logAudit(fromUser._id, access.fileId, "expiry_updated", access.toId);

    res.json({
      message: expiryTime ? "Expiry updated successfully" : "Expiry removed — access is now permanent",
      expiryTime: access.expiryTime,
    });
  } catch (err) {
    console.error("Update expiry error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// ANALYTICS
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

module.exports = router;
