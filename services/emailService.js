const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

async function sendInvoiceEmail(invoice, pdfPath) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail', 'hotmail', etc.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"We Bit Play" <${process.env.EMAIL_USER}>`,
    to: invoice.client.email,
    subject: `Invoice #${invoice.invoiceNumber} from We Bit Play`,
    text: `Hi ${invoice.client.name},\n\nAttached is your invoice #${invoice.invoiceNumber}.\n\nThank you!`,
    attachments: [
      {
        filename: `Invoice-${String(invoice.invoiceNumber).padStart(5, '0')}.pdf`,
        path: pdfPath
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📤 Email sent to ${invoice.client.email}: ${info.response}`);
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
  }
}

module.exports = { sendInvoiceEmail };
