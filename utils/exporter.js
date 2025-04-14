const fs = require('fs');
const path = require('path');

function exportToJSON(data, filename) {
  const filepath = path.join(__dirname, '..', 'exports', `${filename}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`📁 Exported to ${filepath}`);
}

function exportToCSV(data, filename) {
  const filepath = path.join(__dirname, '..', 'exports', `${filename}.csv`);
  const rows = [
    ['Year', 'Invoices', 'TotalHours', 'Revenue', 'Expenses', 'NetIncome'],
    [
      data.year,
      data.invoices,
      data.totalHours,
      data.totalRevenue.toFixed(2),
      data.totalExpenses.toFixed(2),
      data.netIncome.toFixed(2)
    ]
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  fs.writeFileSync(filepath, csv);
  console.log(`📁 Exported to ${filepath}`);
}

module.exports = {
  exportToJSON,
  exportToCSV
};
