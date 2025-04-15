const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: Number,

  client: {
    name: String,
    business: String,
    address: String,
    phone: String,
    email: String
  },

  hourlyRate: Number,

  workLogs: [
    {
      description: String,
      hours: Number
    }
  ],

  // ✅ Insert serviceBreakdown here:
  serviceBreakdown: {
    setupStart: String,
    depoStart: String,
    depoEnd: String,
    breakdownEnd: String,
    lunchBreak: String,
    totalHours: Number
  },

  expenses: [
    {
      description: String,
      amount: Number
    }
  ],

  notes: String,
  subtitle: String,
  total: Number,
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
