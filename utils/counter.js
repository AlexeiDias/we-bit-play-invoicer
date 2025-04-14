const Counter = require('../models/Counter');

async function getNextInvoiceNumber() {
  const counter = await Counter.findOneAndUpdate(
    { name: 'invoice' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );

  return counter.value;
}

module.exports = { getNextInvoiceNumber };
