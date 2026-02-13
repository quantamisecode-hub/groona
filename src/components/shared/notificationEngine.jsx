import { groonabackend } from "@/api/groonabackend";

/**
 * Notification Engine
 * Processes events and creates notifications based on rules and preferences
 */

class NotificationEngine {
  /**
   * Process an activity event and create notifications
   */
  async processEvent(event) {
    try {
      console.log(`[NotificationEngine] Processing event: ${event.event_type}`);

      // 1. Resolve Context (Recipients & Project ID)
      // We do this first to ensure we have the project_id for routing
      const context = await this.resolveContext(event);
      
      if (context.recipients.length === 0) {
        console.log('[NotificationEngine] No recipients for this event');
        return;
      }

      const recipientPrefs = await this.getPreferences(context.recipients, event.tenant_id);
      const notifications = [];

      for (const recipient of context.recipients) {
        const prefs = recipientPrefs.find(p => p.user_email === recipient.email);
        
        if (!this.shouldNotify(event, prefs, recipient)) {
          continue;
        }

        const channels = this.getChannels(event, prefs);
        
        if (channels.includes('IN_APP')) {
          // Pass resolved projectId to creation
          const notification = await this.createInAppNotification(event, recipient, context.projectId);
          notifications.push(notification);
        }

        if (channels.includes('EMAIL')) {
          await this.createEmailNotification(event, recipient, prefs, context.projectId);
        }
      }

      console.log(`[NotificationEngine] Created ${notifications.length} notifications`);
      return notifications;
    } catch (error) {
      console.error('[NotificationEngine] Failed to process event:', error);
      throw error;
    }
  }

