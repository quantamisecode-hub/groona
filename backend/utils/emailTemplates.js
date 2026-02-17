/**
 * Centralized Email Templates for Groona
 * All templates use the same base design but with dynamic content
 */

const styles = {
  body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
  container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
  header: "background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 0; text-align: center;",
  headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
  content: "padding: 40px 40px;",
  greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
  text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
  infoBox: "background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0;",
  infoRow: "margin: 8px 0; font-size: 14px; color: #475569;",
  label: "font-weight: 600; color: #1e293b; display: inline-block; min-width: 120px;",
  value: "color: #475569;",
  buttonGroup: "text-align: center; margin-top: 32px; margin-bottom: 16px;",
  primaryBtn: "display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);",
  statusBadge: "display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;",
  divider: "height: 1px; background-color: #e2e8f0; margin: 32px 0;",
  footer: "background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;",
  link: "color: #2563eb; text-decoration: none;"
};

/**
 * Base template wrapper
 */
function getBaseTemplate(title, greeting, content) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">Groona</h1>
    </div>
    
    <div style="${styles.content}">
      <div style="${styles.greeting}">${greeting}</div>
      ${content}
      
      <div style="${styles.divider}"></div>
      
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        This is an automated notification from Groona. If you have any questions, please contact your administrator.
      </p>
    </div>

    <div style="${styles.footer}">
      <p style="margin: 0 0 8px 0;">&copy; ${currentYear} Groona Platform. All rights reserved.</p>
      <p style="margin: 0;">Please do not reply to this email address.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get email template by type
 * @param {string} templateType - Type of template
 * @param {Object} data - Dynamic data for the template
 * @returns {Object} { html, defaultSubject }
 */
