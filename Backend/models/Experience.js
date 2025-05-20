const mongoose = require('mongoose');

const RoundSchema = new mongoose.Schema({
  roundName: String,
  questions: String,
  duration: String
});

const ExperienceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: String,
  role: String,
  department: String,
  difficulty: String,
  roundDate: Date,
  description: String,
  rounds: [RoundSchema],
  tips: String,
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Experience', ExperienceSchema);
