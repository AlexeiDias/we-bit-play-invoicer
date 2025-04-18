const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


function generateInvoicePDF(invoice) {
  const doc = new PDFDocument();

  const businessName = 'We Bit Play';
  const businessEmail = 'alexei@webitplay.com';
  const businessPhone = '415-656-5950';
  const website = 'www.webitplay.com';

  const filename = `Invoice-${String(invoice.invoiceNumber).padStart(5, '0')}.pdf`;
  const outputPath = path.join(__dirname, '..', 'exports', filename);
  doc.pipe(fs.createWriteStream(outputPath));

  // 🔝 Header: Logo/Name + Invoice Meta
  doc
    .fontSize(26)
    .fillColor('#333')
    .text(businessName.toUpperCase(), 50, 50);

  doc
    .fontSize(10)
    .fillColor('black')
    .text(`Email: ${businessEmail}`, 50, 80)
    .text(`Phone: ${businessPhone}`, 50, 95)
    .text(`Web: ${website}`, 50, 110);

  doc
    .fontSize(20)
    .text(`Invoice #${invoice.invoiceNumber}`, { align: 'right' })
    .fontSize(12)
    .text(`Date: ${new Date(invoice.date).toDateString()}`, { align: 'right' });

  doc.moveDown();

  // 🧾 Client Information
  doc.moveDown();
  doc.fontSize(16).text('Client Information');
  doc.fontSize(12)
    .text(`${invoice.client.name}`)
    .text(`${invoice.client.business}`)
    .text(`${invoice.client.address}`)
    .text(`Phone: ${invoice.client.phone}`)
    .text(`Email: ${invoice.client.email}`);

  // 🎯 Subtitle (only shown here!)
  if (invoice.subtitle && invoice.subtitle.trim() !== '') {
    doc.moveDown();
    doc.fontSize(14).fillColor('#555').text(invoice.subtitle);
    doc.fillColor('black');
  }

  // ✅ Work Log (moved above service breakdown)
  if (invoice.workLogs.length) {
    doc.moveDown();
    doc.fontSize(16).text('Work Log');
    invoice.workLogs.forEach(w => {
      doc.fontSize(12).text(`${w.description} - ${w.hours}h`);
    });
  }

  // 🧩 Service Breakdown
  if (invoice.serviceBreakdown && Object.keys(invoice.serviceBreakdown).length) {
    doc.moveDown();
    doc.fontSize(16).text('Service Breakdown');

    const sb = invoice.serviceBreakdown;
    doc.fontSize(12)
      .text(`Setup Start: ${sb.setupStart}`)
      .text(`Deposition Start: ${sb.depoStart}`)
      .text(`Deposition End: ${sb.depoEnd}`)
      .text(`Breakdown End: ${sb.breakdownEnd}`)
      .text(`Lunch Break: ${sb.lunchBreak} hours`)
      .text(`Total Deposition Duration: ${sb.totalHours} hours`);
  }

  // 💸 Expenses
  if (invoice.expenses.length > 0) {
    doc.moveDown();
    doc.fontSize(16).text('Expenses');
    invoice.expenses.forEach(e => {
      doc.fontSize(12).text(`${e.description} - $${e.amount.toFixed(2)}`);
    });
  }

  // 📝 Notes
  if (invoice.notes) {
    doc.moveDown();
    doc.fontSize(16).text('Notes');
    doc.fontSize(12).text(invoice.notes);
  }

  // 💰 Total
  doc.moveDown();
  doc.fontSize(16).text(`Total: $${invoice.total.toFixed(2)}`, { align: 'right' });

  doc.end();
  console.log(`📄 PDF generated: ${filename}`);
}

module.exports = { generateInvoicePDF };
