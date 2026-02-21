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
    case 'task_unassigned':
      return getTaskUnassignedTemplate(data);
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
    case 'timesheet_reminder':
      return getTimesheetReminderTemplate(data);
    case 'timesheet_lockout_alarm':
      return getTimesheetLockoutAlarmTemplate(data);
    case 'timesheet_missing_alert':
      return getTimesheetMissingAlertTemplate(data);
    case 'low_logged_hours':
      return getLowLoggedHoursTemplate(data);
    case 'overwork_alarm':
      return getOverworkAlarmTemplate(data);
    case 'multiple_overdue_alarm':
      return getMultipleOverdueAlarmTemplate(data);
    case 'rework_alarm':
      return getReworkAlarmTemplate(data, false);
    case 'high_rework_alarm':
      return getReworkAlarmTemplate(data, true);
    case 'rework_alert':
      return getReworkGeneralAlertTemplate(data);
    case 'trial_ending':
      return getTrialEndingTemplate(data);
    case 'subscription_expired':
      return getSubscriptionExpiredTemplate(data);
    case 'peer_review_requested':
      return getPeerReviewRequestedTemplate(data);
    case 'peer_review_declined':
      return getPeerReviewDeclinedTemplate(data);
    case 'under_utilization_alert':
      return getUnderUtilizationAlertTemplate(data);
    case 'audit_lock_toggle':
      return getAuditLockToggleTemplate(data);
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}

/**
 * Timesheet Lockout Alarm Template (For User)
 */
