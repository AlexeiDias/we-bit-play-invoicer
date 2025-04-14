const inquirer = require('inquirer');
const { getYearlyReport } = require('../services/reportService');
const { exportToJSON, exportToCSV } = require('../utils/exporter');

async function reportMenu() {
  console.log('\n📊 Revenue Dashboard\n');

  const { year } = await inquirer.prompt({
    type: 'input',
    name: 'year',
    message: 'Enter year for report (e.g. 2024):',
    default: new Date().getFullYear()
  });

  const data = await getYearlyReport(year); // ✅ get the data BEFORE exporting

  console.log(`\n📅 Year: ${data.year}`);
  console.log(`📄 Invoices Issued: ${data.invoices}`);
  console.log(`⏱️ Total Hours: ${data.totalHours}`);
  console.log(`💰 Total Revenue: $${data.totalRevenue.toFixed(2)}`);
  console.log(`🧾 Total Expenses: $${data.totalExpenses.toFixed(2)}`);
  console.log(`📈 Net Income: $${data.netIncome.toFixed(2)}\n`);

  const { exportChoice } = await inquirer.prompt({
    type: 'list',
    name: 'exportChoice',
    message: 'Do you want to export this report?',
    choices: ['No', 'JSON', 'CSV', 'Both']
  });

  if (exportChoice === 'JSON' || exportChoice === 'Both') {
    exportToJSON(data, `revenue-${year}`);
  }
  if (exportChoice === 'CSV' || exportChoice === 'Both') {
    exportToCSV(data, `revenue-${year}`);
  }
}

module.exports = reportMenu;
