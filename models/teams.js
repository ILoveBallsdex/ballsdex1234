const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: String,
  roleId: String,
  emoji: String,
  division: String
});

module.exports = mongoose.model('Team', teamSchema);
