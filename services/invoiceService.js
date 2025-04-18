const inquirer = require('inquirer');
const path = require('path');
const Invoice = require('../models/Invoice');
const { getOrCreateClient } = require('./clientService');
const { getNextInvoiceNumber } = require('../utils/counter');
const { generateInvoicePDF } = require('./pdfService');
const { sendInvoiceEmail } = require('./emailService');
const { loadSettings } = require('./settingsService');
const { exec } = require('child_process');





async function createInvoice() {
  console.log('\n🧾 Creating New Invoice...\n');

  
  

  
  const client = await getOrCreateClient();
const settings = loadSettings();

if (!settings) {
  console.log('⚠️ Could not load settings. Please go to Settings.');
  return;
}


  // 💼 3. Job Type
  const { jobType } = await inquirer.prompt({
    type: 'list',
    name: 'jobType',
    message: '📍 Was the job in-person or remote?',
    choices: ['In-Person', 'Remote']
  });

  const hourlyRate =
    jobType === 'In-Person'
      ? parseFloat(settings.hourlyInPerson)
      : parseFloat(settings.hourlyRemote);

  // ❌ 4. Cancel Check
  const { isCanceled } = await inquirer.prompt({
    type: 'confirm',
    name: 'isCanceled',
    message: 'Was the job canceled?'
  });

  let workLogs = [];
  let serviceBreakdown = {};

  if (isCanceled) {
    const cancelFee = hourlyRate * settings.cancelHours;
    workLogs.push({
      description: 'Job Cancelation Fee',
      hours: settings.cancelHours
    });
    console.log(`⚠️ Cancelation fee applied: $${cancelFee.toFixed(2)} (${settings.cancelHours} hours)`);
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

  // 💸 Expenses
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
  const openCommand = process.platform === 'win32' ? 'start' : 'open';
  exec(`${openCommand} "${pdfPath}"`);

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

  // 👇 Pause to prevent menu glitch
  await inquirer.prompt({
    name: 'continue',
    message: 'Press Enter to return to Main Menu',
  });
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
  const invoices = await Invoice.find().sort({ date: -1 });

  if (!invoices.length) {
    console.log('⚠️ No invoices to edit.');
    return;
  }

  const choices = invoices.map(inv => ({
    name: `#${inv.invoiceNumber} — ${inv.client.name} — $${inv.total.toFixed(2)}`,
    value: inv._id
  }));

  const { id } = await inquirer.prompt({
    type: 'list',
    name: 'id',
    message: 'Select invoice to edit:',
    choices
  });

  const invoice = await Invoice.findById(id);
  const settings = loadSettings();

  let editing = true;
  while (editing) {
    const { section } = await inquirer.prompt({
      type: 'list',
      name: 'section',
      message: 'Which section do you want to edit?',
      choices: [
        'Client Info',
        'Job Type (In-Person/Remote)',
        'Was it Canceled?',
        'Hourly Rate',
        'Work Logs',
        'Expenses',
        'Notes & Subtitle',
        '✅ Finish Editing'
      ]
    });

    switch (section) {
      case 'Client Info':
        const updatedClient = await inquirer.prompt([
          { name: 'name', message: 'Client Name:', default: invoice.client.name },
          { name: 'business', message: 'Business Name:', default: invoice.client.business },
          { name: 'address', message: 'Address:', default: invoice.client.address },
          { name: 'phone', message: 'Phone:', default: invoice.client.phone },
          { name: 'email', message: 'Email:', default: invoice.client.email }
        ]);
        invoice.client = updatedClient;
        break;

      case 'Job Type (In-Person/Remote)':
        const { jobType } = await inquirer.prompt({
          type: 'list',
          name: 'jobType',
          message: 'Job type:',
          choices: ['In-Person', 'Remote']
        });
        invoice.hourlyRate = jobType === 'In-Person'
          ? parseFloat(settings.hourlyInPerson)
          : parseFloat(settings.hourlyRemote);
        break;

      case 'Was it Canceled?':
        const { isCanceled } = await inquirer.prompt({
          type: 'confirm',
          name: 'isCanceled',
          message: 'Was the job canceled?'
        });

        if (isCanceled) {
          invoice.workLogs = [{
            description: 'Job Cancelation Fee',
            hours: settings.cancelHours
          }];
          invoice.serviceBreakdown = {}; // no breakdown needed
        } else {
          console.log('🧾 Clear work logs manually in next step if needed.');
        }
        break;

      case 'Hourly Rate':
        const { hourlyRate } = await inquirer.prompt({
          name: 'hourlyRate',
          message: 'New hourly rate:',
          default: invoice.hourlyRate,
          validate: val => !isNaN(val) && val > 0
        });
        invoice.hourlyRate = parseFloat(hourlyRate);
        break;

      case 'Work Logs':
        let workLogs = [];
        let addMore = true;

        while (addMore) {
          const work = await inquirer.prompt([
            { name: 'description', message: 'Work Description:' },
            {
              name: 'hours',
              message: 'Hours:',
              validate: val => !isNaN(val) && val >= 0
            }
          ]);
          workLogs.push({ description: work.description, hours: parseFloat(work.hours) });

          const { again } = await inquirer.prompt({
            type: 'confirm',
            name: 'again',
            message: 'Add another work log?'
          });
          addMore = again;
        }

        invoice.workLogs = workLogs;
        break;

      case 'Expenses':
        let expenses = [];
        let more = true;

        while (more) {
          const exp = await inquirer.prompt([
            { name: 'description', message: 'Expense Description:' },
            {
              name: 'amount',
              message: 'Amount:',
              validate: val => !isNaN(val) && val >= 0
            }
          ]);
          expenses.push({ description: exp.description, amount: parseFloat(exp.amount) });

          const { again } = await inquirer.prompt({
            type: 'confirm',
            name: 'again',
            message: 'Add another expense?'
          });
          more = again;
        }

        invoice.expenses = expenses;
        break;

      case 'Notes & Subtitle':
        const { notes, subtitle } = await inquirer.prompt([
          { name: 'notes', message: 'Notes:', default: invoice.notes },
          { name: 'subtitle', message: 'Subtitle:', default: invoice.subtitle || '' }
        ]);
        invoice.notes = notes;
        invoice.subtitle = subtitle;
        break;

      case '✅ Finish Editing':
        editing = false;
        break;
    }
  }

  // Recalculate totals
  const totalHours = invoice.workLogs.reduce((sum, w) => sum + w.hours, 0);
  const workTotal = totalHours * invoice.hourlyRate;
  const expenseTotal = invoice.expenses.reduce((sum, e) => sum + e.amount, 0);
  invoice.total = workTotal + expenseTotal;

  await invoice.save();
  console.log(`✅ Invoice #${invoice.invoiceNumber} updated successfully!`);

  generateInvoicePDF(invoice);

  const pdfPath = path.join(__dirname, '..', 'exports', `Invoice-${String(invoice.invoiceNumber).padStart(5, '0')}.pdf`);

  const { resend } = await inquirer.prompt({
    type: 'confirm',
    name: 'resend',
    message: 'Do you want to email the updated invoice now?'
  });

  if (resend) {
    try {
      await sendInvoiceEmail(invoice, pdfPath);
      console.log('📧 Email sent!');
    } catch (err) {
      console.error('❌ Failed to send email:', err.message);
    }
  }
}


module.exports = {
  createInvoice,
  viewInvoices,
  deleteInvoice,
  editInvoice
};
