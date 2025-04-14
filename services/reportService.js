const Invoice = require('../models/Invoice');

async function getYearlyReport(year) {
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31`);

  const invoices = await Invoice.find({
    date: { $gte: start, $lte: end }
  });

  let revenue = 0;
  let hours = 0;
  let expenses = 0;

  invoices.forEach(inv => {
    revenue += inv.total;
    hours += inv.workLogs.reduce((sum, log) => sum + log.hours, 0);
    expenses += inv.expenses.reduce((sum, e) => sum + e.amount, 0);
  });

  return {
    year,
    invoices: invoices.length,
    totalRevenue: revenue,
    totalHours: hours,
    totalExpenses: expenses,
    netIncome: revenue - expenses
  };
}

module.exports = { getYearlyReport };
