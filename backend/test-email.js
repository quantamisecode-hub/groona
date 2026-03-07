const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const emailService = require('./services/emailService');

async function testEmail() {
  console.log('Testing email service...');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set' : 'NOT Set');
  console.log('MAIL_FROM:', process.env.MAIL_FROM);

  try {
    const result = await emailService.sendEmail({
      to: 'abdul@quantumisecode.com', // Using a placeholder, change to user's email if safe
      templateType: 'impediment_reported',
      data: {
        recipientName: 'Abdul',
        recipientEmail: 'abdul@quantumisecode.com',
        reporterName: 'Test Reporter',
        taskTitle: 'Test Task',
        projectName: 'Test Project',
        title: 'Test Impediment',
        severity: 'High',
        description: 'Test Description',
        viewUrl: 'http://localhost:5173'
      }
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmail();