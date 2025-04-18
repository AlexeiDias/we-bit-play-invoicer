const Client = require('../models/Client');
const inquirer = require('inquirer');

async function getOrCreateClient() {
  const clients = await Client.find().sort({ name: 1 });

  let choices = clients.map(c => ({
    name: `${c.name} (${c.email})`,
    value: c._id
  }));

  choices.push(new inquirer.Separator(), { name: '➕ Add New Client', value: 'new' });

  const { clientChoice } = await inquirer.prompt({
    type: 'list',
    name: 'clientChoice',
    message: 'Select an existing client or add a new one:',
    choices
  });

  if (clientChoice === 'new') {
    const newClient = await inquirer.prompt([
      { name: 'name', message: 'Client Name:' },
      { name: 'business', message: 'Business Name:' },
      { name: 'address', message: 'Address:' },
      { name: 'phone', message: 'Phone:' },
      { name: 'email', message: 'Email:' }
    ]);

    const client = new Client(newClient);
    await client.save();
    return client;
  }

  return await Client.findById(clientChoice);
}

async function createClient() {
  const inquirer = require('inquirer');
  const Client = require('../models/Client');

  const newClient = await inquirer.prompt([
    { name: 'name', message: 'Client Name:' },
    { name: 'business', message: 'Business Name:' },
    { name: 'address', message: 'Client Address:' },
    { name: 'phone', message: 'Client Phone:' },
    { name: 'email', message: 'Client Email:' }
  ]);

  const client = new Client(newClient);
  await client.save();
  console.log(`✅ Client "${client.name}" created.`);
  return client;
}

async function editClient() {
  const clients = await Client.find().sort({ name: 1 });

  if (!clients.length) {
    console.log('⚠️ No clients to edit.');
    return;
  }

  const choices = clients.map(c => ({
    name: `${c.name} (${c.email})`,
    value: c._id
  }));

  const { id } = await inquirer.prompt({
    type: 'list',
    name: 'id',
    message: '📝 Select a client to edit:',
    choices
  });

  const client = await Client.findById(id);

  let editing = true;

  while (editing) {
    const { field } = await inquirer.prompt({
      type: 'list',
      name: 'field',
      message: `🎛️ Choose a field to update for "${client.name}":`,
      choices: [
        { name: `👤 Name: ${client.name}`, value: 'name' },
        { name: `🏢 Business: ${client.business}`, value: 'business' },
        { name: `🏠 Address: ${client.address}`, value: 'address' },
        { name: `📞 Phone: ${client.phone}`, value: 'phone' },
        { name: `📧 Email: ${client.email}`, value: 'email' },
        new inquirer.Separator(),
        { name: '⬅️ Done editing', value: 'done' }
      ],
      loop: false
    });

    if (field === 'done') break;

    const fieldMap = {
      name: 'New Name',
      business: 'New Business Name',
      address: 'New Address',
      phone: 'New Phone',
      email: 'New Email'
    };

    const { value } = await inquirer.prompt({
      name: 'value',
      message: `${fieldMap[field]}:`,
      default: client[field]
    });

    client[field] = value;
  }

  await client.save();
  console.log(`✅ Client "${client.name}" updated successfully.`);
}



async function deleteClient() {
  const clients = await Client.find().sort({ name: 1 });

  if (!clients.length) {
    console.log('⚠️ No clients to delete.');
    return;
  }

  const { clientId } = await inquirer.prompt({
    type: 'list',
    name: 'clientId',
    message: 'Select a client to delete:',
    choices: clients.map(c => ({
      name: `${c.name} (${c.email})`,
      value: c._id
    }))
  });

  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to delete this client? This action is permanent.'
  });

  if (confirm) {
    await Client.findByIdAndDelete(clientId);
    console.log('🗑️ Client deleted.');
  } else {
    console.log('❎ Deletion cancelled.');
  }
}



module.exports = {
  getOrCreateClient,
  createClient,
  editClient,
  deleteClient
};


