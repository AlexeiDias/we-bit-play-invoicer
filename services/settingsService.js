const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const SETTINGS_PATH = path.join(__dirname, '..', 'config', 'settings.json');

function loadSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return {};
  }
  const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  return JSON.parse(data);
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

async function configureSettings() {
  let settings = loadSettings();
  settings.services = settings.services || [];

  let editing = true;
  while (editing) {
    console.log('\n🛠️ Current Settings:');
    console.log(`💼 In-Person Rate: $${settings.hourlyInPerson || 'Not set'}`);
    console.log(`💻 Remote Rate: $${settings.hourlyRemote || 'Not set'}`);
    console.log(`❌ Cancel Fee (hrs): ${settings.cancelHours || 'Not set'}`);
    console.log(`🏢 Company: ${settings.businessName || 'Not set'}`);
    console.log(`📧 Email: ${settings.email || 'Not set'}`);
    console.log(`🧾 Services: ${settings.services.join(', ') || 'None added'}\n`);

    const { field } = await inquirer.prompt({
      type: 'list',
      name: 'field',
      message: 'Edit a setting:',
      choices: [
        '💼 Hourly In-Person Rate',
        '💻 Hourly Remote Rate',
        '❌ Cancelation Fee (hours)',
        '🏢 Name or Company',
        '📧 Email',
        '🧾 Manage Services',
        '✅ Save and Exit'
      ]
    });

    switch (field) {
      case '💼 Hourly In-Person Rate':
        const { inPerson } = await inquirer.prompt({
          name: 'inPerson',
          message: 'In-person hourly rate:',
          default: settings.hourlyInPerson || '',
          validate: val => !isNaN(val) && val > 0
        });
        settings.hourlyInPerson = parseFloat(inPerson);
        break;

      case '💻 Hourly Remote Rate':
        const { remote } = await inquirer.prompt({
          name: 'remote',
          message: 'Remote hourly rate:',
          default: settings.hourlyRemote || '',
          validate: val => !isNaN(val) && val > 0
        });
        settings.hourlyRemote = parseFloat(remote);
        break;

      case '❌ Cancelation Fee (hours)':
        const { cancelHours } = await inquirer.prompt({
          name: 'cancelHours',
          message: 'Cancelation fee (hours):',
          default: settings.cancelHours || 3,
          validate: val => !isNaN(val) && val >= 0
        });
        settings.cancelHours = parseFloat(cancelHours);
        break;

      case '🏢 Name or Company':
        const { businessName } = await inquirer.prompt({
          name: 'businessName',
          message: 'Business or personal name:',
          default: settings.businessName || ''
        });
        settings.businessName = businessName;
        break;

      case '📧 Email':
        const { email } = await inquirer.prompt({
          name: 'email',
          message: 'Business email:',
          default: settings.email || '',
          validate: val => val.includes('@')
        });
        settings.email = email;
        break;

      case '🧾 Manage Services':
        await manageServices(settings);
        break;

      case '✅ Save and Exit':
        editing = false;
        break;
    }
  }

  saveSettings(settings);
  console.log('✅ Settings updated!');
}

async function manageServices(settings) {
  let done = false;
  settings.services = settings.services || [];

  while (!done) {
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: '🧰 Service Management',
      choices: [
        '➕ Add Service',
        ...(settings.services.length > 0 ? ['✏️ Edit Service', '🗑️ Delete Service'] : []),
        '⬅️ Back'
      ]
    });

    switch (action) {
      case '➕ Add Service':
        const { serviceName } = await inquirer.prompt({
          name: 'serviceName',
          message: 'Enter service name (e.g. IT Support, Web Dev):',
          validate: input => input.trim().length > 0
        });

        settings.services.push(serviceName.trim());
        saveSettings(settings);
        console.log(`✅ Added service: ${serviceName}`);
        break;

      case '✏️ Edit Service':
        const editChoices = [...settings.services, new inquirer.Separator(), '⬅️ Back to Service Management'];
        const { selectedEdit } = await inquirer.prompt({
          type: 'list',
          name: 'selectedEdit',
          message: 'Which service do you want to rename?',
          choices: editChoices
        });

        if (selectedEdit === '⬅️ Back to Service Management') break;

        const { newName } = await inquirer.prompt({
          name: 'newName',
          message: `Rename "${selectedEdit}" to:`,
          default: selectedEdit
        });

        const indexEdit = settings.services.findIndex(s => s === selectedEdit);
        settings.services[indexEdit] = newName.trim();
        saveSettings(settings);
        console.log(`✏️ Renamed service to: ${newName}`);
        break;

      case '🗑️ Delete Service':
        const deleteChoices = [...settings.services, new inquirer.Separator(), '⬅️ Back to Service Management'];
        const { selectedDelete } = await inquirer.prompt({
          type: 'list',
          name: 'selectedDelete',
          message: 'Which service do you want to delete?',
          choices: deleteChoices
        });

        if (selectedDelete === '⬅️ Back to Service Management') break;

        settings.services = settings.services.filter(s => s !== selectedDelete);
        saveSettings(settings);
        console.log(`🗑️ Deleted service: ${selectedDelete}`);
        break;

      case '⬅️ Back':
        done = true;
        break;
    }
  }
}

module.exports = {
  loadSettings,
  saveSettings,
  configureSettings,
  manageServices
};
