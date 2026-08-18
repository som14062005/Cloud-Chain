const express = require("express");
const mongoose = require("mongoose");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const router = express.Router();
const verifyJWT = require("../utils/auth");

const User = require("../models/User");
const File = require("../models/File");
const Access = require("../models/Access");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getBucketName() {
  return process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
}

router.use(verifyJWT);

// ─── UPLOAD REQUEST ───────────────────────────────────────────────────────────
router.post("/upload-request", async (req, res) => {
  try {
    const { filename, contentType } = req.body || {};

    if (
      !filename ||
      !contentType ||
      typeof filename !== "string" ||
      typeof contentType !== "string"
    ) {
      return res.status(400).json({ error: "Invalid filename/contentType" });
    }

    const bucket = getBucketName();
    if (!bucket) {
      return res.status(500).json({ error: "S3 bucket is not configured" });
    }

    const safeFilename = filename.replace(/[^\w.\- ]/g, "_");
    const key = `consentchain/${Date.now()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    res.json({ url, key });
  } catch (error) {
    console.error("Upload request error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
router.post("/upload", async (req, res) => {
  const email = req.user.email;
  const { key, filename, mimetype } = req.body || {};

  if (!key || !filename) {
    return res.status(400).json({ error: "Missing key/filename" });
  }

  if (typeof key !== "string" || typeof filename !== "string") {
    return res.status(400).json({ error: "Invalid key/filename" });
  }

  if (!key.startsWith("consentchain/")) {
    return res.status(400).json({ error: "Invalid S3 key" });
  }

  try {
    const bucket = getBucketName();
    if (!bucket) {
      return res.status(500).json({ error: "S3 bucket is not configured" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const createdFile = await File.create({
      name: filename,
      url: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      ownerId: user._id,
      s3Key: key,
      mimetype: typeof mimetype === "string" ? mimetype : undefined,
    });

    res.json({ message: "File registered!", file: createdFile });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GRANT ACCESS ─────────────────────────────────────────────────────────────
router.post("/grant", async (req, res) => {
  const { toEmail, fileId, expiryTime } = req.body || {};
  const fromEmail = req.user.email;

  if (!fileId || !toEmail) {
    return res.status(400).json({ error: "Missing toEmail or fileId" });
  }

  if (!isValidEmail(toEmail)) {
    return res.status(400).json({ error: "Invalid recipient email" });
  }

  if (!isValidObjectId(fileId)) {
    return res.status(400).json({ error: "Invalid fileId" });
  }

  if (toEmail.toLowerCase() === fromEmail.toLowerCase()) {
    return res.status(400).json({ error: "You cannot grant access to yourself" });
  }

  if (expiryTime && isNaN(new Date(expiryTime).getTime())) {
    return res.status(400).json({ error: "Invalid expiryTime" });
  }

  try {
    const fromUser = await User.findOne({ email: fromEmail });
    const toUser = await User.findOne({ email: toEmail });

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (String(file.ownerId) !== String(fromUser._id)) {
      return res.status(403).json({ error: "You do not own this file" });
    }

    const existingAccess = await Access.findOne({
      fromId: fromUser._id,
      toId: toUser._id,
      fileId,
    });

    if (existingAccess) {
      return res.status(400).json({ error: "Access already granted" });
    }

    await Access.create({
      fromId: fromUser._id,
      toId: toUser._id,
      fileId,
      expiryTime: expiryTime ? new Date(expiryTime) : null,
    });

    res.json({ message: `Access granted to ${toEmail} for file ${file.name}` });
  } catch (error) {
    console.error("Grant access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── REVOKE ACCESS ────────────────────────────────────────────────────────────
router.post("/revoke", async (req, res) => {
  const { toEmail, fileId } = req.body || {};
  const fromEmail = req.user.email;

  if (!fileId || !toEmail) {
    return res.status(400).json({ error: "Missing toEmail or fileId" });
  }

  if (!isValidEmail(toEmail)) {
    return res.status(400).json({ error: "Invalid recipient email" });
  }

  if (!isValidObjectId(fileId)) {
    return res.status(400).json({ error: "Invalid fileId" });
  }

  try {
    const [fromUser, toUser] = await Promise.all([
      User.findOne({ email: fromEmail }),
      User.findOne({ email: toEmail }),
    ]);

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: "User(s) not found" });
    }

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (String(file.ownerId) !== String(fromUser._id)) {
      return res.status(403).json({ error: "You do not own this file" });
    }

    const accessRecord = await Access.findOne({
      fileId,
      fromId: fromUser._id,
      toId: toUser._id,
    });

    if (!accessRecord) {
      return res.status(400).json({ error: "Access not found to revoke" });
    }

    await Access.findByIdAndDelete(accessRecord._id);

    res.json({ message: `Access revoked from ${toEmail}` });
  } catch (error) {
    console.error("Revoke access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PREVIEW ──────────────────────────────────────────────────────────────────
router.get("/preview/:fileId", async (req, res) => {
  const email = req.user.email;
  const { fileId } = req.params;

  if (!isValidObjectId(fileId)) {
    return res.status(400).json({ error: "Invalid fileId" });
  }

  try {
    const bucket = getBucketName();
    if (!bucket) {
      return res.status(500).json({ error: "S3 bucket is not configured" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isOwner = String(file.ownerId) === String(user._id);
    const access = await Access.findOne({ fileId, toId: user._id });

    if (!isOwner && !access) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (access?.expiryTime && new Date() > new Date(access.expiryTime)) {
      return res.status(403).json({ error: "Access expired" });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: file.s3Key,
    });

    const previewUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    res.json({
      previewUrl,
      filename: file.name,
      mimetype: file.mimetype,
    });
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
router.get("/download/:fileId", async (req, res) => {
  const email = req.user.email;
  const { fileId } = req.params;

  if (!isValidObjectId(fileId)) {
    return res.status(400).json({ error: "Invalid fileId" });
  }

  try {
    const bucket = getBucketName();
    if (!bucket) {
      return res.status(500).json({ error: "S3 bucket is not configured" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isOwner = String(file.ownerId) === String(user._id);
    const access = await Access.findOne({ fileId, toId: user._id });

    if (!isOwner && !access) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (access?.expiryTime && new Date() > new Date(access.expiryTime)) {
      return res.status(403).json({ error: "Access expired" });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: file.s3Key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    res.json({
      downloadUrl: url,
      filename: file.name,
      mimetype: file.mimetype,
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
      .populate("fromId", "name email")
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
        owner: a.fromId?.name || a.fromId?.email || "Unknown",
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
          sharedWith: a.toId?.email || null,
          sharedWithName: a.toId?.name || null,
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
  const { accessId, expiryTime } = req.body || {};
  const fromEmail = req.user.email;

  if (!accessId) {
    return res.status(400).json({ error: "Missing accessId" });
  }

  if (!isValidObjectId(accessId)) {
    return res.status(400).json({ error: "Invalid accessId" });
  }

  if (expiryTime && isNaN(new Date(expiryTime).getTime())) {
    return res.status(400).json({ error: "Invalid expiryTime" });
  }

  try {
    const fromUser = await User.findOne({ email: fromEmail });
    if (!fromUser) return res.status(404).json({ error: "User not found" });

    const access = await Access.findById(accessId);
    if (!access) return res.status(404).json({ error: "Access record not found" });

    if (String(access.fromId) !== String(fromUser._id)) {
      return res.status(403).json({ error: "You did not grant this access" });
    }

    if (expiryTime === null && !access.expiryTime) {
      return res.status(400).json({ error: "No expiry to remove" });
    }

    if (expiryTime && new Date(expiryTime) <= new Date()) {
      return res.status(400).json({ error: "New expiry must be in the future" });
    }

    access.expiryTime = expiryTime ? new Date(expiryTime) : null;
    await access.save();

    res.json({
      message: expiryTime
        ? "Expiry updated successfully"
        : "Expiry removed — access is now permanent",
      expiryTime: access.expiryTime,
    });
  } catch (err) {
    console.error("Update expiry error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
// const express = require("express");
// const mongoose = require("mongoose");
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const router = express.Router();
// const verifyJWT = require("../utils/auth");

// const User = require("../models/User");
// const File = require("../models/File");
// const Access = require("../models/Access");

// function isValidObjectId(id) {
//   return mongoose.Types.ObjectId.isValid(id);
// }

// function isValidEmail(email) {
//   return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// }

// router.use(verifyJWT);

// const uploadsDir = path.join(__dirname, "../uploads");
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadsDir);
//   },
//   filename: function (req, file, cb) {
//     const safeName = file.originalname.replace(/[^\w.\- ]/g, "_").replace(/\s+/g, "_");
//     cb(null, `${Date.now()}-${safeName}`);
//   },
// });

// const upload = multer({ storage });

// // ─── UPLOAD ───────────────────────────────────────────────────────────────────
// router.post("/upload", upload.single("file"), async (req, res) => {
//   const email = req.user.email;

//   if (!req.file) {
//     return res.status(400).json({ error: "No file uploaded" });
//   }

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";
//     const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

//     const createdFile = await File.create({
//       name: req.file.originalname,
//       url: fileUrl,
//       ownerId: user._id,
//       localPath: req.file.path,
//       mimetype: req.file.mimetype,
//     });

//     res.json({ message: "File uploaded!", file: createdFile });
//   } catch (error) {
//     console.error("Upload error:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── GRANT ACCESS ─────────────────────────────────────────────────────────────
// router.post("/grant", async (req, res) => {
//   const { toEmail, fileId, expiryTime } = req.body;
//   const fromEmail = req.user.email;

//   if (!fileId || !toEmail) {
//     return res.status(400).json({ error: "Missing toEmail or fileId" });
//   }

//   if (!isValidEmail(toEmail)) {
//     return res.status(400).json({ error: "Invalid recipient email" });
//   }

//   if (!isValidObjectId(fileId)) {
//     return res.status(400).json({ error: "Invalid fileId" });
//   }

//   if (toEmail.toLowerCase() === fromEmail.toLowerCase()) {
//     return res.status(400).json({ error: "You cannot grant access to yourself" });
//   }

//   if (expiryTime && isNaN(new Date(expiryTime).getTime())) {
//     return res.status(400).json({ error: "Invalid expiryTime" });
//   }

//   try {
//     const fromUser = await User.findOne({ email: fromEmail });
//     const toUser = await User.findOne({ email: toEmail });

//     if (!fromUser || !toUser) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const file = await File.findById(fileId);
//     if (!file) return res.status(404).json({ error: "File not found" });

//     if (String(file.ownerId) !== String(fromUser._id)) {
//       return res.status(403).json({ error: "You do not own this file" });
//     }

//     const existingAccess = await Access.findOne({
//       fromId: fromUser._id,
//       toId: toUser._id,
//       fileId,
//     });

//     if (existingAccess) {
//       return res.status(400).json({ error: "Access already granted" });
//     }

//     await Access.create({
//       fromId: fromUser._id,
//       toId: toUser._id,
//       fileId,
//       expiryTime: expiryTime ? new Date(expiryTime) : null,
//     });

//     res.json({ message: `Access granted to ${toEmail} for file ${file.name}` });
//   } catch (error) {
//     console.error("Grant access error:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── REVOKE ACCESS ────────────────────────────────────────────────────────────
// router.post("/revoke", async (req, res) => {
//   const { toEmail, fileId } = req.body;
//   const fromEmail = req.user.email;

//   if (!fileId || !toEmail) {
//     return res.status(400).json({ error: "Missing toEmail or fileId" });
//   }

//   if (!isValidEmail(toEmail)) {
//     return res.status(400).json({ error: "Invalid recipient email" });
//   }

//   if (!isValidObjectId(fileId)) {
//     return res.status(400).json({ error: "Invalid fileId" });
//   }

//   try {
//     const [fromUser, toUser] = await Promise.all([
//       User.findOne({ email: fromEmail }),
//       User.findOne({ email: toEmail }),
//     ]);

//     if (!fromUser || !toUser) {
//       return res.status(404).json({ error: "User(s) not found" });
//     }

//     const file = await File.findById(fileId);
//     if (!file) return res.status(404).json({ error: "File not found" });

//     if (String(file.ownerId) !== String(fromUser._id)) {
//       return res.status(403).json({ error: "You do not own this file" });
//     }

//     const accessRecord = await Access.findOne({
//       fileId,
//       fromId: fromUser._id,
//       toId: toUser._id,
//     });

//     if (!accessRecord) {
//       return res.status(400).json({ error: "Access not found to revoke" });
//     }

//     await Access.findByIdAndDelete(accessRecord._id);

//     res.json({ message: `Access revoked from ${toEmail}` });
//   } catch (error) {
//     console.error("Revoke access error:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── PREVIEW ──────────────────────────────────────────────────────────────────
// router.get("/preview/:fileId", async (req, res) => {
//   const email = req.user.email;
//   const { fileId } = req.params;

//   if (!isValidObjectId(fileId)) {
//     return res.status(400).json({ error: "Invalid fileId" });
//   }

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const file = await File.findById(fileId);
//     if (!file) return res.status(404).json({ error: "File not found" });

//     const isOwner = String(file.ownerId) === String(user._id);
//     const access = await Access.findOne({ fileId, toId: user._id });

//     if (!isOwner && !access) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     if (access?.expiryTime && new Date() > new Date(access.expiryTime)) {
//       return res.status(403).json({ error: "Access expired" });
//     }

//     res.json({
//       previewUrl: file.url,
//       filename: file.name,
//       mimetype: file.mimetype,
//     });
//   } catch (err) {
//     console.error("Preview error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
// router.get("/download/:fileId", async (req, res) => {
//   const email = req.user.email;
//   const { fileId } = req.params;

//   if (!isValidObjectId(fileId)) {
//     return res.status(400).json({ error: "Invalid fileId" });
//   }

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const file = await File.findById(fileId);
//     if (!file) return res.status(404).json({ error: "File not found" });

//     const isOwner = String(file.ownerId) === String(user._id);
//     const access = await Access.findOne({ fileId, toId: user._id });

//     if (!isOwner && !access) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     if (access?.expiryTime && new Date() > new Date(access.expiryTime)) {
//       return res.status(403).json({ error: "Access expired" });
//     }

//     res.json({
//       downloadUrl: file.url,
//       filename: file.name,
//       mimetype: file.mimetype,
//     });
//   } catch (error) {
//     console.error("Download error:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── MY FILES ─────────────────────────────────────────────────────────────────
// router.get("/myfiles", async (req, res) => {
//   const email = req.user.email;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const files = await File.find({ ownerId: user._id });
//     res.json({ files });
//   } catch (error) {
//     console.error("My files error:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── SHARED FILES ─────────────────────────────────────────────────────────────
// router.get("/shared", async (req, res) => {
//   const email = req.user.email;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const accesses = await Access.find({ toId: user._id })
//       .populate("fromId", "name")
//       .populate("fileId", "name mimetype");

//     const now = new Date();

//     const sharedFiles = accesses
//       .filter((a) => {
//         if (!a.fileId) return false;
//         if (a.expiryTime && new Date(a.expiryTime) < now) return false;
//         return true;
//       })
//       .map((a) => ({
//         _id: a.fileId._id,
//         owner: a.fromId?.name || "Unknown",
//         filename: a.fileId.name,
//         mimetype: a.fileId.mimetype,
//       }));

//     res.json({ sharedFiles });
//   } catch (error) {
//     console.error("Shared files error:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── GRANTED ACCESS ───────────────────────────────────────────────────────────
// router.get("/granted", async (req, res) => {
//   const email = req.user.email;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const accesses = await Access.find({ fromId: user._id })
//       .populate("toId", "email name")
//       .populate("fileId", "name mimetype");

//     const now = new Date();

//     const granted = accesses
//       .filter((a) => a.fileId)
//       .map((a) => {
//         let status = "no expiry";
//         let remainingMs = null;

//         if (a.expiryTime) {
//           if (new Date(a.expiryTime) < now) {
//             status = "expired";
//           } else {
//             status = "active";
//             remainingMs = new Date(a.expiryTime) - now;
//           }
//         }

//         const formatDuration = (ms) => {
//           const totalMins = Math.floor(ms / 60000);
//           const days = Math.floor(totalMins / 1440);
//           const hours = Math.floor((totalMins % 1440) / 60);
//           const mins = totalMins % 60;

//           if (days > 0) return `${days}d ${hours}h remaining`;
//           if (hours > 0) return `${hours}h ${mins}m remaining`;
//           return `${mins}m remaining`;
//         };

//         return {
//           accessId: a._id,
//           fileId: a.fileId._id,
//           fileName: a.fileId.name,
//           mimetype: a.fileId.mimetype,
//           sharedWith: a.toId?.email || null,
//           sharedWithName: a.toId?.name || null,
//           grantedAt: a.grantedAt,
//           expiryTime: a.expiryTime,
//           status,
//           remaining: remainingMs ? formatDuration(remainingMs) : null,
//         };
//       });

//     res.json({ granted });
//   } catch (err) {
//     console.error("Granted access error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // ─── UPDATE EXPIRY ────────────────────────────────────────────────────────────
// router.post("/update-expiry", async (req, res) => {
//   const { accessId, expiryTime } = req.body;
//   const fromEmail = req.user.email;

//   if (!accessId) {
//     return res.status(400).json({ error: "Missing accessId" });
//   }

//   if (!isValidObjectId(accessId)) {
//     return res.status(400).json({ error: "Invalid accessId" });
//   }

//   if (expiryTime && isNaN(new Date(expiryTime).getTime())) {
//     return res.status(400).json({ error: "Invalid expiryTime" });
//   }

//   try {
//     const fromUser = await User.findOne({ email: fromEmail });
//     if (!fromUser) return res.status(404).json({ error: "User not found" });

//     const access = await Access.findById(accessId);
//     if (!access) return res.status(404).json({ error: "Access record not found" });

//     if (String(access.fromId) !== String(fromUser._id)) {
//       return res.status(403).json({ error: "You did not grant this access" });
//     }

//     if (expiryTime === null && !access.expiryTime) {
//       return res.status(400).json({ error: "No expiry to remove" });
//     }

//     if (expiryTime && new Date(expiryTime) <= new Date()) {
//       return res.status(400).json({ error: "New expiry must be in the future" });
//     }

//     access.expiryTime = expiryTime ? new Date(expiryTime) : null;
//     await access.save();

//     res.json({
//       message: expiryTime
//         ? "Expiry updated successfully"
//         : "Expiry removed — access is now permanent",
//       expiryTime: access.expiryTime,
//     });
//   } catch (err) {
//     console.error("Update expiry error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// module.exports = router;