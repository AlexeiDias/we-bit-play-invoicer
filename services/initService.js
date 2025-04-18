const inquirer = require('inquirer');
const { configureSettings, loadSettings } = require('./settingsService');
const Client = require('../models/Client');
const { createClient } = require('./clientService');

async function checkInitialSetup() {
  let settings = loadSettings();

  if (!settings || !settings.hourlyInPerson || !settings.hourlyRemote) {
    console.log('\n⚠️ Settings are not configured.');

    const { proceed } = await inquirer.prompt({
      type: 'confirm',
      name: 'proceed',
      message: 'Would you like to configure your settings now?',
      default: true
    });

    if (proceed) {
      await configureSettings();
      settings = loadSettings();
    } else {
      console.log('🚫 You must configure your settings before using the app.');
      process.exit(1);
    }
  }

  const clientCount = await Client.countDocuments();

  if (clientCount === 0) {
    console.log('\n⚠️ No clients found in the system.');

    const { createNow } = await inquirer.prompt({
      type: 'confirm',
      name: 'createNow',
      message: 'Would you like to create your first client now?',
      default: true
    });

    if (createNow) {
      await createClient();
    } else {
      console.log('🚫 Cannot continue without at least one client.');
      process.exit(1);
    }
  }
}

module.exports = { checkInitialSetup };