function getTimesheetLockoutAlarmTemplate(data) {
  const { userName, userEmail, missingCount, missingDates, unlockUrl } = data;

  const content = `
    <p style="${styles.text}"><strong>Action Required:</strong> Your account has been temporarily <strong>LOCKED</strong> due to repeated missing timesheets.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">LOCKED</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Missing Days:</span>
        <span style="${styles.value}">${missingCount || 0} day(s)</span>
      </div>
      ${missingDates ? `
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Dates:</span>
        <span style="${styles.value}">${missingDates}</span>
      </div>` : ''}
    </div>

    <p style="${styles.text}">You cannot submit new timesheets or perform certain actions until you fill in the missing days from the start of the month.</p>

    <div style="${styles.buttonGroup}">
      <a href="${unlockUrl || '#'}" style="${styles.primaryBtn}">Fill Missing Timesheets</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Account Locked: Missing Timesheets',
      `Hello, ${userName || userEmail || data.name || 'User'}`,
      content
    ),
    defaultSubject: '🚨 Account Locked: Missing Timesheets Action Required'
  };
}

/**
 * Timesheet Missing Alert Template (For Managers/Admins)
 */
function getTimesheetMissingAlertTemplate(data) {
  const { recipientName, recipientEmail, userName, userEmail, missingCount, missingDates, profileUrl } = data;

  const content = `
    <p style="${styles.text}">This is an alert regarding <strong>${userName || userEmail}</strong>.</p>
    
    <p style="${styles.text}">The user has been <strong>LOCKED</strong> out of the system due to <strong>${missingCount}</strong> missing timesheets in the last week.</p>

    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">User:</span>
        <span style="${styles.value}"><strong>${userName || userEmail}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Missing Count:</span>
        <span style="${styles.value}">${missingCount}</span>
      </div>
       ${missingDates ? `
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Dates:</span>
        <span style="${styles.value}">${missingDates}</span>
      </div>` : ''}
    </div>

    <p style="${styles.text}">Please follow up with the user to ensure they update their timesheets to regain access.</p>

    ${profileUrl ? `
    <div style="${styles.buttonGroup}">
      <a href="${profileUrl}" style="${styles.primaryBtn}">View User Profile</a>
    </div>` : ''}
  `;

  return {
    html: getBaseTemplate(
      'Alert: User Locked (Missing Timesheets)',
      `Hello, ${recipientName || recipientEmail || data.managerName || 'Manager'}`,
      content
    ),
    defaultSubject: `🚨 Alert: ${userName || userEmail} Locked due to Missing Timesheets`
  };
}

/**
 * Project Member Added Template
 */
function getProjectMemberAddedTemplate(data) {
  const { memberName, memberEmail, userName, projectName, projectDescription, addedBy, projectUrl } = data;

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
      `Hello, ${memberName || memberEmail || userName || 'User'}`,
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
 * Task Unassigned Template
 */
function getTaskUnassignedTemplate(data) {
  const { memberName, memberEmail, taskTitle, projectName, unassignedBy, taskUrl } = data;

  const content = `
    <p style="${styles.text}">You have been unassigned from the task <strong>${taskTitle}</strong> in project <strong>${projectName}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Task:</span>
        <span style="${styles.value}"><strong>${taskTitle}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}">${projectName}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Unassigned By:</span>
        <span style="${styles.value}">${unassignedBy || 'System'}</span>
      </div>
    </div>

    ${taskUrl ? `
      <div style="${styles.buttonGroup}">
        <a href="${taskUrl}" style="${styles.primaryBtn}">View Task</a>
      </div>
    ` : ''}
  `;

  return {
    html: getBaseTemplate(
      'Task Unassigned',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: `Task Unassigned: ${taskTitle}`
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
      `Leave Application ${isRejected ? 'Rejected' : 'Cancelled'} `,
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
  const { memberName, memberEmail, taskTitle, date, hours, minutes, projectName, entryCount, isLate } = data;

  const subjectPrefix = isLate ? 'Late Timesheet Submission' : 'Timesheet Submitted';
  const titleColor = isLate ? '#eab308' : '#3b82f6'; // Yellow for Late, Blue for Normal

  const content = `
    <p style="${styles.text}">
      Your timesheet${entryCount > 1 ? 's have' : ' has'} been 
      <strong style="color: ${titleColor};">${isLate ? 'submitted late' : 'submitted successfully'}</strong> 
      and ${entryCount > 1 ? 'are' : 'is'} pending approval.
    </p>
    
    ${isLate ? `
      <div style="background-color: #fefce8; border: 1px solid #fde047; padding: 12px; border-radius: 6px; margin-bottom: 24px;">
        <p style="margin: 0; color: #854d0e; font-size: 14px;">
          <strong>Note:</strong> This submission is for a past date and has been marked as <strong>Late</strong>.
        </p>
      </div>
    ` : ''}

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
      isLate ? 'Late Timesheet Submission' : 'Timesheet Submitted',
      `Hello, ${memberName || memberEmail}`,
      content
    ),
    defaultSubject: entryCount > 1
      ? `${isLate ? 'Late: ' : ''}${entryCount} Timesheet Entries Submitted`
      : `${subjectPrefix}: ${taskTitle || 'Timesheet'}`
  };
}

/**
 * Timesheet Reminder Template
 */
function getTimesheetReminderTemplate(data) {
  const { userName, userEmail, scheduledEnd, reminderType } = data;

  const content = `
    <p style="${styles.text}">You haven’t logged your time today. Please update your timesheet before day end.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong>Missing Today's Log</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Email:</span>
        <span style="${styles.value}">${userEmail}</span>
      </div>
      ${scheduledEnd ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Working End:</span>
          <span style="${styles.value}">${scheduledEnd}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Keeping your timesheets up to date helps the team stay aligned and ensures accurate project tracking.</p>

    <div style="${styles.buttonGroup}">
      <a href="${process.env.FRONTEND_URL || '#'}/timesheets" style="${styles.primaryBtn}">Log Your Time</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Timesheet Reminder',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: "Reminder: Please log your time today"
  };
}

/**
 * Low Logged Hours Template
 */
function getLowLoggedHoursTemplate(data) {
  const { userName, userEmail, consecutiveDays, loggedHours, availability } = data;

  const content = `
    <p style="${styles.text}"><strong>Notification:</strong> Your logged hours have been consistently below your declared availability.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: #f59e0b;">Low Hours Detected</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Observation:</span>
        <span style="${styles.value}">${consecutiveDays} consecutive working days</span>
      </div>
      <p style="font-size: 14px; color: #475569; margin-top: 12px; margin-bottom: 0;">
        <strong>Your logged hours are below your declared availability. Please review your workload.</strong>
      </p>
    </div>

    <p style="${styles.text}">Maintaining accurate timesheets is essential for project tracking and resource planning. If you're facing impediments or your workload is lower than expected, please discuss this with your manager.</p>

    <div style="${styles.buttonGroup}">
      <a href="${process.env.FRONTEND_URL || '#'}/timesheets" style="${styles.primaryBtn}">View My Timesheets</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Workload Review Required',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: "Action Required: Low Logged Hours Detected"
  };
}

