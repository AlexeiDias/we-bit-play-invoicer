const inquirer = require('inquirer');
const {
  createInvoice,
  viewInvoices,
  deleteInvoice,
  editInvoice
} = require('../services/invoiceService');
const reportMenu = require('./reportMenu');
const { configureSettings } = require('../services/settingsService');
const clientManagementMenu = require('./clientManagementMenu');

async function mainMenu() {
  let exit = false;

  while (!exit) {
    console.log('🔁 Main menu rendering...'); // 👈 Place it here
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: '📋 Main Menu — Choose an action:',
      loop: false, // 🔥 disables looping
      choices: [
        '🧾 Create New Invoice',
        '📂 View All Invoices',
        '✏️ Edit an Invoice',
        '❌ Delete an Invoice',
        '📊 View Revenue Dashboard',
        '👤 Manage Clients',
        '⚙️ Settings',
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

      case '👤 Manage Clients':
        await clientManagementMenu(); // ✅ returns control properly
        break;

      case '⚙️ Settings':
        await configureSettings();
        break;

        case '🚪 Exit':
          console.log('👋 Exiting lecoFreelancer...');
          process.exit(0); // 💥 kill it clean
    }
  }
}

module.exports = mainMenu;
