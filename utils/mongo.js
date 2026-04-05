const mongoose = require('mongoose');

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}

module.exports = connectMongo;
