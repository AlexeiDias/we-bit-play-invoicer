const inquirer = require('inquirer');
const { createInvoice, viewInvoices, deleteInvoice, editInvoice } = require('../services/invoiceService');
const reportMenu = require('./reportMenu');

async function mainMenu() {
  let exit = false;

  while (!exit) {
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: '📋 Main Menu — Choose an action:',
      choices: [
        '🧾 Create New Invoice',
        '📂 View All Invoices',
        '✏️ Edit an Invoice',
        '❌ Delete an Invoice',
        '📊 View Revenue Dashboard',
        '🚪 Exit'
      ]
    });

    switch (action) {
      case '🧾 Create New Invoice':
        await createInvoice();
        break;
      case '📂 View All Invoices':
        await viewInvoices();
        break;
      case '✏️ Edit an Invoice':
        await editInvoice();
        break;
      case '❌ Delete an Invoice':
        await deleteInvoice();
        break;
      case '📊 View Revenue Dashboard':
        await reportMenu();
        break;
        case '🚪 Exit':
            console.log('👋 Exiting lecoFreelancer...');
            process.exit(0); // ✅ Exit cleanly
          
        break;
    }
  }
}

module.exports = mainMenu;