/**
 * Overwork Alarm Template
 */
function getOverworkAlarmTemplate(data) {
  const { userName, userEmail, totalHours } = data;

  const content = `
    <p style="${styles.text}"><strong>Alert:</strong> High workload detected.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">Overwork Alarm</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Planned Hours:</span>
        <span style="${styles.value}">${totalHours.toFixed(1)} hours (this week)</span>
      </div>
      <p style="font-size: 14px; color: #475569; margin-top: 12px; margin-bottom: 0;">
        <strong>You’ve been working long hours consistently. Please discuss workload adjustment with your manager.</strong>
      </p>
    </div>

    <p style="${styles.text}">Your health and well-being are important. Consistently high workload can lead to burnout. We encourage you to review your tasks and discuss prioritizing or delegating work where possible.</p>

    <div style="${styles.buttonGroup}">
      <a href="${process.env.FRONTEND_URL || '#'}/tasks" style="${styles.primaryBtn}">Review My Tasks</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Workload Review: High Hours Detected',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: "🚨 Action Required: High Workload Alert"
  };
}

/**
 * Multiple Overdue Alarms Template
 */
function getMultipleOverdueAlarmTemplate(data) {
  const { userName, userEmail, overdueCount, taskTitles, dashboardUrl } = data;

  const content = `
    <p style="${styles.text}"><strong>Critical Alert:</strong> You have <strong>${overdueCount} tasks</strong> that are currently overdue.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">Multiple Overdue Tasks</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Overdue Count:</span>
        <span style="${styles.value}">${overdueCount} tasks</span>
      </div>
      ${taskTitles ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Recent Tasks:</span>
          <span style="${styles.value}">${taskTitles}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Immediately consultation with your Project Manager is required to reprioritize these tasks and ensure project timelines are met.</p>

    <div style="${styles.buttonGroup}">
      <a href="${dashboardUrl || '#'}" style="${styles.primaryBtn}">View My Dashboard</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Critical Alarm: Multiple Overdue Tasks',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `🚨 CRITICAL: ${overdueCount} Overdue Tasks - Action Required`
  };
}

/**
 * Rework Alarm Template
 */
