const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  url:       { type: String, required: true },
  s3Key:     { type: String },  // ✅ NEW: S3 object key
  mimetype:  { type: String },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("File", fileSchema);
