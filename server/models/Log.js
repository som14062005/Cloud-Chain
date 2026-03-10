const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  fileId:    { type: mongoose.Schema.Types.ObjectId, ref: "File", required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", logSchema);
