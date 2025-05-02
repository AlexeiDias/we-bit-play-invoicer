// services/editInvoice.js
const inquirer = require('inquirer');
const Invoice = require('../models/Invoice');
const { generateInvoicePDF } = require('./pdfService');
const { sendInvoiceEmail } = require('./emailService');
const path = require('path');

async function editInvoice() {
  const invoices = await Invoice.find().sort({ invoiceNumber: -1 });

  if (!invoices.length) {
    console.log('⚠️ No invoices found.');
    return;
  }

  const { selectedId } = await inquirer.prompt({
    type: 'list',
    name: 'selectedId',
    message: 'Select an invoice to edit:',
    choices: invoices.map(inv => ({
      name: `#${inv.invoiceNumber} - ${inv.subtitle || 'No subtitle'} - $${inv.total.toFixed(2)}`,
      value: inv._id
    }))
  });

  const invoice = await Invoice.findById(selectedId);
  let editing = true;

  while (editing) {
    const { field } = await inquirer.prompt({
      type: 'list',
      name: 'field',
      message: 'What would you like to edit?',
      choices: [
        { name: `🔖 Subtitle: ${invoice.subtitle || '[empty]'}`, value: 'subtitle' },
        { name: `🗒️ Notes: ${invoice.notes || '[empty]'}`, value: 'notes' },
        { name: `💸 Expenses: ${invoice.expenses.length} item(s)`, value: 'expenses' },
        new inquirer.Separator(),
        { name: '✅ Save & Exit', value: 'save' },
        { name: '❌ Cancel Edit', value: 'cancel' }
      ]
    });

    if (field === 'subtitle') {
      const { subtitle } = await inquirer.prompt({
        name: 'subtitle',
        message: 'Enter new subtitle:',
        default: invoice.subtitle
      });
      invoice.subtitle = subtitle;
    }

    if (field === 'notes') {
      const { notes } = await inquirer.prompt({
        name: 'notes',
        message: 'Enter new notes:',
        default: invoice.notes
      });
      invoice.notes = notes;
    }

    if (field === 'expenses') {
      let editingExpenses = true;

      while (editingExpenses) {
        console.log('\n💸 Current Expenses:');
        if (!invoice.expenses.length) {
          console.log('  - None');
        } else {
          invoice.expenses.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.description}: $${e.amount.toFixed(2)}`);
          });
        }

        const { action } = await inquirer.prompt({
          type: 'list',
          name: 'action',
          message: 'Expense Actions:',
          choices: [
            '➕ Add Expense',
            ...(invoice.expenses.length ? ['✏️ Edit Expense', '🗑️ Remove Expense'] : []),
            '⬅️ Back to Invoice'
          ]
        });

        switch (action) {
          case '➕ Add Expense':
            const newExp = await inquirer.prompt([
              { name: 'description', message: 'Description:' },
              {
                name: 'amount',
                message: 'Amount (USD):',
                validate: val => !isNaN(val) && val >= 0
              }
            ]);
            invoice.expenses.push({ description: newExp.description, amount: parseFloat(newExp.amount) });
            break;

          case '✏️ Edit Expense':
            const { toEdit } = await inquirer.prompt({
              type: 'list',
              name: 'toEdit',
              message: 'Choose an expense to edit:',
              choices: invoice.expenses.map((e, i) => ({
                name: `${e.description} - $${e.amount.toFixed(2)}`,
                value: i
              }))
            });

            const updated = await inquirer.prompt([
              {
                name: 'description',
                message: 'New description:',
                default: invoice.expenses[toEdit].description
              },
              {
                name: 'amount',
                message: 'New amount:',
                default: invoice.expenses[toEdit].amount,
                validate: val => !isNaN(val) && val >= 0
              }
            ]);
            invoice.expenses[toEdit] = {
              description: updated.description,
              amount: parseFloat(updated.amount)
            };
            break;

          case '🗑️ Remove Expense':
            const { toRemove } = await inquirer.prompt({
              type: 'list',
              name: 'toRemove',
              message: 'Select an expense to remove:',
              choices: invoice.expenses.map((e, i) => ({
                name: `${e.description} - $${e.amount.toFixed(2)}`,
                value: i
              }))
            });
            invoice.expenses.splice(toRemove, 1);
            break;

          case '⬅️ Back to Invoice':
            editingExpenses = false;
            break;
        }
      }
    }

    if (field === 'save') {
      // Recalculate total
      const workTotal = invoice.workLogs.reduce((sum, log) => sum + log.hours * invoice.hourlyRate, 0);
      const expenseTotal = invoice.expenses.reduce((sum, e) => sum + e.amount, 0);
      invoice.total = workTotal + expenseTotal;

      await invoice.save();
      console.log(`✅ Invoice #${invoice.invoiceNumber} saved.`);

      // Regenerate PDF
      generateInvoicePDF(invoice);
      const pdfPath = path.join(__dirname, '..', 'exports', `Invoice-${String(invoice.invoiceNumber).padStart(5, '0')}.pdf`);

      const { sendNow } = await inquirer.prompt({
        type: 'confirm',
        name: 'sendNow',
        message: 'Do you want to resend the invoice by email?'
      });

      if (sendNow) {
        try {
          await sendInvoiceEmail(invoice, pdfPath);
          console.log('📧 Email sent!');
        } catch (e) {
          console.error('❌ Email failed:', e.message);
        }
      }

      editing = false;
    }

    if (field === 'cancel') {
      console.log('❌ Canceled edit.');
      editing = false;
    }
  }
}

module.exports = editInvoice;
