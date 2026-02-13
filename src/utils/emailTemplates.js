// src/utils/emailTemplates.js

export const getOtpEmailTemplate = (otpPlaceholder = '{{OTP}}') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f6f8; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 500px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 40px 0; text-align: center; }
    .logo-text { color: #ffffff; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
    .content { padding: 40px 32px; text-align: center; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }
    .message { font-size: 15px; color: #64748b; margin-bottom: 32px; line-height: 1.6; }
    .otp-wrapper { margin: 32px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; color: #2563eb; letter-spacing: 6px; background-color: #eff6ff; padding: 20px 32px; border-radius: 12px; display: inline-block; border: 2px dashed #bfdbfe; }
    .validity { font-size: 13px; color: #94a3b8; margin-top: 16px; }
    .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .secure-badge { display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo-text">Groona</h1>
    </div>
    <div class="content">
      <div class="greeting">Secure Sign In</div>
      <p class="message">Use the verification code below to complete your secure sign-in attempt. Do not share this code with anyone.</p>
      
      <div class="otp-wrapper">
        <div class="otp-code">${otpPlaceholder}</div>
      </div>
      
      <div class="validity">
        <span class="secure-badge">🔒 Secure Verification</span>
        <br/><br/>
        This code is valid for 10 minutes.
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Groona Platform. All rights reserved.</p>
      <p>If you didn't request this code, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;