  /**
   * Resolve recipients AND project context
   */
  async resolveContext(event) {
    const recipients = [];
    // Try to get project_id from metadata first, or entity_id if it's a project event
    let projectId = event.metadata?.project_id || (event.entity_type === 'project' ? event.entity_id : undefined);

    try {
      // Helper to fetch task if project_id is missing
      const ensureProjectIdFromTask = async (taskId) => {
        if (!projectId && taskId) {
          try {
            const task = await groonabackend.entities.Task.findById(taskId);
            if (task) projectId = task.project_id;
          } catch (e) { console.error("Error fetching task for context", e); }
        }
      };

      switch (event.event_type) {
        case 'TASK_ASSIGNED':
          if (event.metadata?.assigned_to) {
            const assignees = Array.isArray(event.metadata.assigned_to) ? event.metadata.assigned_to : [event.metadata.assigned_to];
            recipients.push(...assignees.map(email => ({ email })));
          }
          await ensureProjectIdFromTask(event.entity_id);
          break;

        case 'TASK_COMPLETED':
          await ensureProjectIdFromTask(event.entity_id);
          if (projectId) {
            const project = await groonabackend.entities.Project.findById(projectId);
            if (project) {
              if (project.owner) recipients.push({ email: project.owner });
              const pmRoles = await groonabackend.entities.ProjectUserRole.filter({ project_id: projectId, role: 'project_manager' });
              recipients.push(...pmRoles.map(r => ({ email: r.user_email })));
            }
          }
          break;

        case 'TIMESHEET_SUBMITTED':
          if (projectId) {
            const pmRoles = await groonabackend.entities.ProjectUserRole.filter({ project_id: projectId, role: 'project_manager' });
            recipients.push(...pmRoles.map(r => ({ email: r.user_email })));
          }
          const admins = await groonabackend.entities.User.filter({ tenant_id: event.tenant_id, role: 'admin' });
          recipients.push(...admins.map(a => ({ email: a.email })));
          break;

        case 'TIMESHEET_APPROVED':
        case 'TIMESHEET_REJECTED':
          if (event.metadata?.user_email) recipients.push({ email: event.metadata.user_email });
          break;

        case 'TICKET_CREATED':
          const supportAdmins = await groonabackend.entities.User.filter({ tenant_id: event.tenant_id, role: 'admin' });
          recipients.push(...supportAdmins.map(a => ({ email: a.email })));
          break;

        case 'TICKET_ASSIGNED':
        case 'TICKET_SLA_BREACHED':
          if (event.metadata?.assigned_to) recipients.push({ email: event.metadata.assigned_to });
          if (event.event_type === 'TICKET_SLA_BREACHED') {
            const allAdmins = await groonabackend.entities.User.filter({ tenant_id: event.tenant_id, role: 'admin' });
            recipients.push(...allAdmins.map(a => ({ email: a.email })));
          }
          break;

        case 'COMMENT_MENTION':
          if (event.metadata?.mentions) {
            recipients.push(...event.metadata.mentions.map(email => ({ email })));
          }
          if (event.entity_type === 'task') await ensureProjectIdFromTask(event.entity_id);
          else if (event.entity_type === 'project') projectId = event.entity_id;
          break;

        case 'COMMENT_ADDED':
          if (event.entity_type === 'task') {
            const task = await groonabackend.entities.Task.findById(event.entity_id);
            if (task) {
                projectId = task.project_id;
                if (task.assigned_to) recipients.push(...task.assigned_to.map(email => ({ email })));
            }
          } else if (event.entity_type === 'project') {
            projectId = event.entity_id;
            const project = await groonabackend.entities.Project.findById(event.entity_id);
            if (project?.team_members) recipients.push(...project.team_members.map(m => ({ email: m.email })));
          }
          break;

        case 'CLIENT_COMMENT_ADDED':
          if (projectId) {
            const pmRoles = await groonabackend.entities.ProjectUserRole.filter({ project_id: projectId, role: 'project_manager' });
            recipients.push(...pmRoles.map(r => ({ email: r.user_email })));
          }
          break;

        case 'PROJECT_UPDATED':
          projectId = event.entity_id;
          const proj = await groonabackend.entities.Project.findById(event.entity_id);
          if (proj?.team_members) recipients.push(...proj.team_members.map(m => ({ email: m.email })));
          break;

        case 'MILESTONE_COMPLETED':
          if (projectId) {
            const project = await groonabackend.entities.Project.findById(projectId);
            if (project?.team_members) recipients.push(...project.team_members.map(m => ({ email: m.email })));
          }
          break;

        case 'APPROVAL_REQUESTED':
        case 'LEAVE_CANCELLED':
          const authAdmins = await groonabackend.entities.User.filter({ tenant_id: event.tenant_id, role: 'admin' });
          recipients.push(...authAdmins.map(a => ({ email: a.email })));
          break;
      }

      const uniqueRecipients = recipients
        .filter((r, i, arr) => arr.findIndex(x => x.email === r.email) === i)
        .filter(r => r.email !== event.actor_email);

      return { recipients: uniqueRecipients, projectId };
    } catch (error) {
      console.error('[NotificationEngine] Failed to resolve context:', error);
      return { recipients: [], projectId: null };
    }
  }

  // ... (getPreferences and shouldNotify methods remain unchanged) ...
  async getPreferences(recipients, tenantId) {
    try {
      const emails = recipients.map(r => r.email);
      const preferences = await groonabackend.entities.NotificationPreference.filter({
        tenant_id: tenantId,
        user_email: { $in: emails }
      });
      return recipients.map(r => {
        const pref = preferences.find(p => p.user_email === r.email);
        return pref || { user_email: r.email, in_app_enabled: true, email_enabled: true };
      });
    } catch (error) {
      return recipients.map(r => ({ user_email: r.email, in_app_enabled: true, email_enabled: true }));
    }
  }

  shouldNotify(event, prefs, recipient) {
    if (!prefs) return true;
    const criticalEvents = ['TICKET_SLA_BREACHED', 'TIMESHEET_APPROVED', 'TIMESHEET_REJECTED', 'TASK_ASSIGNED'];
    if (criticalEvents.includes(event.event_type)) return true;
    if (prefs.critical_only) return false;
    
    // Map simplified for brevity - assumes same mapping as before
    const eventPrefMap = { 'TASK_ASSIGNED': 'task_assigned', 'TASK_COMPLETED': 'task_completed', 'COMMENT_ADDED': 'comment_added', 'COMMENT_MENTION': 'mention', 'PROJECT_UPDATED': 'project_updated' };
    const prefKey = eventPrefMap[event.event_type];
    if (prefKey && prefs[prefKey] === false) return false;
    return true;
  }

