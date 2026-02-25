// aivorabackend/utils/clientEmailTemplates.js

/**
 * Modern Client Email Templates for Groona
 * Styled with a clean, professional look consistent with the platform.
 */

const styles = {
  body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
  container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
  header: "background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 0; text-align: center;",
  headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
  content: "padding: 40px 40px;",
  greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
  text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
  credentialBox: "background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;",
  credentialRow: "margin: 8px 0; font-size: 14px; color: #475569;",
  code: "font-family: 'Courier New', monospace; background: #e2e8f0; color: #0f172a; padding: 4px 8px; border-radius: 4px; font-weight: 600; border: 1px solid #cbd5e1;",
  buttonGroup: "text-align: center; margin-top: 32px; margin-bottom: 16px;",
  primaryBtn: "display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin-right: 12px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);",
  secondaryBtn: "display: inline-block; background-color: #ffffff; color: #475569; padding: 11px 27px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; border: 1px solid #cbd5e1;",
  divider: "height: 1px; background-color: #e2e8f0; margin: 32px 0;",
  footer: "background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;",
  link: "color: #2563eb; text-decoration: none;"
};

/**
 * Generates the HTML for a client invitation email with credentials.
 * @param {string} name - Client's full name
 * @param {string} email - Client's email address
 * @param {string} password - The temporary password
 * @param {string} autoLoginLink - URL with embedded credentials for direct login
 * @param {string} changePasswordLink - URL for the change password page
 * @param {boolean} isNewUser - Whether this is a new user (shows credentials) or existing
 */
const getClientInvitationTemplate = (name, email, password, autoLoginLink, changePasswordLink, isNewUser = true) => {
  const currentYear = new Date().getFullYear();
  
  let mainContent = '';
  
  if (isNewUser) {
    mainContent = `
      <p style="${styles.text}">You have been invited to collaborate on projects within the <strong>Groona</strong> platform. We have created a secure account for you.</p>
      
      <div style="${styles.credentialBox}">
        <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 12px; letter-spacing: 0.5px;">Your Access Credentials</div>
        <div style="${styles.credentialRow}"><strong>ID:</strong> ${email}</div>
        <div style="${styles.credentialRow}"><strong>Temporary Password:</strong> <span style="${styles.code}">${password}</span></div>
      </div>

      <p style="${styles.text}">You can login directly to view your projects or update your security settings below.</p>

      <div style="${styles.buttonGroup}">
        <a href="${autoLoginLink}" style="${styles.primaryBtn}">View Projects</a>
        <a href="${changePasswordLink}" style="${styles.secondaryBtn}">Change Password</a>
      </div>
      
      <p style="text-align: center; font-size: 13px; color: #94a3b8; margin-top: 16px;">
        Clicking "View Projects" will automatically log you in.
      </p>
    `;
  } else {
    // For existing users, we don't send the password in the link for security, just a redirect
    mainContent = `
      <p style="${styles.text}">We are pleased to inform you that you have been assigned to new projects within the <strong>Groona</strong> platform.</p>
      <p style="${styles.text}">You can access these new assignments immediately.</p>
      
      <div style="${styles.buttonGroup}">
        <a href="${autoLoginLink}" style="${styles.primaryBtn}">View Projects</a>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Groona</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">Groona</h1>
    </div>
    
    <div style="${styles.content}">
      <div style="${styles.greeting}">Hello, ${name}</div>
      ${mainContent}
      
      <div style="${styles.divider}"></div>
      
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        If you have any questions or need assistance, please contact your project manager directly.
      </p>
    </div>

    <div style="${styles.footer}">
      <p style="margin: 0 0 8px 0;">&copy; ${currentYear} Groona Platform. All rights reserved.</p>
      <p style="margin: 0;">This is an automated notification. Please do not reply to this specific email address.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Generates the HTML for a password reset email.
 * @param {string} newPassword - The new temporary password
 * @param {string} autoLoginLink - URL with embedded credentials
 */
const getClientResetPasswordTemplate = (newPassword, autoLoginLink) => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">Groona</h1>
    </div>
    
    <div style="${styles.content}">
      <div style="${styles.greeting}">Security Update</div>
      <p style="${styles.text}">As requested by your administrator, your password has been reset. You can use the link below to login immediately.</p>
      
      <div style="${styles.credentialBox}">
        <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 12px; letter-spacing: 0.5px;">New Credential</div>
        <div style="${styles.credentialRow}"><strong>Password:</strong> <span style="${styles.code}">${newPassword}</span></div>
      </div>

      <div style="${styles.buttonGroup}">
        <a href="${autoLoginLink}" style="${styles.primaryBtn}">Login & View Projects</a>
      </div>
    </div>

    <div style="${styles.footer}">
      <p style="margin: 0;">&copy; ${currentYear} Groona Platform. Secure System.</p>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = {
  getClientInvitationTemplate,
  getClientResetPasswordTemplate
};