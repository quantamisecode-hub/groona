/* aivorabackend/routes/auth.js */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
// nodemailer removed - using Resend SDK now
const { User, Tenant, OTPVerification, UserSession, UserLog } = require('../models/SchemaDefinitions');
const auth = require('../middleware/auth');

// --- HELPER: Advanced User Agent Parser ---
const parseUserAgent = (uaString) => {
  if (!uaString) return { device_type: 'unknown', browser: 'Unknown', os: 'Unknown' };

  // 1. Detect Browser with Version
  let browser = 'Unknown Browser';
  if (/Edg\/([0-9.]+)/.test(uaString)) browser = `Edge ${RegExp.$1.split('.')[0]}`;
  else if (/Chrome\/([0-9.]+)/.test(uaString)) browser = `Chrome ${RegExp.$1.split('.')[0]}`;
  else if (/Firefox\/([0-9.]+)/.test(uaString)) browser = `Firefox ${RegExp.$1.split('.')[0]}`;
  else if (/Version\/([0-9.]+).*Safari/.test(uaString)) browser = `Safari ${RegExp.$1.split('.')[0]}`;
  else if (/MSIE|Trident/.test(uaString)) browser = 'Internet Explorer';

  // 2. Detect OS with Version
  let os = 'Unknown OS';
  if (/Windows NT 10.0/.test(uaString)) os = 'Windows 10/11';
  else if (/Windows NT 6.3/.test(uaString)) os = 'Windows 8.1';
  else if (/Windows NT 6.2/.test(uaString)) os = 'Windows 8';
  else if (/Windows NT 6.1/.test(uaString)) os = 'Windows 7';
  else if (/Mac OS X ([0-9_]+)/.test(uaString)) os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Android ([0-9.]+)/.test(uaString)) os = `Android ${RegExp.$1}`;
  else if (/iPhone OS ([0-9_]+)/.test(uaString)) os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Linux/.test(uaString)) os = 'Linux';

  // 3. Detect Device Type
  const device_type = /Mobile|Android|iPhone|iPad|iPod/i.test(uaString) ? 'mobile' : 'desktop';

  return { browser, os, device_type };
};

// --- HELPER: Get IST Date ---
// --- HELPER: Get IST Date ---
const getISTDate = () => {
  // Directly add 5.5 hours (330 minutes) to current time to force IST display in DB
  return new Date(Date.now() + (330 * 60000));
};

// --- HELPER: Get Client IP ---
const getClientIp = (req) => {
  // Check headers first (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // Fallback to connection IP
  let ip = req.ip || req.connection.remoteAddress || 'Unknown';

  // Clean up IPv6 mapped IPv4 addresses
  if (ip.substr(0, 7) === "::ffff:") {
    ip = ip.substr(7);
  }
  return ip;
};

