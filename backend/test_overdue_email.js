const dotenv = require('dotenv');
const path = require('path');
const { sendEmail } = require('./services/emailService');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testEmail() {
    console.log('Testing Multiple Overdue Alarm Email...');
    try {
        const result = await sendEmail({
            to: 'abdulsamad.ce@gmail.com', // Using a test email
            templateType: 'multiple_overdue_alarm',
            data: {
                userName: 'Test User',
                userEmail: 'abdulsamad.ce@gmail.com',
                overdueCount: 5,
                taskTitles: 'Task A, Task B, Task C',
                dashboardUrl: 'http://localhost:3000/Dashboard'
            },
            subject: '🚨 TEST ALARM: 5 Tasks Overdue!'
        });
        console.log('Email Result:', result);
    } catch (error) {
        console.error('Email Test Failed:', error);
    }
}

testEmail();
