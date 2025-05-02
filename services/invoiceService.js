// services/invoiceService.js
const inquirer = require('inquirer');
const path = require('path');
const { exec } = require('child_process');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const { getNextInvoiceNumber } = require('../utils/counter');
const { generateInvoicePDF } = require('./pdfService');
const { sendInvoiceEmail } = require('./emailService');
const { loadSettings } = require('./settingsService');
const { createClient } = require('./clientService');
const editInvoice = require('./editInvoice');

// ───────────────────────────
// 🔧 Helpers
// ───────────────────────────
const parseTime = str => {
  if (!str || !str.includes(':')) return null;
  const [h, m] = str.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
};

const formatTime = mins => {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
};

// ───────────────────────────
// 🧾 Create Invoice
// ───────────────────────────
async function createInvoice() {
  const settings = loadSettings();
  if (!settings) {
    console.log('⚠️ Settings not configured.');
    return;
  }

  const clients = await Client.find().sort({ name: 1 });
  const clientChoices = clients.map(c => ({ name: `${c.name} (${c.email})`, value: c._id }));
  clientChoices.push(new inquirer.Separator(), { name: '➕ Add New Client', value: 'new' });

  const { clientChoice } = await inquirer.prompt({
    type: 'list',
    name: 'clientChoice',
    message: '👤 Select a client:',
    choices: clientChoices
  });

  const client = clientChoice === 'new' ? await createClient() : await Client.findById(clientChoice);
  if (!client) return;

  const { jobType } = await inquirer.prompt({
    type: 'list',
    name: 'jobType',
    message: '💼 Job Type:',
    choices: ['In-Person', 'Remote']
  });

  const { isCanceled } = await inquirer.prompt({
    type: 'confirm',
    name: 'isCanceled',
    message: 'Was the job canceled?'
  });

  let description = '';
  if (!isCanceled) {
    if (settings.services?.length) {
      const { useCatalog } = await inquirer.prompt({
        type: 'confirm',
        name: 'useCatalog',
        message: 'Use a predefined service from catalog?',
        default: true
      });

      if (useCatalog) {
        const { service } = await inquirer.prompt({
          type: 'list',
          name: 'service',
          message: 'Select a service:',
          choices: settings.services
        });
        description = service;
      } else {
        const { custom } = await inquirer.prompt({ name: 'custom', message: 'Describe the service:' });
        description = custom;
      }
    } else {
      const { custom } = await inquirer.prompt({ name: 'custom', message: 'Describe the service:' });
      description = custom;
    }
  }

  let workLogs = [];
  let serviceBreakdown = {};
  const hourlyRate = parseFloat(jobType === 'In-Person' ? settings.hourlyInPerson : settings.hourlyRemote);

  if (isCanceled) {
    workLogs.push({ description: 'Job Cancelation Fee', hours: settings.cancelHours });
  } else {
    const { setupStart, depoEnd, lunchBreak } = await inquirer.prompt([
      { name: 'setupStart', message: 'Setup Start (e.g. 08:00):' },
      { name: 'depoEnd', message: 'Deposition End (e.g. 12:00):' },
      {
        name: 'lunchBreak',
        message: 'Lunch Break (in hours):',
        default: '0',
        validate: val => !isNaN(val) && val >= 0
      }
    ]);

    const setupMin = parseTime(setupStart);
    const depoMin = parseTime(depoEnd);
    const lunch = parseFloat(lunchBreak);
    const breakdownMin = depoMin + 30;
    const depoStartMin = setupMin + (jobType === 'In-Person' ? 60 : 30);
    const depoDuration = ((breakdownMin - setupMin) / 60 - lunch).toFixed(2);

    workLogs.push({
      description: `Total Deposition Time - ${description}`,
      hours: parseFloat(depoDuration)
    });

    serviceBreakdown = {
      setupStart,
      depoStart: formatTime(depoStartMin),
      depoEnd,
      breakdownEnd: formatTime(breakdownMin),
      lunchBreak,
      totalHours: parseFloat(depoDuration)
    };
  }

  // 💸 Expenses
  const expenses = [];
  const { hasExpenses } = await inquirer.prompt({
    type: 'confirm',
    name: 'hasExpenses',
    message: 'Add reimbursable expenses?'
  });

  if (hasExpenses) {
    let adding = true;
    while (adding) {
      const { description, amount } = await inquirer.prompt([
        { name: 'description', message: 'Expense Description:' },
        {
          name: 'amount',
          message: 'Amount (USD):',
          validate: val => !isNaN(val) && val >= 0
        }
      ]);
      expenses.push({ description, amount: parseFloat(amount) });

      const { more } = await inquirer.prompt({
        type: 'confirm',
        name: 'more',
        message: 'Add another expense?'
      });
      adding = more;
    }
  }

  const { notes, subtitle } = await inquirer.prompt([
    { name: 'notes', message: 'Any notes?' },
    { name: 'subtitle', message: 'Subtitle (optional):', default: '' }
  ]);

  const invoiceNumber = await getNextInvoiceNumber();
  const totalHours = workLogs.reduce((sum, log) => sum + log.hours, 0);
  const workTotal = totalHours * hourlyRate;
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
  console.log(`✅ Invoice #${invoiceNumber} saved.`);

  const pdfPath = path.join(__dirname, '..', 'exports', `Invoice-${String(invoiceNumber).padStart(5, '0')}.pdf`);
  generateInvoicePDF(invoice);
  exec(`${process.platform === 'win32' ? 'start' : 'open'} "${pdfPath}"`);

  const { shouldEmail } = await inquirer.prompt({
    type: 'confirm',
    name: 'shouldEmail',
    message: 'Do you want to email this invoice now?'
  });

  if (shouldEmail) {
    try {
      await sendInvoiceEmail(invoice, pdfPath);
      console.log('📧 Email sent!');
    } catch (err) {
      console.error('❌ Email failed:', err.message);
    }
  } else {
    console.log('📥 Invoice ready but email not sent.');
  }
}

// ───────────────────────────
// 📂 View Invoices
// ───────────────────────────
async function viewInvoices() {
  const invoices = await Invoice.find().sort({ invoiceNumber: -1 });
  invoices.forEach(inv => {
    console.log(`📄 Invoice #${inv.invoiceNumber} - ${inv.subtitle || 'No subtitle'} - $${inv.total.toFixed(2)}`);
  });
}

// ───────────────────────────
// ❌ Delete Invoice
// ───────────────────────────
async function deleteInvoice() {
  const invoices = await Invoice.find().sort({ invoiceNumber: -1 });

  if (!invoices.length) {
    console.log('⚠️ No invoices to delete.');
    return;
  }

  const { selectedId } = await inquirer.prompt({
    type: 'list',
    name: 'selectedId',
    message: 'Select an invoice to delete:',
    choices: invoices.map(inv => ({
      name: `#${inv.invoiceNumber} - ${inv.subtitle || 'No subtitle'} - $${inv.total.toFixed(2)}`,
      value: inv._id
    }))
  });

  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to delete this invoice?',
    default: false
  });

  if (!confirm) {
    console.log('❌ Deletion canceled.');
    return;
  }

  await Invoice.findByIdAndDelete(selectedId);
  console.log('🗑️ Invoice deleted successfully.');
}

// ───────────────────────────
// 📦 Export Services
// ───────────────────────────
module.exports = {
  createInvoice,
  viewInvoices,
  editInvoice,
  deleteInvoice
};