// --- HELPER: Get Location from IP Address ---
async function getLocationFromIp(ip) {
  // Skip for localhost or private IPs
  if (!ip || ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return 'Local Network';
  }

  try {
    // Using ip-api.com (free, no API key required, 45 requests/minute limit)
    const https = require('https');
    const url = `https://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'success') {
              const location = [result.city, result.regionName, result.country]
                .filter(Boolean)
                .join(', ');
              resolve(location || 'Unknown Location');
            } else {
              resolve('Unknown Location');
            }
          } catch (err) {
            resolve('Unknown Location');
          }
        });
      }).on('error', () => {
        resolve('Unknown Location');
      }).setTimeout(3000, () => {
        resolve('Unknown Location');
      });
    });
  } catch (error) {
    console.error('Error getting location from IP:', error);
    return 'Unknown Location';
  }
}

// --- HELPER: Extract Device Name from User Agent ---
function getDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device';

  const ua = userAgent.toLowerCase();

  // Extract device model/brand from user agent
  if (/iphone/i.test(userAgent)) {
    const match = userAgent.match(/iPhone\s*OS\s*([\d_]+)/i);
    return match ? `iPhone (iOS ${match[1].replace(/_/g, '.')})` : 'iPhone';
  }
  if (/ipad/i.test(userAgent)) {
    const match = userAgent.match(/OS\s*([\d_]+)/i);
    return match ? `iPad (iOS ${match[1].replace(/_/g, '.')})` : 'iPad';
  }
  if (/android/i.test(userAgent)) {
    // Try to extract device model
    const modelMatch = userAgent.match(/;\s*([^)]+)\s*\)/);
    if (modelMatch) {
      return `Android Device (${modelMatch[1]})`;
    }
    return 'Android Device';
  }
  if (/windows/i.test(userAgent)) {
    const osMatch = userAgent.match(/Windows\s*NT\s*([\d.]+)/i);
    if (osMatch) {
      const version = osMatch[1];
      if (version === '10.0') return 'Windows 10/11 PC';
      if (version === '6.3') return 'Windows 8.1 PC';
      if (version === '6.2') return 'Windows 8 PC';
      if (version === '6.1') return 'Windows 7 PC';
    }
    return 'Windows PC';
  }
  if (/macintosh|mac os x/i.test(userAgent)) {
    const osMatch = userAgent.match(/Mac\s*OS\s*X\s*([\d_]+)/i);
    if (osMatch) {
      return `Mac (macOS ${osMatch[1].replace(/_/g, '.')})`;
    }
    return 'Mac';
  }
  if (/linux/i.test(userAgent)) {
    return 'Linux PC';
  }

  // Fallback: use browser and OS info
  const parsed = parseUserAgent(userAgent);
  return `${parsed.os} - ${parsed.browser}`;
}

// --- ASYNC FUNCTION: Handle Failed Login Attempts ---
async function handleFailedLoginAttempt(email, user, req) {
  try {
    const FailedLoginAttempt = require('../models/SchemaDefinitions').FailedLoginAttempt || null;
    if (!FailedLoginAttempt) {
      console.warn('FailedLoginAttempt model not found');
      return;
    }

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Get location asynchronously and device name synchronously
    const location = await getLocationFromIp(ip);
    const deviceName = getDeviceName(userAgent);

    // Update or create failed login attempt record
    const attempt = await FailedLoginAttempt.findOneAndUpdate(
      { email },
      {
        $inc: { attempt_count: 1 },
        $set: {
          last_attempt_time: new Date(),
          ip_address: ip,
          user_agent: userAgent,
          location: location,
          device_name: deviceName
        }
      },
      { upsert: true, new: true }
    );

    // Send email notification only on the 3rd attempt (exactly 3)
    if (attempt.attempt_count === 3) {
      try {
        const emailService = require('../services/emailService');
        await emailService.sendEmail({
          to: email,
          templateType: 'failed_login_attempts',
          data: {
            userName: user.full_name || email,
            userEmail: email,
            attemptCount: attempt.attempt_count,
            lastAttemptTime: attempt.last_attempt_time,
            ipAddress: ip,
            location: location,
            deviceName: deviceName,
            userAgent: userAgent
          }
        });
        console.log(`[Failed Login] Email sent to ${email} after 3 failed attempts`);
      } catch (emailError) {
        console.error('[Failed Login] Error sending email notification:', emailError);
        // Don't throw - we still want to track the attempt even if email fails
      }
    }
  } catch (error) {
    console.error('[Failed Login] Error handling failed login attempt:', error);
    // Don't throw - we don't want to break the login flow
  }
}

// --- HELPER: Log User Login ---
async function logUserLogin(user, session, req) {
  try {
    const UserLog = require('../models/SchemaDefinitions').UserLog;
    const User = require('../models/SchemaDefinitions').User;

    // Calculate IST Time
    const istTime = getISTDate();

    // 1. Update User Table with IST Login Time
    if (User && user) {
      await User.findByIdAndUpdate(user._id || user.id, {
        last_login: istTime
      });
    }

    if (!UserLog) return;

    const ua = parseUserAgent(req.headers['user-agent']);
    const deviceInfo = `${ua.os} - ${ua.browser} (${ua.device_type})`;


    // --- Timesheet Stats Calculation ---
    const Task = require('../models/SchemaDefinitions').Task;
    const Timesheet = require('../models/SchemaDefinitions').Timesheet;
    let assignedCount = 0;
    let pendingCount = 0;

    if (Task && Timesheet) {
      try {
        // 1. Get ALL Tasks Assigned to User (Lifetime)
        const allTasks = await Task.find({
          assigned_to: user.email
        });
        assignedCount = allTasks.length;

        // 2. Get Timesheets for TODAY (IST)
        const todayIST = getISTDate();
        const startOfDay = new Date(todayIST);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(todayIST);
        endOfDay.setHours(23, 59, 59, 999);

        // Convert back to UTC for DB query if stored as ISODate, 
        // BUT Timesheet 'date' is a string 'YYYY-MM-DD' usually.
        // Let's check Timesheet schema... 'date' is string format date.
        // So we need 'YYYY-MM-DD' string of IST today.
        const dateString = todayIST.toISOString().split('T')[0];

        // Find unique tasks that have timesheets for today
        const todaysTimesheets = await Timesheet.find({
          user_email: user.email,
          date: dateString
        });

        // 3. Lifetime Submitted Timesheets
        const lifetimeTimesheets = await Timesheet.find({
          user_email: user.email
        });
        user.lifetimeCount = lifetimeTimesheets.length;

        // 4. Pending Today = Active Tasks that don't have a log today
        const activeTasks = allTasks.filter(t => !['completed', 'archived', 'done'].includes(t.status));
        const loggedTaskIds = new Set(todaysTimesheets.map(t => t.task_id));
        const pendingTasks = activeTasks.filter(t => !loggedTaskIds.has(t._id.toString()));
        pendingCount = pendingTasks.length;

        // Count of timesheets submitted TODAY
        const todayCount = todaysTimesheets.length;
        user.todayCountToday = todayCount; // Temporarily store for log update

      } catch (statsErr) {
        console.error('[UserLog] Error calculating stats:', statsErr);
      }
    }

    // --- Log Activity Metrics Snapshot ---
    try {
      const { logUserMetrics } = require('../utils/userMetricsLogger');
      await logUserMetrics(user.email, 'login', user.tenant_id);
    } catch (metricErr) {
      console.error("Failed to log user metrics:", metricErr);
    }

    // Still perform session logging as before
    // Use findOneAndUpdate with upsert: true to ensure only one record per user
    await UserLog.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          user_id: user._id || user.id,
          email: user.email,
          tenant_id: user.tenant_id,
          session_id: session._id || session.id,
          login_time: istTime,
          logout_time: null, // Reset logout time on new login
          ip_address: getClientIp(req),
          device_info: deviceInfo,
          // Snapshot of working schedule
          scheduled_working_start: user.working_hours_start || "",
          scheduled_working_end: user.working_hours_end || "",
          scheduled_working_days: user.working_days || [],
          present_working_day: istTime.toLocaleDateString('en-US', { weekday: 'short' }),
          // Timesheet Stats (Snapshot for session)
          total_assigned_tasks: assignedCount,
          pending_log_count: pendingCount,
          submitted_timesheets_count: user.lifetimeCount || 0, // Lifetime count
          today_submitted_timesheets_count: user.todayCountToday || 0,
          updated_date: istTime
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[UserLog] Logged login (IST) for ${user.email}`);
  } catch (error) {
    console.error('[UserLog] Failed to log login:', error);
  }
}

