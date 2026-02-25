require('dotenv').config(); // Load environment variables
const { Resend } = require('resend');

console.log('--- Email Config Debug (Resend) ---');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '****** (Exists)' : 'MISSING');
console.log('MAIL_FROM:', process.env.MAIL_FROM || 'Not set');
console.log('------------------------');

if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set in .env file');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.MAIL_FROM || 'Groona <no-reply@quantumisecode.com>';
const to = process.env.TEST_EMAIL || 'jxv781@gmail.com'; // You can set TEST_EMAIL in .env

async function sendTest() {
  try {
    const result = await resend.emails.send({
      from: from,
      to: to,
      subject: 'Test Email from Groona (Resend)',
      html: '<p>If you see this, your Resend email configuration works!</p>',
    });
    
    console.log('✅ Success! Message sent:');
    console.log('Message ID:', result.data?.id);
    console.log('To:', to);
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error(error);
  }
}

sendTest();