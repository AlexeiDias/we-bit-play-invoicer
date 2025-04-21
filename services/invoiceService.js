// invoiceService.js (partial)
const inquirer = require('inquirer');
const path = require('path');
const { exec } = require('child_process');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const { getOrCreateClient, createClient } = require('./clientService');
const { getNextInvoiceNumber } = require('../utils/counter');
const { generateInvoicePDF } = require('./pdfService');
const { sendInvoiceEmail } = require('./emailService');
const { loadSettings } = require('./settingsService');

// Time formatting helpers
function parseTime(str) {
  if (!str || !str.includes(':')) return null;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
function formatTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function createInvoice() {
  console.log('\n🧾 Creating New Invoice...\n');
  const settings = loadSettings();
  if (!settings) {
    console.log('⚠️ Settings not found. Go to ⚙️ Settings and set up your account.');
    return;
  }

  // 🔧 Init Wizard state
  let state = {
    client: null,
    jobType: 'In-Person',
    isCanceled: false,
    description: '',
    setupStart: '',
    depoEnd: '',
    lunchBreak: '0',
    notes: '',
    subtitle: '',
    expenses: []
  };

  // 🔍 Fetch all clients first
  const clients = await Client.find().sort({ name: 1 });

  if (!clients.length) {
    console.log('⚠️ No clients found.');
    const { createClient } = require('./clientService');
    const created = await createClient();
    if (!created) return;
    state.client = created;
  } else {
    // Build selection list with Add New
    const choices = clients.map(c => ({
      name: `${c.name} (${c.email})`,
      value: c._id
    }));
    choices.push(new inquirer.Separator());
    choices.push({ name: '➕ Add New Client', value: 'new' });

    const { clientChoice } = await inquirer.prompt({
      type: 'list',
      name: 'clientChoice',
      message: '👤 Select a client:',
      choices
    });

    if (clientChoice === 'new') {
      const { createClient } = require('./clientService');
      const newClient = await createClient();
      if (!newClient) return;
      state.client = newClient;
    } else {
      state.client = await Client.findById(clientChoice);
    }
  }

  // 🧩 Wizard fields
  const editableFields = () => {
    return [
      { name: `👤 Client: ${state.client?.name || '[not set]'}`, value: 'client' },
      { name: `💼 Job Type: ${state.jobType}`, value: 'jobType' },
      { name: `❌ Was Job Canceled?: ${state.isCanceled ? 'Yes' : 'No'}`, value: 'isCanceled' },
      ...(state.isCanceled ? [] : [
        { name: `📝 Description: ${state.description}`, value: 'description' },
        { name: `⏱️ Setup Start: ${state.setupStart}`, value: 'setupStart' },
        { name: `⏱️ Deposition End: ${state.depoEnd}`, value: 'depoEnd' },
        { name: `🥪 Lunch Break: ${state.lunchBreak} hrs`, value: 'lunchBreak' },
      ]),
      { name: `🧾 Expenses: ${state.expenses.length} item(s)`, value: 'expenses' },
      { name: `🗒️ Notes: ${state.notes}`, value: 'notes' },
      { name: `🔖 Subtitle: ${state.subtitle}`, value: 'subtitle' },
      new inquirer.Separator(),
      { name: '✅ Create Invoice', value: 'done' },
      { name: '❌ Cancel Invoice Creation', value: 'cancel' }
    ];
  };

  let editing = true;
  while (editing) {
    const { field } = await inquirer.prompt({
      type: 'list',
      name: 'field',
      message: '🛠️ What would you like to edit?',
      choices: editableFields()
    });

    switch (field) {
      case 'client':
        const allClients = await Client.find().sort({ name: 1 });
        const clientChoices = allClients.map(c => ({
          name: `${c.name} (${c.email})`,
          value: c._id
        }));
        clientChoices.push(new inquirer.Separator());
        clientChoices.push({ name: '➕ Add New Client', value: 'new' });

        const { clientChoice } = await inquirer.prompt({
          type: 'list',
          name: 'clientChoice',
          message: '👤 Select a client:',
          choices: clientChoices
        });

        if (clientChoice === 'new') {
          const { createClient } = require('./clientService');
          state.client = await createClient();
        } else {
          state.client = await Client.findById(clientChoice);
        }
        break;

      case 'jobType':
        const { jobType } = await inquirer.prompt({
          type: 'list',
          name: 'jobType',
          message: 'Job Type:',
          choices: ['In-Person', 'Remote']
        });
        state.jobType = jobType;
        break;

      case 'isCanceled':
        const { isCanceled } = await inquirer.prompt({
          type: 'confirm',
          name: 'isCanceled',
          message: 'Was the job canceled?'
        });
        state.isCanceled = isCanceled;
        break;

      case 'description':
        let description = '';
        if (settings.services && settings.services.length) {
          const { useCatalog } = await inquirer.prompt({
            type: 'confirm',
            name: 'useCatalog',
            message: 'Use a predefined service from your catalog?',
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
            const { custom } = await inquirer.prompt({
              name: 'custom',
              message: 'Describe the service:'
            });
            description = custom;
          }
        } else {
          const { custom } = await inquirer.prompt({
            name: 'custom',
            message: 'Describe the service:'
          });
          description = custom;
        }

        state.description = description;
        break;

      case 'setupStart':
        const { setupStart } = await inquirer.prompt({
          name: 'setupStart',
          message: 'Setup Start Time (e.g. 08:00):',
          default: state.setupStart
        });
        state.setupStart = setupStart;
        break;

      case 'depoEnd':
        const { depoEnd } = await inquirer.prompt({
          name: 'depoEnd',
          message: 'Deposition End Time (e.g. 12:00):',
          default: state.depoEnd
        });
        state.depoEnd = depoEnd;
        break;

      case 'lunchBreak':
        const { lunchBreak } = await inquirer.prompt({
          name: 'lunchBreak',
          message: 'Lunch Break (hours, e.g. 0.5):',
          default: state.lunchBreak
        });
        state.lunchBreak = lunchBreak;
        break;

      case 'expenses':
        state.expenses = await manageExpenses(state.expenses);
        break;

      case 'notes':
        const { notes } = await inquirer.prompt({
          name: 'notes',
          message: 'Notes:',
          default: state.notes
        });
        state.notes = notes;
        break;

      case 'subtitle':
        const { subtitle } = await inquirer.prompt({
          name: 'subtitle',
          message: 'Subtitle:',
          default: state.subtitle
        });
        state.subtitle = subtitle;
        break;

      case 'cancel':
        console.log('❌ Invoice creation canceled.');
        return;

      case 'done':
        editing = false;
        break;
    }
  }

  // ✅ Save invoice
  return await finalizeInvoice(state, settings);
}


module.exports = {
  createInvoice
};