// --- HELPER: Send Email using Resend ---
async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.log("Mock Email:", { to, subject });
    return;
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.MAIL_FROM || 'Groona <no-reply@quantumisecode.com>';

  await resend.emails.send({
    from: from,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: html
  });
}

// @route   POST api/auth/send-email-verification-otp
router.post('/send-email-verification-otp', async (req, res) => {
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
  const ip = getClientIp(req);

  // STRICT VALIDATION: Email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // SECURITY: Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please sign in instead.' });
    }

    // SECURITY: Rate limiting - Check attempts in last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentAttempts = await OTPVerification.countDocuments({
      email,
      purpose: 'email_verification',
      createdAt: { $gte: fifteenMinutesAgo }
    });

    if (recentAttempts >= 5) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again in 15 minutes.' });
    }

    // SECURITY: Rate limiting per IP
    const ipAttempts = await OTPVerification.countDocuments({
      ip_address: ip,
      purpose: 'email_verification',
      createdAt: { $gte: fifteenMinutesAgo }
    });

    if (ipAttempts >= 10) {
      return res.status(429).json({ error: 'Too many requests from this IP. Please try again later.' });
    }

    // Generate 6-digit numeric OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false
    });

    // Store OTP with expiration (10 minutes) and security metadata
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const now = new Date();
    await OTPVerification.findOneAndUpdate(
      { email, purpose: 'email_verification' },
      {
        email,
        otp,
        expiresAt,
        purpose: 'email_verification',
        ip_address: ip,
        attempts: 0,
        verified: false,
        createdAt: now,
        created_date: now
      },
      { upsert: true, new: true }
    );

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Email Verification</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #1f2937; margin-bottom: 20px;">Hello,</p>
          <p style="font-size: 16px; color: #4b5563; margin-bottom: 30px;">Please use the following verification code to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background: #eff6ff; padding: 20px 40px; border-radius: 8px; border: 2px dashed #3b82f6;">
              <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">${otp}</span>
            </div>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">This code will expire in 10 minutes.</p>
          <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">If you didn't request this code, please ignore this email.</p>
        </div>
      </div>
    `;

    await sendEmail(email, "Verify Your Email - Groona", emailHtml);

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresIn: 600 // seconds
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// @route   POST api/auth/verify-email-otp
router.post('/verify-email-otp', async (req, res) => {
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
  const otp = req.body.otp ? req.body.otp.trim() : '';
  const ip = getClientIp(req);

  // STRICT VALIDATION
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  // Validate OTP format (6 digits)
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be 6 digits' });
  }

  try {
    // Find OTP record
    const record = await OTPVerification.findOne({
      email,
      otp,
      purpose: 'email_verification'
    });

    if (!record) {
      // SECURITY: Track failed attempts
      await OTPVerification.findOneAndUpdate(
        { email, purpose: 'email_verification' },
        { $inc: { attempts: 1 } },
        { upsert: true }
      );

      // Check if too many failed attempts
      const failedRecord = await OTPVerification.findOne({ email, purpose: 'email_verification' });
      if (failedRecord && failedRecord.attempts >= 5) {
        return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
      }

      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      await OTPVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // SECURITY: Check attempts
    if (record.attempts >= 5) {
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
    }

    // Mark as verified and store verification token
    const verificationToken = jwt.sign(
      { email, verified: true, purpose: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' } // Verification valid for 30 minutes
    );

    await OTPVerification.findOneAndUpdate(
      { _id: record._id },
      {
        verified: true,
        verifiedAt: new Date(),
        verificationToken,
        ip_address: ip
      }
    );

    res.json({
      success: true,
      message: 'Email verified successfully',
      verificationToken
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify code. Please try again.' });
  }
});

// @route   POST api/auth/register
router.post('/register', async (req, res) => {
  const { password, full_name, company_name, verificationToken } = req.body;
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';

  // STRICT VALIDATION: Check if email is verified
  if (!verificationToken) {
    return res.status(400).json({ error: 'Please verify your email address before registering' });
  }

  try {
    // Verify the verification token
    let decoded;
    try {
      decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
      if (!decoded.verified || decoded.email !== email || decoded.purpose !== 'email_verification') {
        return res.status(400).json({ error: 'Invalid or expired email verification. Please verify your email again.' });
      }
    } catch (jwtError) {
      return res.status(400).json({ error: 'Invalid or expired email verification. Please verify your email again.' });
    }

    // Check if email is still verified in database
    const verificationRecord = await OTPVerification.findOne({
      email,
      purpose: 'email_verification',
      verified: true,
      verificationToken
    });

    if (!verificationRecord) {
      return res.status(400).json({ error: 'Email verification not found or expired. Please verify your email again.' });
    }

    // Check if verification is still valid (within 30 minutes)
    const verificationAge = Date.now() - new Date(verificationRecord.verifiedAt).getTime();
    if (verificationAge > 30 * 60 * 1000) {
      await OTPVerification.deleteOne({ _id: verificationRecord._id });
      return res.status(400).json({ error: 'Email verification has expired. Please verify your email again.' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Calculate trial end date (14 days from now)
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(now.getDate() + 14);

    const newTenant = new Tenant({
      name: company_name || `${full_name}'s Workspace`,
      owner_email: email,
      status: 'trial',
      subscription_plan: 'free',
      subscription_type: 'trial',
      subscription_status: 'trialing',
      trial_ends_at: trialEndDate.toISOString(),
      subscription_start_date: now.toISOString(),
      onboarding_completed: false,
      max_users: 10,
      max_projects: 20,
      max_storage_gb: 5,
      features_enabled: {
        ai_assistant: true,
        code_review: false,
        advanced_analytics: false,
        custom_branding: false,
        api_access: false,
      }
    });
    await newTenant.save();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      full_name,
      email,
      password: hashedPassword,
      role: 'admin',
      custom_role: 'owner',
      tenant_id: newTenant.id.toString(),
      is_super_admin: false,
      is_two_factor_enabled: false
    });

    await user.save();

    newTenant.owner_user_id = user.id;
    await newTenant.save();

    // Create Session
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = getClientIp(req);

    const session = new UserSession({
      user_id: user.id,
      ip_address: ip,
      device_type: ua.device_type,
      browser: ua.browser,
      os: ua.os,
      location: (ip === '::1' || ip === '127.0.0.1') ? 'Localhost' : 'Unknown Location',
      last_active: new Date()
    });
    await session.save();

    // Log the login
    await logUserLogin(user, session, req);

    const payload = {
      user: { id: user.id, tenant_id: user.tenant_id, session_id: session.id }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, tenant_id: user.tenant_id } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/login