function getReworkAlarmTemplate(data, isHigh = false) {
  const { userName, userEmail, reworkPercent, threshold, dashboardUrl } = data;
  const severity = isHigh ? 'CRITICAL' : 'HIGH';
  const color = isHigh ? '#ef4444' : '#f59e0b';

  const content = `
    <p style="${styles.text}"><strong>${severity} Alert:</strong> High rework percentage detected.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: ${color};">${severity} Rework Alert</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}"><strong>${reworkPercent}%</strong> (Threshold: ${threshold}%)</span>
      </div>
      ${isHigh ? `
      <p style="font-size: 14px; color: #ef4444; margin-top: 12px; margin-bottom: 0;">
        <strong>Task assignments have been temporarily frozen. Immediate consultation with your manager/PM is required.</strong>
      </p>` : ''}
    </div>

    <p style="${styles.text}">
      ${isHigh
      ? 'Your rework time has exceeded the critical threshold. This indicates significant repeated efforts that require intervention. A peer review of your current tasks is being scheduled.'
      : 'Your rework time is above recommended limits. High rework can indicate missing requirements, technical debt, or need for further training. We recommend discussing this with your PM to optimize your workflow.'}
    </p>

    <div style="${styles.buttonGroup}">
      <a href="${dashboardUrl || '#'}" style="${styles.primaryBtn}">View My Timesheets</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      `${isHigh ? 'Critical' : 'High'} Rework Alert`,
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `${isHigh ? '🚨 CRITICAL' : '⚠️ ALERT'}: High Rework Detected (${reworkPercent}%)`
  };
}

/**
 * General Rework Alert Template (Informational)
 */
function getReworkGeneralAlertTemplate(data) {
  const { userName, userEmail, reworkPercent, dashboardUrl } = data;

  const content = `
    <p style="${styles.text}"><strong>Notice:</strong> Rework time has been logged in your recent timesheets.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}">Rework Detected</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}"><strong>${reworkPercent}%</strong> of total time</span>
      </div>
    </div>

    <p style="${styles.text}">
      We noticed you've logged some rework time. While some rework is natural, consistent or high levels can impact project velocity. 
      Please ensure project requirements are clear before starting tasks to minimize the need for rework.
    </p>

    <div style="${styles.buttonGroup}">
      <a href="${dashboardUrl || '#'}" style="${styles.primaryBtn}">View My Timesheets</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Rework Logged Notification',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `Notice: Rework time logged (${reworkPercent}%)`
  };
}

/**
 * Trial Ending Template
 */
function getTrialEndingTemplate(data) {
  const { userName, userEmail, trialEndDate, upgradeUrl } = data;

  const content = `
    <p style="${styles.text}">Your free trial of Groona is ending soon on <strong>${new Date(trialEndDate).toLocaleDateString()}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Plan:</span>
        <span style="${styles.value}">Premium Trial</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Ends On:</span>
        <span style="${styles.value}">${new Date(trialEndDate).toLocaleDateString()}</span>
      </div>
    </div>

    <p style="${styles.text}">Don't lose access to your projects and team collaboration features. Upgrade your plan now to ensure a seamless transition.</p>

    <div style="${styles.buttonGroup}">
      <a href="${upgradeUrl || '#'}" style="${styles.primaryBtn}">Upgrade Now</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Trial Ending Soon',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: 'Action Required: Your Groona Trial is Ending Soon'
  };
}

/**
 * Subscription Expired / Past Due Template
 */
function getSubscriptionExpiredTemplate(data) {
  const { userName, userEmail, planName, expiryDate, renewalUrl } = data;

  const content = `
    <p style="${styles.text}">Your <strong>${planName || 'Groona'}</strong> subscription has expired.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Account:</span>
        <span style="${styles.value}">${userEmail}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Expired On:</span>
        <span style="${styles.value}">${new Date(expiryDate).toLocaleDateString()}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">PAST DUE</strong></span>
      </div>
    </div>

    <p style="${styles.text}">To regain full access to all features, please renew your subscription or update your payment details.</p>

    <div style="${styles.buttonGroup}">
      <a href="${renewalUrl || '#'}" style="${styles.primaryBtn}">Renew Subscription</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Subscription Expired',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: '🚨 Your Groona Subscription Has Expired'
  };
}

/**
 * Peer Review Requested Template
 */
