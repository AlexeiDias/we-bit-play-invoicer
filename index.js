require('dotenv').config();
const connectDB = require('./db/connect');
const mainMenu = require('./cli/mainMenu');

(async () => {
  console.log("🔌 Connecting to MongoDB...");
  await connectDB();

  console.log("📋 Launching Main Menu...");
  await mainMenu();
})();