router.post('/login', async (req, res) => {
  const { password, emailTemplate } = req.body;
  const email = req.body.email ? req.body.email.toLowerCase() : '';

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // 1. Check User Status Restriction
    if (user.status === 'inactive') {
      return res.status(403).json({
        msg: 'You are restricted to access dashboard. Contact administration regarding this message.'
      });
    }

    // 2. Check Client Organization Status (if applicable)
    if (user.client_id) {
      const { Client } = require('../models/SchemaDefinitions'); // Lazy load to avoid circular deps if any
      const clientOrg = await Client.findById(user.client_id);
      if (clientOrg && clientOrg.status === 'inactive') {
        return res.status(403).json({
          msg: 'You are restricted to access dashboard. Contact administration regarding this message.'
        });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Handle failed login attempt asynchronously (don't await to avoid blocking response)
      handleFailedLoginAttempt(email, user, req).catch(err => {
        console.error('[Login] Error in failed login attempt handler:', err);
      });

      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Reset failed login attempts on successful login
    const FailedLoginAttempt = require('../models/SchemaDefinitions').FailedLoginAttempt || null;
    if (FailedLoginAttempt) {
      await FailedLoginAttempt.deleteOne({ email });
    }

    if (user.is_two_factor_enabled) {
      const otp = otpGenerator.generate(6, { digits: true, lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

      await OTPVerification.findOneAndUpdate(
        { email },
        { email, otp, expiresAt: new Date(Date.now() + 10 * 60000) },
        { upsert: true, new: true }
      );

      const emailHtml = emailTemplate
        ? emailTemplate.replace('{{OTP}}', otp)
        : `<p>Your code is: <b>${otp}</b></p>`;

      await sendEmail(email, "Your Groona Verification Code", emailHtml);

      return res.json({ require_otp: true, email: user.email, msg: 'Verification code sent' });
    }

    // --- Create Real Session ---
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = getClientIp(req);

    const session = new UserSession({
      user_id: user.id,
      ip_address: ip,
      device_type: ua.device_type,
      browser: ua.browser,
      os: ua.os,
      location: (ip === '::1' || ip === '127.0.0.1') ? 'Localhost' : 'Unknown Location',
      last_active: new Date()
    });
    await session.save();

    // Log the login
    await logUserLogin(user, session, req);

    const payload = {
      user: { id: user.id, tenant_id: user.tenant_id, session_id: session.id }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        const userResponse = user.toObject();
        delete userResponse.password;
        res.json({ token, user: userResponse });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Update session last_active
    if (req.user.session_id) {
      await UserSession.findByIdAndUpdate(req.user.session_id, { last_active: new Date() });
    }

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/auth/updatedetails
router.put('/updatedetails', auth, async (req, res) => {
  try {
    const { password, ...updateData } = req.body;

    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/auth/change-password
// @desc    Secure password change with verification
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Verify Old Password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect current password' });
    }

    // Hash & Set New Password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Optional: Revoke all other sessions for security
    await UserSession.deleteMany({ user_id: req.user.id, _id: { $ne: req.user.session_id } });

    res.json({ success: true, msg: 'Password updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- SESSION MANAGEMENT ROUTES ---

// @route   GET api/auth/sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await UserSession.find({ user_id: req.user.id }).sort({ last_active: -1 });

    // Mark current session
    const processedSessions = sessions.map(s => ({
      ...s.toObject(),
      is_current: s._id.toString() === req.user.session_id
    }));

    res.json(processedSessions);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/auth/sessions/:id
router.delete('/sessions/:id', auth, async (req, res) => {
  try {
    await UserSession.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    res.json({ success: true, msg: 'Session revoked' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/auth/sessions-others
router.delete('/sessions-others', auth, async (req, res) => {
  try {
    // Delete all sessions except current one
    await UserSession.deleteMany({
      user_id: req.user.id,
      _id: { $ne: req.user.session_id }
    });
    res.json({ success: true, msg: 'All other sessions revoked' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/auth/logout
router.post('/logout', auth, async (req, res) => {
  try {
    const sessionId = req.user?.session_id;
    console.log(`[Logout] Attempting logout for session: ${sessionId}`);

    // 1. Find the active UserLog for this session and set logout_time
    if (sessionId) {
      try {
        const UserLogModel = mongoose.model('UserLog');
        await UserLogModel.findOneAndUpdate(
          { session_id: sessionId },
          { logout_time: getISTDate() }
        );
      } catch (logErr) {
        console.warn('[Logout] Could not update UserLog:', logErr.message);
      }

      // 2. Remove the session
      try {
        const UserSessionModel = mongoose.model('UserSession');
        await UserSessionModel.findByIdAndDelete(sessionId);
      } catch (sessErr) {
        console.warn('[Logout] Could not delete UserSession:', sessErr.message);
      }
    }

    res.json({ success: true, msg: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout Error:', err);
    res.status(500).json({ msg: 'Server Error during logout', error: err.message });
  }
});

// --- Invite Routes ---
router.post('/accept-invite', async (req, res) => {
  const { password, full_name, tenant_id, role, custom_role, working_hours_start, working_hours_end, working_days } = req.body;
  const email = req.body.email ? req.body.email.toLowerCase() : '';

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists. Please login instead.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let validRole;
    if (custom_role === 'project_manager') {
      validRole = 'admin'; // Project managers have admin role
    } else if (custom_role === 'viewer') {
      validRole = 'member';
    } else {
      validRole = (!role || role === 'user') ? 'member' : role;
    }

    user = new User({
      email,
      password: hashedPassword,
      full_name,
      tenant_id,
      role: validRole,
      custom_role: custom_role || 'viewer',
      working_hours_start,
      working_hours_end,
      working_days,
      is_super_admin: false,
      status: 'active',
      is_two_factor_enabled: false
    });

    await user.save();

    // Create Session
    const ua = parseUserAgent(req.headers['user-agent']);
    const ip = getClientIp(req);

    const session = new UserSession({
      user_id: user.id,
      ip_address: ip,
      device_type: ua.device_type,
      browser: ua.browser,
      os: ua.os,
      location: (ip === '::1' || ip === '127.0.0.1') ? 'Localhost' : 'Unknown Location',
      last_active: new Date()
    });
    await session.save();

    // Log the login
    await logUserLogin(user, session, req);

    const payload = {
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        session_id: session.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        const userResponse = user.toObject();
        delete userResponse.password;
        res.json({ token, user: userResponse, msg: 'Invitation accepted successfully' });
      }
    );

  } catch (err) {
    console.error("Accept Invite Error:", err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ msg: `Validation Error: ${err.message}` });
    }
    res.status(500).json({ msg: 'Server error processing invitation' });
  }
});

module.exports = router;