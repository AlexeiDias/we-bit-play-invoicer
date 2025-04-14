const mongoose = require('mongoose');
const { Schema } = mongoose;

const invoiceSchema = new Schema({
  invoiceNumber: Number,
  date: { type: Date, default: Date.now },
  client: {
    name: String,
    business: String,
    address: String,
    phone: String,
    email: String,
  },
  hourlyRate: Number,
  workLogs: [{
    description: String,
    hours: Number
  }],
  expenses: [{
    description: String,
    amount: Number
  }],
  notes: String,
  total: Number
});

module.exports = mongoose.model('Invoice', invoiceSchema);
