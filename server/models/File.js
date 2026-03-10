const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  url:       { type: String, required: true },
  publicId:  { type: String },
  mimetype:  { type: String },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("File", fileSchema);
