const inquirer = require('inquirer');
const path = require('path');
const Invoice = require('../models/Invoice');
const { getOrCreateClient } = require('./clientService');
const { getNextInvoiceNumber } = require('../utils/counter');
const { generateInvoicePDF } = require('./pdfService');
const { sendInvoiceEmail } = require('./emailService');

async function createInvoice() {
  console.log('\n🧾 Creating New Invoice...\n');

  const client = await getOrCreateClient();

  const { hourlyRate } = await inquirer.prompt({
    name: 'hourlyRate',
    message: 'Your hourly rate (USD):',
    validate: val => !isNaN(val) && val > 0
  });

  const { isCanceled } = await inquirer.prompt({
    type: 'confirm',
    name: 'isCanceled',
    message: 'Was the job canceled?'
  });

  let workLogs = [];
  let serviceBreakdown = {};

  if (isCanceled) {
    const cancelFee = parseFloat(hourlyRate) * 3;
    workLogs.push({ description: 'Job Cancelation Fee', hours: 3 });
    console.log(`⚠️ Cancelation fee applied: $${cancelFee.toFixed(2)} (${3} hours)`);
  } else {
    const work = await inquirer.prompt([
      { name: 'description', message: 'Work Description:' }
    ]);
    workLogs.push({ description: work.description, hours: 0 });

    const timeInputs = await inquirer.prompt([
      { name: 'setupStart', message: 'Setup start time (e.g. 08:00):' },
      { name: 'depoStart', message: 'Deposition start time (e.g. 09:20):' },
      { name: 'depoEnd', message: 'Deposition end time (e.g. 12:00):' },
      { name: 'breakdownEnd', message: 'Breakdown end time (e.g. 12:45):' },
      {
        name: 'lunchBreak',
        message: 'Lunch break (in hours, e.g. 0.5):',
        default: '0',
        validate: val => !isNaN(val) && val >= 0
      }
    ]);

    function parseTime(str) {
      if (!str || !str.includes(':')) return null;
      const [h, m] = str.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    }

    const setupMin = parseTime(timeInputs.setupStart);
    const breakdownMin = parseTime(timeInputs.breakdownEnd);
    const lunch = parseFloat(timeInputs.lunchBreak || '0');

    if (setupMin === null || breakdownMin === null || isNaN(lunch)) {
      console.error('❌ Invalid time input. Aborting invoice creation.');
      return;
    }

    const totalMins = breakdownMin - setupMin;
    const depoDuration = ((totalMins / 60) - lunch).toFixed(2);

    if (isNaN(depoDuration) || depoDuration <= 0) {
      console.error('❌ Total deposition time is invalid.');
      return;
    }

    workLogs.push({
      description: 'Total Deposition Time',
      hours: parseFloat(depoDuration)
    });

    serviceBreakdown = {
      ...timeInputs,
      totalHours: parseFloat(depoDuration)
    };
  }

  const { includeExpenses } = await inquirer.prompt({
    type: 'confirm',
    name: 'includeExpenses',
    message: 'Add reimbursable expenses (e.g. parking)?'
  });

  let expenses = [];

  if (includeExpenses) {
    let addMoreExpense = true;
    while (addMoreExpense) {
      const exp = await inquirer.prompt([
        { name: 'description', message: 'Expense Description:' },
        {
          name: 'amount',
          message: 'Amount (USD):',
          validate: val => !isNaN(val) && val >= 0
        }
      ]);
      expenses.push({ description: exp.description, amount: parseFloat(exp.amount) });

      const { again } = await inquirer.prompt({
        type: 'confirm',
        name: 'again',
        message: 'Add another expense?'
      });
      addMoreExpense = again;
    }
  }

  const { notes } = await inquirer.prompt({
    name: 'notes',
    message: 'Any notes/comments for the invoice:'
  });

  const { subtitle } = await inquirer.prompt({
    name: 'subtitle',
    message: 'Optional subtitle (e.g. “Monthly Tuition – April 2025”):',
    default: ''
  });

  const invoiceNumber = await getNextInvoiceNumber();

  const totalHours = workLogs.reduce((sum, log) => sum + log.hours, 0);
  const workTotal = totalHours * parseFloat(hourlyRate);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const total = workTotal + expenseTotal;

  const invoice = new Invoice({
    invoiceNumber,
    client,
    hourlyRate,
    workLogs,
    expenses,
    notes,
    subtitle,
    serviceBreakdown,
    total
  });

  await invoice.save();
  console.log(`✅ Invoice #${invoiceNumber} saved successfully!`);

  generateInvoicePDF(invoice);

const pdfPath = path.join(__dirname, '..', 'exports', `Invoice-${String(invoice.invoiceNumber).padStart(5, '0')}.pdf`);

const { shouldEmail } = await inquirer.prompt({
  type: 'confirm',
  name: 'shouldEmail',
  message: 'Do you want to email this invoice now?'
});

if (shouldEmail) {
  try {
    console.log('📧 Attempting to send invoice...');
    await sendInvoiceEmail(invoice, pdfPath);
    console.log('✅ Email sent!');
  } catch (err) {
    console.error('❌ Email failed:', err.message);
  }
} else {
  console.log('📥 Invoice ready but email not sent. You can manually send it later.');
}

}

// other functions (unchanged)
async function viewInvoices() {
  const invoices = await Invoice.find().sort({ date: -1 });

  if (!invoices.length) {
    console.log('\n⚠️ No invoices found.\n');
    return;
  }

  console.log(`\n📄 Found ${invoices.length} invoice(s):\n`);

  invoices.forEach(inv => {
    const date = new Date(inv.date).toDateString();
    console.log(
      `#${inv.invoiceNumber} — ${inv.client.name} — $${inv.total.toFixed(2)} — ${date}`
    );
  });

  console.log('');
}

async function deleteInvoice() {
  const invoices = await Invoice.find().sort({ date: -1 });

  if (!invoices.length) {
    console.log('⚠️ No invoices to delete.');
    return;
  }

  const choices = invoices.map(inv => ({
    name: `#${inv.invoiceNumber} — ${inv.client.name} — $${inv.total.toFixed(2)}`,
    value: inv._id
  }));

  const { id } = await inquirer.prompt({
    type: 'list',
    name: 'id',
    message: 'Select invoice to delete:',
    choices
  });

  await Invoice.findByIdAndDelete(id);
  console.log('🗑️ Invoice deleted.');
}

async function editInvoice() {
  // remains unchanged for now — handled separately if needed
}

module.exports = {
  createInvoice,
  viewInvoices,
  deleteInvoice,
  editInvoice
};
