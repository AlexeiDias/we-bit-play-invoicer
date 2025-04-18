const inquirer = require('inquirer');
const { createClient, editClient, deleteClient } = require('../services/clientService');

async function clientManagementMenu() {
    let exit = false;
  
    while (!exit) {
      const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: '👤 Client Management',
        choices: [
          '➕ Add Client',
          '✏️ Edit Client',
          '🗑️ Delete Client',
          '⬅️ Back to Main Menu'
        ]
      });
  
      switch (action) {
        case '➕ Add Client':
          await createClient();
          break;
        case '✏️ Edit Client':
          await editClient();
          break;
        case '🗑️ Delete Client':
          await deleteClient();
          break;
        case '⬅️ Back to Main Menu':
          exit = true;
          break;
      }
    }
  }
  

module.exports = clientManagementMenu;