function getEmailTemplate(templateType, data = {}) {
  switch (templateType) {
    case 'project_member_added':
      return getProjectMemberAddedTemplate(data);
    case 'task_assigned':
      return getTaskAssignedTemplate(data);
    case 'failed_login_attempts':
      return getFailedLoginAttemptsTemplate(data);
    case 'leave_approved':
      return getLeaveApprovedTemplate(data);
    case 'leave_cancelled':
      return getLeaveCancelledTemplate(data);
    case 'team_member_removed':
      return getTeamMemberRemovedTemplate(data);
    case 'leave_submitted':
      return getLeaveSubmittedTemplate(data);
    case 'timesheet_approved':
      return getTimesheetApprovedTemplate(data);
    case 'timesheet_rejected':
      return getTimesheetRejectedTemplate(data);
    case 'timesheet_submitted':
      return getTimesheetSubmittedTemplate(data);
    case 'subscription_expired':
      return getSubscriptionExpiredTemplate(data);
    case 'trial_ending':
      return getTrialEndingTemplate(data);
    case 'comment_added':
      return getCommentAddedTemplate(data);
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}

/**
 * Comment Added Template
 */
function getCommentAddedTemplate(data) {
  const { recipientName, authorName, commentContent, contextString, actionUrl } = data;

  const content = `
    <p style="${styles.text}"><strong>${authorName}</strong> commented on <strong>${contextString}</strong>:</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.value}" style="font-style: italic;">"${commentContent}"</span>
      </div>
    </div>

    ${actionUrl ? `
      <div style="${styles.buttonGroup}">
        <a href="${actionUrl}" style="${styles.primaryBtn}">View Comment</a>
      </div>
    ` : ''}
  `;

  return {
    html: getBaseTemplate(
      'New Comment',
      `Hello, ${recipientName}`,
      content
    ),
    defaultSubject: `New Comment on ${contextString}`
  };
}

/**
 * Subscription Expired Template
 */
function getSubscriptionExpiredTemplate(data) {
  const { userName, userEmail, planName, expiryDate, renewalUrl } = data;

  const content = `
    <p style="${styles.text}">Your subscription for the <strong>${planName}</strong> plan has <strong style="color: #ef4444;">expired</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Plan:</span>
        <span style="${styles.value}">${planName}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Expired On:</span>
        <span style="${styles.value}">${new Date(expiryDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}" style="color: #ef4444; font-weight: bold;">Past Due</span>
      </div>
    </div>

    <p style="${styles.text}">To restore full access to your workspace and avoid data suspension, please renew your subscription immediately.</p>

    ${renewalUrl ? `
      <div style="${styles.buttonGroup}">
        <a href="${renewalUrl}" style="${styles.primaryBtn}">Renew Subscription</a>
      </div>
    ` : ''}
  `;

  return {
    html: getBaseTemplate(
      'Subscription Expired',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `Urgent: Your ${planName} Subscription Has Expired`
  };
}

/**
 * Trial Ending Template
 */
function getTrialEndingTemplate(data) {
  const { userName, userEmail, trialEndDate, upgradeUrl } = data;

  const content = `
    <p style="${styles.text}">Your free trial is ending soon. We hope you've enjoyed using Groona!</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Trial Ends:</span>
        <span style="${styles.value}">${new Date(trialEndDate).toLocaleDateString()}</span>
      </div>
    </div>

    <p style="${styles.text}">Don't lose your progress. Upgrade to a premium plan today to keep using all advanced features without interruption.</p>

    ${upgradeUrl ? `
      <div style="${styles.buttonGroup}">
        <a href="${upgradeUrl}" style="${styles.primaryBtn}">Upgrade Now</a>
      </div>
    ` : ''}
  `;

  return {
    html: getBaseTemplate(
      'Trial Ending Soon',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `Action Required: Your Trial Ends on ${new Date(trialEndDate).toLocaleDateString()}`
  };
}

/**
 * Project Member Added Template
 */
function getProjectMemberAddedTemplate(data) {
  const { memberName, memberEmail, projectName, projectDescription, addedBy, projectUrl } = data;

  const content = `
    <p style="${styles.text}">You have been added as a team member to the project <strong>${projectName}</strong>.</p>
    
    ${projectDescription ? `<p style="${styles.text}"><strong>Project Description:</strong> ${projectDescription}</p>` : ''}
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}">${projectName}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Added By:</span>
        <span style="${styles.value}">${addedBy || 'System'}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Your Role:</span>
        <span style="${styles.value}">Team Member</span>
      </div>
    </div>

    ${projectUrl ? `
      <div style="${styles.buttonGroup}">
        <a href="${projectUrl}" style="${styles.primaryBtn}">View Project</a>
      </div>
    ` : ''}
  `;

  return {
    html: getBaseTemplate(
      'Added to Project',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `You've been added to project: ${projectName}`
  };
}

/**
 * Task Assigned Template
 */
function getTaskAssignedTemplate(data) {
  const { assigneeName, assigneeEmail, taskTitle, taskDescription, projectName, assignedBy, dueDate, priority, taskUrl } = data;

  const priorityColors = {
    low: '#10b981',
    medium: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444'
  };

  const priorityColor = priorityColors[priority] || '#3b82f6';

  const content = `
    <p style="${styles.text}">A new task has been assigned to you in the project <strong>${projectName}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Task:</span>
        <span style="${styles.value}"><strong>${taskTitle}</strong></span>
      </div>
      ${taskDescription ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Description:</span>
          <span style="${styles.value}">${taskDescription}</span>
        </div>
      ` : ''}
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}">${projectName}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Assigned By:</span>
        <span style="${styles.value}">${assignedBy || 'System'}</span>
      </div>
      ${dueDate ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Due Date:</span>
          <span style="${styles.value}">${new Date(dueDate).toLocaleDateString()}</span>
        </div>
      ` : ''}
      ${priority ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Priority:</span>
          <span style="${styles.value}">
            <span style="${styles.statusBadge}; background-color: ${priorityColor}; color: #ffffff; text-transform: capitalize;">
              ${priority}
            </span>
          </span>
        </div>
      ` : ''}
    </div>

    ${taskUrl ? `
      <div style="${styles.buttonGroup}">
        <a href="${taskUrl}" style="${styles.primaryBtn}">View Task</a>
      </div>
    ` : ''}
  `;

  return {
    html: getBaseTemplate(
      'New Task Assigned',
      `Hello, ${assigneeName || assigneeEmail}`,
      content
    ),
    defaultSubject: `New Task Assigned: ${taskTitle}`
  };
}

/**
 * Failed Login Attempts Template
 */
function getFailedLoginAttemptsTemplate(data) {
  const { userName, userEmail, attemptCount, lastAttemptTime, ipAddress, location, deviceName, userAgent } = data;

  const content = `
    <p style="${styles.text}">We detected <strong>${attemptCount} failed login attempts</strong> on your Groona account.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Account:</span>
        <span style="${styles.value}">${userEmail}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Failed Attempts:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">${attemptCount}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Last Attempt:</span>
        <span style="${styles.value}">${new Date(lastAttemptTime).toLocaleString()}</span>
      </div>
      ${ipAddress ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">IP Address:</span>
          <span style="${styles.value}">${ipAddress}</span>
        </div>
      ` : ''}
      ${location ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Location:</span>
          <span style="${styles.value}">${location}</span>
        </div>
      ` : ''}
      ${deviceName ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Device Name:</span>
          <span style="${styles.value}">${deviceName}</span>
        </div>
      ` : ''}
      ${userAgent ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">User Agent:</span>
          <span style="${styles.value}">${userAgent}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">
      <strong>If this was you:</strong> Please ensure you're using the correct password. If you've forgotten your password, please use the password reset feature.
    </p>
    
    <p style="${styles.text}">
      <strong>If this was NOT you:</strong> Your account may be compromised. Please change your password immediately and contact your administrator.
    </p>
  `;

  return {
    html: getBaseTemplate(
      'Security Alert: Failed Login Attempts',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `Security Alert: ${attemptCount} Failed Login Attempts`
  };
}

/**
 * Leave Approved Template
 */
function getLeaveApprovedTemplate(data) {
  const { memberName, memberEmail, leaveType, startDate, endDate, duration, totalDays, approvedBy, description, projectUrl } = data;

  const content = `
    <p style="${styles.text}">Your leave application has been <strong style="color: #10b981;">approved</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Leave Type:</span>
        <span style="${styles.value}">${leaveType}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Start Date:</span>
        <span style="${styles.value}">${new Date(startDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">End Date:</span>
        <span style="${styles.value}">${new Date(endDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Duration:</span>
        <span style="${styles.value}">${totalDays} day(s) ${duration === 'half_day' ? '(Half Day)' : ''}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Approved By:</span>
        <span style="${styles.value}">${approvedBy || 'Administrator'}</span>
      </div>
      ${description ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Message:</span>
          <span style="${styles.value}">${description}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Your leave has been approved and your calendar has been updated accordingly.</p>
  `;

  return {
    html: getBaseTemplate(
      'Leave Application Approved',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Leave Application Approved: ${leaveType}`
  };
}

/**
 * Leave Cancelled/Rejected Template
 */
function getLeaveCancelledTemplate(data) {
  const { memberName, memberEmail, leaveType, startDate, endDate, duration, totalDays, cancelledBy, reason, description } = data;

  // Determine if it's rejected or cancelled based on who cancelled it
  const isRejected = cancelledBy && cancelledBy !== 'System';
  const statusText = isRejected ? 'rejected' : 'cancelled';
  const actionBy = cancelledBy || 'Administrator';

  const content = `
    <p style="${styles.text}">Your leave application has been <strong style="color: #ef4444;">${statusText}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Leave Type:</span>
        <span style="${styles.value}">${leaveType}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Start Date:</span>
        <span style="${styles.value}">${new Date(startDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">End Date:</span>
        <span style="${styles.value}">${new Date(endDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Duration:</span>
        <span style="${styles.value}">${totalDays} day(s) ${duration === 'half_day' ? '(Half Day)' : ''}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">${isRejected ? 'Rejected' : 'Cancelled'} By:</span>
        <span style="${styles.value}">${actionBy}</span>
      </div>
      ${reason || description ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Message:</span>
          <span style="${styles.value}">${description || reason || 'No reason provided'}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Your leave balance has been restored. If you have any questions, please contact your administrator.</p>
  `;

  return {
    html: getBaseTemplate(
      `Leave Application ${isRejected ? 'Rejected' : 'Cancelled'}`,
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Leave Application ${isRejected ? 'Rejected' : 'Cancelled'}: ${leaveType}`
  };
}

/**
 * Team Member Removed Template
 */
function getTeamMemberRemovedTemplate(data) {
  const { memberName, memberEmail, projectName, removedBy, reason } = data;

  const content = `
    <p style="${styles.text}">You have been removed from the project <strong>${projectName}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}">${projectName}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Removed By:</span>
        <span style="${styles.value}">${removedBy || 'Administrator'}</span>
      </div>
      ${reason ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Reason:</span>
          <span style="${styles.value}">${reason}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">You will no longer have access to this project. If you believe this is an error, please contact your administrator.</p>
  `;

  return {
    html: getBaseTemplate(
      'Removed from Project',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Removed from Project: ${projectName}`
  };
}

/**
 * Leave Submitted Template (Acknowledgment)
 */
function getLeaveSubmittedTemplate(data) {
  const { memberName, memberEmail, leaveType, startDate, endDate, duration, totalDays, reason } = data;

  const content = `
    <p style="${styles.text}">Your leave application has been <strong style="color: #3b82f6;">submitted successfully</strong> and is pending approval.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Leave Type:</span>
        <span style="${styles.value}">${leaveType}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Start Date:</span>
        <span style="${styles.value}">${new Date(startDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">End Date:</span>
        <span style="${styles.value}">${new Date(endDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Duration:</span>
        <span style="${styles.value}">${totalDays} day(s) ${duration === 'half_day' ? '(Half Day)' : ''}</span>
      </div>
      ${reason ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Reason:</span>
          <span style="${styles.value}">${reason}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">You will be notified once your leave request has been reviewed by your administrator.</p>
  `;

  return {
    html: getBaseTemplate(
      'Leave Application Submitted',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Leave Application Submitted: ${leaveType}`
  };
}

/**
 * Timesheet Approved Template
 */
function getTimesheetApprovedTemplate(data) {
  const { memberName, memberEmail, taskTitle, date, hours, minutes, approvedBy, comment } = data;

  const content = `
    <p style="${styles.text}">Your timesheet has been <strong style="color: #10b981;">approved</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Task:</span>
        <span style="${styles.value}"><strong>${taskTitle || 'N/A'}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Date:</span>
        <span style="${styles.value}">${new Date(date).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Hours:</span>
        <span style="${styles.value}">${hours || 0} hours ${minutes || 0} minutes</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Approved By:</span>
        <span style="${styles.value}">${approvedBy || 'Administrator'}</span>
      </div>
      ${comment ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Comment:</span>
          <span style="${styles.value}">${comment}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Your timesheet has been approved and recorded in the system.</p>
  `;

  return {
    html: getBaseTemplate(
      'Timesheet Approved',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Timesheet Approved: ${taskTitle || 'Timesheet'}`
  };
}

/**
 * Timesheet Rejected Template
 */
function getTimesheetRejectedTemplate(data) {
  const { memberName, memberEmail, taskTitle, date, hours, minutes, rejectedBy, comment, reason } = data;

  const content = `
    <p style="${styles.text}">Your timesheet has been <strong style="color: #ef4444;">rejected</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Task:</span>
        <span style="${styles.value}"><strong>${taskTitle || 'N/A'}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Date:</span>
        <span style="${styles.value}">${new Date(date).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Hours:</span>
        <span style="${styles.value}">${hours || 0} hours ${minutes || 0} minutes</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rejected By:</span>
        <span style="${styles.value}">${rejectedBy || 'Administrator'}</span>
      </div>
      ${(comment || reason) ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Reason:</span>
          <span style="${styles.value}">${comment || reason || 'No reason provided'}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Please review the reason above and resubmit your timesheet if needed. If you have any questions, please contact your administrator.</p>
  `;

  return {
    html: getBaseTemplate(
      'Timesheet Rejected',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Timesheet Rejected: ${taskTitle || 'Timesheet'}`
  };
}

/**
 * Timesheet Submitted Template (Acknowledgment)
 */
function getTimesheetSubmittedTemplate(data) {
  const { memberName, memberEmail, taskTitle, date, hours, minutes, projectName, entryCount } = data;

  const content = `
    <p style="${styles.text}">Your timesheet${entryCount > 1 ? 's have' : ' has'} been <strong style="color: #3b82f6;">submitted successfully</strong> and ${entryCount > 1 ? 'are' : 'is'} pending approval.</p>
    
    <div style="${styles.infoBox}">
      ${entryCount > 1 ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Entries Submitted:</span>
          <span style="${styles.value}"><strong>${entryCount} timesheet entries</strong></span>
        </div>
      ` : `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Task:</span>
          <span style="${styles.value}"><strong>${taskTitle || 'N/A'}</strong></span>
        </div>
        ${projectName ? `
          <div style="${styles.infoRow}">
            <span style="${styles.label}">Project:</span>
            <span style="${styles.value}">${projectName}</span>
          </div>
        ` : ''}
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Date:</span>
          <span style="${styles.value}">${new Date(date).toLocaleDateString()}</span>
        </div>
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Hours:</span>
          <span style="${styles.value}">${hours || 0} hours ${minutes || 0} minutes</span>
        </div>
      `}
    </div>

    <p style="${styles.text}">You will be notified once your timesheet${entryCount > 1 ? 's have' : ' has'} been reviewed by your administrator.</p>
  `;

  return {
    html: getBaseTemplate(
      'Timesheet Submitted',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: entryCount > 1
      ? `${entryCount} Timesheet Entries Submitted`
      : `Timesheet Submitted: ${taskTitle || 'Timesheet'}`
  };
}

module.exports = {
  getEmailTemplate
};
