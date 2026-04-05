const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  userId: String,
  teamRoleId: String,
  teamName: String,
  position: String
});

module.exports = mongoose.model('Staff', staffSchema);
