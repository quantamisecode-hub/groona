const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const { getEmailTemplate } = require('../utils/emailTemplates');

/**
 * Centralized Email Service for Groona
 * Handles all email sending with a unified template system
 * Supports SMTP (preferred) and Resend SDK (fallback/legacy)
 */

let resendClient = null;
let smtpTransporter = null;

/**
 * Initialize Resend client
 */
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null; // Resend not configured
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

/**
 * Initialize SMTP Transporter
 */
function getSmtpTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // SMTP not configured
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return smtpTransporter;
}

/**
 * Get sender information from MAIL_FROM env variable
 */
function getSenderInfo() {
  return process.env.MAIL_FROM || 'Groona <no-reply@quantumisecode.com>';
}

/**
 * Send email using centralized template system
 * @param {Object} options - Email options
 * @param {string|Array} options.to - Recipient email(s)
 * @param {string} options.templateType - Type of email template (e.g., 'project_member_added', 'task_assigned', etc.)
 * @param {Object} options.data - Dynamic data for the template
 * @param {string} [options.subject] - Custom subject (optional, will use template default if not provided)
 * @param {string} [options.html] - Direct HTML content override (for legacy/auth support)
 * @returns {Promise<Object>} Email send result
 */
async function sendEmail({ to, templateType, data, subject, html: directHtml }) {
  const recipients = Array.isArray(to) ? to : [to];
  const sender = getSenderInfo();

  // 1. Prepare Content
  let emailHtml = directHtml;
  let emailSubject = subject;

  if (!emailHtml && templateType) {
    const template = getEmailTemplate(templateType, data);
    emailHtml = template.html;
    if (!emailSubject) emailSubject = template.defaultSubject;
  }

  if (!emailHtml) {
    console.error('[Email Service] Error: No content provided (template or direct HTML)');
    throw new Error('No email content provided');
  }

  // 2. Try SMTP First
  // DISABLED for now to stop error logs since we are using Resend
  /*
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: sender,
        to: recipients.join(', '),
        subject: emailSubject,
        html: emailHtml,
      });
      console.log('[Email Service] Email sent via SMTP:', {
        to: recipients,
        messageId: info.messageId
      });
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (smtpError) {
      console.error('[Email Service] SMTP Failed, trying fallback:', smtpError.message);
      // Fall through to Resend or Mock
    }
  }
  */

  // 3. Try Resend SDK
  const resend = getResendClient();
  if (resend) {
    try {
      const result = await resend.emails.send({
        from: sender,
        to: recipients,
        subject: emailSubject,
        html: emailHtml
      });

      // Enhanced logging for debugging
      console.log('[Email Service] Resend API Full Response:', JSON.stringify(result, null, 2));
      console.log('[Email Service] Email sent via Resend:', {
        to: recipients,
        messageId: result.data?.id || result.id,
        status: result.error ? 'FAILED' : 'SUCCESS'
      });

      if (result.error) {
        throw new Error(`Resend API Error: ${JSON.stringify(result.error)}`);
      }

      return {
        success: true,
        messageId: result.data?.id || result.id,
        provider: 'resend',
        fullResponse: result
      };
    } catch (resendError) {
      console.error('[Email Service] Resend Failed:', resendError.message);
      console.error('[Email Service] Resend Error Details:', resendError);
      // Fall through to Mock
    }
  }

  // 4. Mock / Dev Fallback
  console.log('[Email Service] Mock Email Sent (Check Console):');
  console.log('To:', recipients);
  console.log('Subject:', emailSubject);
  // console.log('Content:', emailHtml); // Commented out to reduce noise
  return { success: true, mock: true, provider: 'mock' };
}

/**
 * Send email to team members and admins
 * @param {Object} options - Email options
 * @param {Array} options.teamMembers - Array of team member emails
 * @param {Array} options.admins - Array of admin emails
 * @param {string} options.templateType - Type of email template
 * @param {Object} options.data - Dynamic data for the template
 * @param {string} [options.subject] - Custom subject
 */
async function sendEmailToTeamAndAdmins({ teamMembers = [], admins = [], templateType, data, subject }) {
  const allRecipients = [...new Set([...teamMembers, ...admins])]; // Remove duplicates

  if (allRecipients.length === 0) {
    console.log('[Email Service] No recipients to send email to');
    return { success: true, skipped: true };
  }

  return sendEmail({
    to: allRecipients,
    templateType,
    data,
    subject
  });
}

module.exports = {
  sendEmail,
  sendEmailToTeamAndAdmins,
  getResendClient,
  getSenderInfo
};
