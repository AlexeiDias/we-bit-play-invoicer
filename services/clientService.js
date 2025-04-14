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

module.exports = {
  getOrCreateClient
};
