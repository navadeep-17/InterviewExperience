// Group.js (Mongoose model example)
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String }, // URL to group image
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  branch: { type: String }, // e.g., "CSE"
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);