function getPeerReviewRequestedTemplate(data) {
  const { reviewerName, reviewerEmail, requesterName, taskTitle, projectName, message, dashboardUrl } = data;

  const content = `
    <p style="${styles.text}"><strong>${requesterName}</strong> has requested a peer review for the task: <strong>${taskTitle}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}">${projectName || 'N/A'}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Requested By:</span>
        <span style="${styles.value}">${requesterName}</span>
      </div>
      ${message ? `
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Message:</span>
          <span style="${styles.value}">${message}</span>
        </div>
      ` : ''}
    </div>

    <p style="${styles.text}">Peer reviews help maintain code quality and share knowledge across the team. Please take a moment to review the changes when you have a chance.</p>

    <div style="${styles.buttonGroup}">
      <a href="${dashboardUrl || '#'}" style="${styles.primaryBtn}">View Review Request</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Peer Review Requested',
      `Hello, ${reviewerName || reviewerEmail}`,
      content
    ),
    defaultSubject: `Peer Review Requested: ${taskTitle}`
  };
}

/**
 * Peer Review Declined Template
 */
function getPeerReviewDeclinedTemplate(data) {
  const { requesterName, requesterEmail, reviewerName, taskTitle, projectName, dashboardUrl } = data;

  const content = `
    <p style="${styles.text}">Your peer review request for the task: <strong>${taskTitle}</strong> has been <strong>declined</strong> by <strong>${reviewerName}</strong>.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}">${projectName || 'N/A'}</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">DECLINED</strong></span>
      </div>
    </div>

    <p style="${styles.text}">You may want to request a review from another team member to ensure your changes are verified.</p>

    <div style="${styles.buttonGroup}">
      <a href="${dashboardUrl || '#'}" style="${styles.primaryBtn}">View My Requests</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Peer Review Declined',
      `Hello, ${requesterName || requesterEmail}`,
      content
    ),
    defaultSubject: `Peer Review Declined: ${taskTitle}`
  };
}

/**
 * Under Utilization Alert Template
 */
function getUnderUtilizationAlertTemplate(data) {
  const { userName, userEmail, utilizationPercentage, durationDays, dashboardUrl } = data;

  const content = `
    <p style="${styles.text}">You appear to be <strong>under-utilized</strong> based on your logged hours over the past ${durationDays || 30} days.</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Utilization:</span>
        <span style="${styles.value}"><strong style="color: #ef4444;">${utilizationPercentage}%</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Target:</span>
        <span style="${styles.value}">60% or higher</span>
      </div>
    </div>

    <p style="${styles.text}">Maintaining a healthy utilization rate ensures project goals are met and resources are balanced. Please discuss your task allocation and potential blockers with your manager.</p>

    <div style="${styles.buttonGroup}">
      <a href="${dashboardUrl || '#'}" style="${styles.primaryBtn}">View My Timesheets</a>
    </div>
  `;

  return {
    html: getBaseTemplate(
      'Utilization Alert',
      `Hello, ${userName || userEmail}`,
      content
    ),
    defaultSubject: `Capacity Utilization Alert: Action Required`
  };
}


/**
 * Audit Lock Toggle Template
 */
function getAuditLockToggleTemplate(data) {
  const { userName, userEmail, locked, managerName } = data;

  const subject = locked
    ? 'Action Required: Timesheet Access Locked'
    : 'Update: Timesheet Access Unlocked';

  const title = locked ? 'Timesheet Access Temporarily Locked' : 'Timesheet Access Unlocked';
  const titleColor = locked ? '#dc2626' : '#10b981';

  const content = `
    <h2 style="color: ${titleColor}; margin-top: 0;">${title}</h2>
    
    <p style="${styles.text}">
      ${locked
      ? 'Your timesheet submission access has been temporarily <strong>LOCKED</strong> by your manager explicity for an audit or review.'
      : 'Your timesheet submission access has been <strong>UNLOCKED</strong>.'
    }
    </p>
      
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Status:</span>
        <span style="${styles.value}"><strong style="color: ${titleColor};">${locked ? 'LOCKED' : 'ACTIVE'}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Action By:</span>
        <span style="${styles.value}">${managerName || 'Manager'}</span>
      </div>
    </div>

    <p style="${styles.text}">
      ${locked
      ? '<strong>Note:</strong> You can still save your timesheets as <strong>Drafts</strong>, but you will not be able to submit them until the lock is lifted.'
      : 'You can now resume submitting your timesheets as normal.'
    }
    </p>
      
    <p style="${styles.text}">Please contact your manager for more details.</p>
  `;

  return {
    html: getBaseTemplate(
      title,
      `Hello, ${userName || userEmail || 'User'}`,
      content
    ),
    defaultSubject: subject
  };
}

module.exports = {
  getEmailTemplate
};
