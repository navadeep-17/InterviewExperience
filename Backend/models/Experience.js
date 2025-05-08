// models/Experience.js
const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  name: String,
  company: String,
  department: String,
  difficulty: String,
  roundDate: Date,
  description: String
});

module.exports = mongoose.model('Experience', experienceSchema);
