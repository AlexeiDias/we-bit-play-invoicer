const inquirer = require('inquirer');
const Invoice = require('../models/Invoice');
const { getOrCreateClient } = require('./clientService'); // ✅ new import
const { getNextInvoiceNumber } = require('../utils/counter');
const { generateInvoicePDF } = require('./pdfService');



async function createInvoice() {
    console.log('\n🧾 Creating New Invoice...\n');
  
    const client = await getOrCreateClient(); // ✅ persistent client system
  
    const { hourlyRate } = await inquirer.prompt({
      name: 'hourlyRate',
      message: 'Your hourly rate (USD):',
      validate: val => !isNaN(val) && val > 0
    });
  
    let workLogs = [];
    let addMoreWork = true;
  
    while (addMoreWork) {
      const work = await inquirer.prompt([
        { name: 'description', message: 'Work Description:' },
        {
          name: 'hours',
          message: 'Hours (use decimal for fractions, e.g. 1.25):',
          validate: val => !isNaN(val) && val >= 0
        }
      ]);
      workLogs.push({ description: work.description, hours: parseFloat(work.hours) });
  
      const { again } = await inquirer.prompt({
        type: 'confirm',
        name: 'again',
        message: 'Add another work log?'
      });
      addMoreWork = again;
    }
  
    let expenses = [];
    const { includeExpenses } = await inquirer.prompt({
      type: 'confirm',
      name: 'includeExpenses',
      message: 'Add reimbursable expenses (e.g. parking)?'
    });
  
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
  
    // 🔜 Will replace this in Step 2 with auto-increment
    const { getNextInvoiceNumber } = require('../utils/counter');
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
      total
    });
  
    await invoice.save();
    console.log(`✅ Invoice #${invoiceNumber} saved successfully!`);

generateInvoicePDF(invoice); // ✅ create PDF right after save

  }
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
  
    const { section } = await inquirer.prompt({
      type: 'list',
      name: 'section',
      message: 'What do you want to edit?',
      choices: ['Client Info', 'Hourly Rate', 'Work Logs', 'Expenses', 'Notes']
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
  
      case 'Hourly Rate':
        const { hourlyRate } = await inquirer.prompt({
          name: 'hourlyRate',
          message: 'New hourly rate:',
          default: invoice.hourlyRate
        });
        invoice.hourlyRate = parseFloat(hourlyRate);
        break;
  
      case 'Work Logs':
        let workLogs = [];
        let addMoreWork = true;
  
        while (addMoreWork) {
          const work = await inquirer.prompt([
            { name: 'description', message: 'Work Description:' },
            {
              name: 'hours',
              message: 'Hours (decimal ok):',
              validate: val => !isNaN(val) && val >= 0
            }
          ]);
          workLogs.push({ description: work.description, hours: parseFloat(work.hours) });
  
          const { again } = await inquirer.prompt({
            type: 'confirm',
            name: 'again',
            message: 'Add another work log?'
          });
          addMoreWork = again;
        }
  
        invoice.workLogs = workLogs;
        break;
  
      case 'Expenses':
        let expenses = [];
        let addMoreExpense = true;
  
        while (addMoreExpense) {
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
          addMoreExpense = again;
        }
  
        invoice.expenses = expenses;
        break;
  
      case 'Notes':
        const { notes } = await inquirer.prompt({
          name: 'notes',
          message: 'New Notes:',
          default: invoice.notes
        });
        invoice.notes = notes;
        break;
    }
  
    // Recalculate total
    const totalHours = invoice.workLogs.reduce((sum, w) => sum + w.hours, 0);
    const workTotal = totalHours * invoice.hourlyRate;
    const expenseTotal = invoice.expenses.reduce((sum, e) => sum + e.amount, 0);
    invoice.total = workTotal + expenseTotal;
  
    await invoice.save();
    console.log(`✅ Invoice #${invoice.invoiceNumber} updated successfully!`);
    generateInvoicePDF(invoice);

  }
  
  
  
  module.exports = {
    createInvoice,
    viewInvoices,
    deleteInvoice,
    editInvoice
  };
  
  
  
  