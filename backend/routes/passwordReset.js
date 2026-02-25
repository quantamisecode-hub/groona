const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const { User } = require('../models/SchemaDefinitions'); 

// --- RESEND CLIENT INITIALIZATION ---
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 1. FORGOT PASSWORD ROUTE
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    
    // Security: Do not reveal if user does not exist
    if (!user) {
      console.log(`[Forgot Password] User not found for email: ${email}`);
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate token
    const token = crypto.randomBytes(20).toString('hex');

    // Update user with token and expiration (1 hour)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    user.markModified('resetPasswordToken');
    user.markModified('resetPasswordExpires');
    await user.save();

    // Create Reset Link
    // FRONTEND_URL must be set in .env
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      return res.status(500).json({ message: 'FRONTEND_URL not configured in server environment' });
    }
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    if (!resend) {
      return res.status(500).json({ message: 'Email service not configured. RESEND_API_KEY is missing.' });
    }

    const from = process.env.MAIL_FROM || 'Groona <no-reply@quantumisecode.com>';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Requested</h2>
        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p>Please click on the button below to complete the process:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="background-color: #f3f4f6; padding: 10px; word-break: break-all; border-radius: 5px;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
      </div>
    `;

    // Send the email using Resend
    await resend.emails.send({
      from: from,
      to: user.email,
      subject: 'Password Reset Request - Groona',
      html: html
    });
    console.log(`[Forgot Password] Email successfully sent to: ${email}`);
    res.json({ message: 'Reset email sent successfully.' });

  } catch (error) {
    console.error('[Forgot Password Error]', error);
    res.status(500).json({ message: 'Error sending email. Please check server logs.' });
  }
});

// 2. RESET PASSWORD ROUTE
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required' });
  }

  try {
    // Find user with valid token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    user.markModified('password');
    user.markModified('resetPasswordToken');
    user.markModified('resetPasswordExpires');
    
    await user.save();

    res.json({ success: true, message: 'Password has been successfully updated.' });

  } catch (error) {
    console.error('[Reset Password Error]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;