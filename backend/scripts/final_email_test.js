const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sendEmail } = require('../services/emailService');

const testDelivery = async () => {
    const target = 'vidyarthpatel@gmail.com';
    console.log(`\n📧 Sending FINAL TEST email to: ${target}`);
    console.log('---------------------------------------------------');

    try {
        const result = await sendEmail({
            to: target,
            subject: `Groona Delivery Test - ${new Date().toLocaleTimeString()}`,
            html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
          <h2 style="color: #2563eb;">If you see this, email is working!</h2>
          <p>This email confirms that your backend can successfully send emails via <strong>Resend</strong>.</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            Sent from: Groona (via onboarding@resend.dev)<br>
            Time: ${new Date().toString()}
          </p>
        </div>
      `
        });

        console.log('---------------------------------------------------');
        if (result.provider === 'resend') {
            console.log(`✅ SUCCESS: Resend accepted the email.`);
            console.log(`🆔 Message ID: ${result.messageId}`);
            console.log(`\n📢 IMPORTANT PRE-FLIGHT CHECK:`);
            console.log(`1. Check your SPAM folder immediately.`);
            console.log(`2. If not there, check your Resend Dashboard > "Emails" tab.`);
            console.log(`   - If status is "Delivered": It is definitely in your inbox or spam.`);
            console.log(`   - If status is "Bounced": Your email is on a suppression list.`);
            console.log(`   - If status is "Failed": Resend rejected it.`);
        } else if (result.provider === 'smtp') {
            console.log(`✅ SUCCESS: Sent via SMTP.`);
        } else {
            console.log(`⚠️  WARNING: Sent via Mock/Fallback.`);
        }

    } catch (err) {
        console.error('❌ FAILED:', err.message);
    }
};

testDelivery();
