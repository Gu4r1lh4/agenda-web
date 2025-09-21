// models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyName: String,
  logo: String,
  primaryColor: String,
  services: [String],
  workingHours: {
    start: String,
    end: String
  }
});

module.exports = mongoose.model('Settings', settingsSchema);