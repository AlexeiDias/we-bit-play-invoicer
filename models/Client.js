const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: String,
  business: String,
  address: String,
  phone: String,
  email: { type: String, unique: true }
});

module.exports = mongoose.model('Client', clientSchema);