  getChannels(event, prefs) {
    const channels = [];
    if (prefs?.in_app_enabled !== false) channels.push('IN_APP');
    if (prefs?.email_enabled !== false && event.notification_channels?.includes('EMAIL')) channels.push('EMAIL');
    return channels;
  }

  /**
   * Create in-app notification with PROJECT ID
   */
  async createInAppNotification(event, recipient, projectId) {
    const notificationData = this.buildNotificationData(event, recipient, projectId);
    return await groonabackend.entities.Notification.create({ ...notificationData, read: false });
  }

  /**
   * Create email notification with PROJECT ID link
   */
  async createEmailNotification(event, recipient, prefs, projectId) {
    try {
      const emailData = this.buildEmailData(event, recipient, projectId);
      await groonabackend.entities.EmailNotificationLog.create({
        tenant_id: event.tenant_id,
        event_id: event.id,
        recipient_email: recipient.email,
        subject: emailData.subject,
        status: 'pending'
      });
      await groonabackend.integrations.Core.SendEmail({
        to: recipient.email,
        subject: emailData.subject,
        body: emailData.body,
        from_name: 'Groona Notifications'
      });
    } catch (error) { console.error('Email failed', error); }
  }

  buildNotificationData(event, recipient, projectId) {
    const typeLabels = {
      'TASK_ASSIGNED': { type: 'task_assigned', title: 'New Task Assigned' },
      'TASK_COMPLETED': { type: 'task_completed', title: 'Task Completed' },
      'TIMESHEET_SUBMITTED': { type: 'timesheet_submitted', title: 'Timesheet Submitted' },
      'TIMESHEET_APPROVED': { type: 'timesheet_approved', title: 'Timesheet Approved' },
      'TIMESHEET_REJECTED': { type: 'timesheet_rejected', title: 'Timesheet Rejected' },
      'TICKET_ASSIGNED': { type: 'ticket_assigned', title: 'Support Ticket Assigned' },
      'TICKET_SLA_BREACHED': { type: 'sla_breach', title: '⚠️ SLA Breach Alert' },
      'COMMENT_MENTION': { type: 'mention', title: 'You Were Mentioned' },
      'COMMENT_ADDED': { type: 'comment_added', title: 'New Comment' },
      'CLIENT_COMMENT_ADDED': { type: 'client_comment', title: 'Client Comment' },
      'PROJECT_UPDATED': { type: 'project_updated', title: 'Project Updated' },
      'MILESTONE_COMPLETED': { type: 'milestone_completed', title: 'Milestone Completed' }
    };

    const label = typeLabels[event.event_type] || { type: 'system', title: 'Notification' };
    const message = this.buildMessage(event);

    return {
      tenant_id: event.tenant_id,
      recipient_email: recipient.email,
      type: label.type,
      title: label.title,
      message: message,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      project_id: projectId, // CRITICAL: This enables robust routing
      sender_name: event.actor_name || 'System'
    };
  }

  buildMessage(event) {
    const actor = event.actor_name || 'Someone';
    const entity = event.entity_name || 'item';
    // Simplified message builder
    return `${actor} performed action on ${entity}`; 
  }

  buildEmailData(event, recipient, projectId) {
    const message = this.buildMessage(event);
    const label = this.buildNotificationData(event, recipient, projectId);
    const subject = `${label.title} - Groona`;
    
    // Robust Link Generation
    let link = "https://app.groona.com";
    if (projectId) {
       link = `https://app.groona.com/ProjectDetail?id=${projectId}`;
       if (event.entity_type === 'task') link += `&taskId=${event.entity_id}`;
       // We can add commentId here if event supports it
    }

    const body = `
      <html><body>
        <h2>${label.title}</h2>
        <p>${message}</p>
        <a href="${link}" style="padding: 10px 20px; background: #3b82f6; color: white; border-radius: 5px; text-decoration: none;">View Details</a>
      </body></html>
    `;
    return { subject, body };
  }
}

export const notificationEngine = new NotificationEngine();

