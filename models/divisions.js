const mongoose = require('mongoose');

const divisionSchema = new mongoose.Schema({
  name: String,
  emoji: String
});

module.exports = mongoose.model('Division', divisionSchema);
