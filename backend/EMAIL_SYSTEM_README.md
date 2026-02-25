# Centralized Email System for Groona

## Overview
A centralized email template system that sends notifications to team members and admins for various events using a unified template design with dynamic content.

## Files Created

1. **`backend/services/emailService.js`** - Centralized email sending service
2. **`backend/utils/emailTemplates.js`** - Email templates with dynamic content
3. **`backend/models/definitions/FailedLoginAttempt.json`** - Model for tracking failed login attempts
4. **`backend/utils/teamMemberRemovalHelper.js`** - Helper for detecting and notifying team member removals

## Email Templates

All templates use the same base design but with dynamic content:

1. **`project_member_added`** - Sent when a team member is added to a project
2. **`task_assigned`** - Sent when a task is assigned to a team member
3. **`failed_login_attempts`** - Sent after 3+ failed login attempts
4. **`leave_approved`** - Sent when a leave application is approved
5. **`leave_cancelled`** - Sent when a leave application is cancelled/rejected
6. **`team_member_removed`** - Sent when a team member is removed from a project

## Integration Points

### ✅ Completed Integrations

1. **Project Creation & Team Member Addition**
   - Location: `backend/services/aiProjectService.js`
   - Sends email to all team members when they're added to a new project

2. **Task Assignment**
   - Location: `backend/services/aiTaskService.js`
   - Sends email to assignees when tasks are assigned

3. **Failed Login Attempts**
   - Location: `backend/routes/auth.js`
   - Tracks failed attempts and sends email after 3+ failures

4. **Leave Approval/Cancellation**
   - Location: `backend/handlers/updateLeaveStatus.js`
   - Sends email when leave status changes to approved or cancelled

### ⚠️ Manual Integration Required

**Team Member Removal from Projects**

Since projects are managed via the groonabackend API (generic CRUD), you need to integrate the team member removal helper where projects are updated. 

**How to integrate:**

```javascript
const { handleTeamMemberRemoval } = require('../utils/teamMemberRemovalHelper');

// When updating a project (e.g., in your project update route)
router.put('/projects/:id', async (req, res) => {
  const oldProject = await Models.Project.findById(req.params.id);
  const updatedProject = await Models.Project.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  
  // Detect and notify removed team members
  await handleTeamMemberRemoval(
    oldProject,
    updatedProject,
    req.user.email // or whoever is making the update
  );
  
  res.json(updatedProject);
});
```

## Environment Variables

The system uses existing SMTP credentials from `.env`:

- `MAIL_HOST` - SMTP host
- `MAIL_PORT` - SMTP port
- `MAIL_USERNAME` - SMTP username
- `MAIL_PASSWORD` - SMTP password
- `MAIL_FROM_NAME` - Sender name (default: "Groona")
- `MAIL_FROM_ADDRESS` - Sender email address
- `FRONTEND_URL` - Frontend URL for links in emails (default: "http://localhost:5173")

## Usage Example

```javascript
const emailService = require('./services/emailService');

// Send email to a single recipient
await emailService.sendEmail({
  to: 'user@example.com',
  templateType: 'task_assigned',
  data: {
    assigneeName: 'John Doe',
    assigneeEmail: 'user@example.com',
    taskTitle: 'Complete feature X',
    projectName: 'Project Alpha',
    assignedBy: 'Jane Smith',
    dueDate: '2024-12-31',
    priority: 'high',
    taskUrl: 'https://app.example.com/tasks/123'
  }
});

// Send email to multiple recipients (team members and admins)
await emailService.sendEmailToTeamAndAdmins({
  teamMembers: ['member1@example.com', 'member2@example.com'],
  admins: ['admin@example.com'],
  templateType: 'project_member_added',
  data: {
    memberName: 'John Doe',
    memberEmail: 'member1@example.com',
    projectName: 'Project Alpha',
    addedBy: 'Jane Smith',
    projectUrl: 'https://app.example.com/projects/123'
  }
});
```

## Template Data Requirements

Each template requires specific data fields. Refer to `backend/utils/emailTemplates.js` for detailed requirements.

## Notes

- If SMTP is not configured (`MAIL_USERNAME` is missing), emails will be logged to console instead of being sent
- All email sending is non-blocking - errors are logged but don't interrupt the main flow
- The FailedLoginAttempt model is automatically loaded by the SchemaDefinitions system
