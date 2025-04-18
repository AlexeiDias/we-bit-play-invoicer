require('dotenv').config();

const mongoose = require('mongoose');
const mainMenu = require('./cli/mainMenu');
const { checkInitialSetup } = require('./services/initService');

async function startApp() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('✅ MongoDB connected');

  await checkInitialSetup(); // 🧠 Run first-time setup checks

  await mainMenu();
}

startApp();
