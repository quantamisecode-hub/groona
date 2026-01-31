const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Resend } = require('resend');

const debugEmailStatus = async (info) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailId = 'de037da5-9c99-4638-800e-1c856388ec95'; // ID from user logs

    console.log(`\n🔍 Checking status for Email ID: ${emailId}`);
    try {
        const { data, error } = await resend.emails.get(emailId);

        if (error) {
            console.error('❌ Error fetching status:', error);
            return;
        }

        console.log('---------------------------------------------------');
        console.log(`📅 Created At: ${data.created_at}`);
        console.log(`📧 To: ${data.to}`);
        console.log(`📤 From: ${data.from}`);
        console.log(`subject: ${data.subject}`);
        console.log(`\n📊 STATUS: ${data.last_event.toUpperCase() || 'UNKNOWN'}`);
        console.log('---------------------------------------------------');

        if (data.last_event === 'delivered') {
            console.log('✅ Status is DELIVERED. The email IS in the inbox or spam folder.');
            console.log('👉 Action: Check Spam/Junk/Promotions folders carefully.');
        } else if (data.last_event === 'bounced') {
            console.log('🔴 Status is BOUNCED. The email was rejected.');
            console.log('👉 Action: Check Resend Dashboard > "Suppressions" to unblock this email.');
        } else if (data.last_event === 'complained') {
            console.log('🔴 Status is COMPLAINED. The user marked it as spam.');
        } else {
            console.log(`ℹ️ Current status is: ${data.last_event}`);
        }

    } catch (err) {
        console.error('❌ Exception:', err.message);
    }
}

debugEmailStatus();
