const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const SETTINGS_PATH = path.join(__dirname, '..', 'config', 'settings.json');

function loadSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return null;
  const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  return JSON.parse(data);
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

async function configureSettings() {
  let settings = loadSettings() || {
    freelancer: {}
  };

  let editing = true;
  while (editing) {
    const freelancer = settings.freelancer || {};

    const { field } = await inquirer.prompt({
      type: 'list',
      name: 'field',
      message: '⚙️ Select a setting to edit:',
      choices: [
        { name: `👤 Name: ${freelancer.name || 'not set'}`, value: 'name' },
        { name: `🏢 Business Name: ${freelancer.business || 'not set'}`, value: 'business' },
        { name: `📧 Email: ${freelancer.email || 'not set'}`, value: 'email' },
        { name: `📞 Phone: ${freelancer.phone || 'not set'}`, value: 'phone' },
        { name: `🏠 Address: ${freelancer.address || 'not set'}`, value: 'address' },
        { name: `🌐 Website: ${freelancer.website || 'not set'}`, value: 'website' },
        { name: `💼 Hourly Rate (In-person): $${settings.hourlyInPerson || 'not set'}`, value: 'hourlyInPerson' },
        { name: `💻 Hourly Rate (Remote): $${settings.hourlyRemote || 'not set'}`, value: 'hourlyRemote' },
        { name: `❌ Cancel Fee (Hours): ${settings.cancelHours || 'not set'}`, value: 'cancelHours' },
        new inquirer.Separator(),
        { name: '⬅️ Back to Main Menu', value: 'exit' }
      ]
    });

    if (field === 'exit') {
      editing = false;
      console.log('⚙️  Settings update complete.\n');
      continue;
    }

    const { value } = await inquirer.prompt({
      name: 'value',
      message: `✏️ Enter new value for "${field}":`,
      validate: val => {
        if (['hourlyInPerson', 'hourlyRemote', 'cancelHours'].includes(field)) {
          return !isNaN(val) && val >= 0 ? true : 'Enter a valid number';
        }
        return val.trim() !== '' ? true : 'Cannot be empty';
      },
      default:
        field in freelancer
          ? freelancer[field]
          : settings[field] || ''
    });

    // Update the field in the correct section
    if (['name', 'business', 'email', 'phone', 'address', 'website'].includes(field)) {
      settings.freelancer = settings.freelancer || {};
      settings.freelancer[field] = value;
    } else {
      settings[field] = field === 'cancelHours' ? parseFloat(value) : parseFloat(value);
    }

    saveSettings(settings);
    console.log(`✅ Updated ${field}!\n`);
  }
}

module.exports = {
  loadSettings,
  saveSettings,
  configureSettings
};
