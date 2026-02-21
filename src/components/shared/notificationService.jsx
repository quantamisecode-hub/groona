import { groonabackend } from "@/api/groonabackend";

/**
 * Notification Service
 * Handles creating notifications with rich context (Project Name, Assigner Name)
 */
export const notificationService = {
  /**
   * Helper to get Project Details
   */
  async getProjectDetails(projectId) {
    if (!projectId) return null;
    try {
      // Try both id and _id
      let projects = await groonabackend.entities.Project.filter({ id: projectId });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ _id: projectId });
      }
      return projects[0];
    } catch (e) {
      console.error("Error fetching project for notification:", e);
      return null;
    }
  },

  /**
   * Helper to get Sprint Details
   */
  async getSprintDetails(sprintId) {
    if (!sprintId) return null;
    try {
      // Try both id and _id
      let sprints = await groonabackend.entities.Sprint.filter({ id: sprintId });
      if (!sprints || sprints.length === 0) {
        sprints = await groonabackend.entities.Sprint.filter({ _id: sprintId });
      }
      return sprints[0];
    } catch (e) {
      console.error("Error fetching sprint for notification:", e);
      return null;
    }
  },

  /**
   * Helper to get User Name from Email
   */
  async getUserName(email) {
    if (!email) return "Unknown User";
    try {
      // Check if it's already a name (no @)
      if (!email.includes('@')) return email;

      const users = await groonabackend.entities.User.filter({ email: email });
      if (users && users.length > 0) {
        return users[0].full_name || users[0].email;
      }
      return email;
    } catch (e) {
      return email;
    }
  },

  /**
   * Create notification for task assignment
   */
  async notifyTaskAssignment({ task, assignedUsers, assignedBy, tenantId }) {
    // 1. Fetch Project Name for clear display
    const project = await this.getProjectDetails(task.project_id);
    const projectName = project ? project.name : "Unknown Project";

    // 2. Resolve Assigner Name (No Email)
    const assignerName = await this.getUserName(assignedBy);

    const notifications = assignedUsers.map(userEmail => ({
      tenant_id: tenantId,
      recipient_email: userEmail,
      type: 'task_assigned',
      title: 'New Task Assigned',
      // Clear message with Assigner Name and Project Name
      message: `${assignerName} assigned you to task "${task.title}" in project "${projectName}"`,
      entity_type: 'task',
      entity_id: task.id,
      project_id: task.project_id,
      project_name: projectName,
      sender_name: assignerName,
      read: false,
    }));

    try {
      if (notifications.length > 0) {
        await groonabackend.entities.Notification.bulkCreate(notifications);
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create task assignment notifications:', error);
    }
  },

  /**
   * Create notification for task completion
   */
  async notifyTaskCompletion({ task, completedBy, projectOwner, tenantId }) {
    const project = await this.getProjectDetails(task.project_id);
    const projectName = project ? project.name : "Unknown Project";
    const completerName = await this.getUserName(completedBy);

    try {
      if (projectOwner) {
        await groonabackend.entities.Notification.create({
          tenant_id: tenantId,
          recipient_email: projectOwner,
          type: 'task_completed',
          title: 'Task Completed',
          message: `${completerName} completed task "${task.title}" in project "${projectName}"`,
          entity_type: 'task',
          entity_id: task.id,
          project_id: task.project_id,
          project_name: projectName,
          sender_name: completerName,
          read: false,
        });
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create task completion notification:', error);
    }
  },

  /**
   * Create notification for comments with mentions
   */
  async notifyComment({ comment, mentions, entityType, entityId, entityName, tenantId, commentContent }) {
    let projectId = null;
    let projectName = null;
    let sprintName = '';
    let taskName = '';
    let assignees = [];

    // 1. Context Resolution
    if (entityType === 'project') {
      projectId = entityId;
      projectName = entityName || 'Unknown Project';

      // Fetch project if name is missing
      if (projectName === 'Unknown Project') {
        try {
          const project = await this.getProjectDetails(projectId);
          if (project) projectName = project.name;
        } catch (e) { /* ignore */ }
      }
    } else if (entityType === 'task') {
      try {
        // Fetch Task for details
        let task = null;
        let tasks = await groonabackend.entities.Task.filter({ id: entityId });
        if (!tasks || tasks.length === 0) {
          tasks = await groonabackend.entities.Task.filter({ _id: entityId });
        }
        if (tasks && tasks.length > 0) {
          task = tasks[0];
          projectId = task.project_id;
          taskName = task.title;

          // Get Assignees
          if (task.assigned_to) {
            if (Array.isArray(task.assigned_to)) {
              assignees = task.assigned_to.map(a => typeof a === 'object' ? a.email : a);
            } else if (typeof task.assigned_to === 'object') {
              assignees = [task.assigned_to.email];
            } else {
              assignees = [task.assigned_to];
            }
          }

          // Get Project Name
          if (projectId) {
            const project = await this.getProjectDetails(projectId);
            projectName = project ? project.name : (entityName || 'Unknown Project');
          }

          // Get Sprint Name
          if (task.sprint_id) {
            const sprint = await this.getSprintDetails(task.sprint_id);
            if (sprint) sprintName = sprint.name;
          }
        }
      } catch (e) {
        console.error("Error resolving task details:", e);
      }
    }

    // Default names if resolution failed
    projectName = projectName || entityName || 'Unknown Project';

    // Construct Context String
    // Format: Project > Sprint > Task
    let contextString = projectName;
    if (sprintName) contextString += ` > ${sprintName}`;
    if (taskName) contextString += ` > ${taskName}`;

    // 2. Identify Recipients
    // Mentions are passed in 'mentions' array (emails)
    // Assignees are in 'assignees' array (emails)

    const mentionSet = new Set(mentions || []);
    const assigneeSet = new Set(assignees || []);

    // Remove author from all lists
    mentionSet.delete(comment.author_email);
    assigneeSet.delete(comment.author_email);

    // If a user is mentioned, remove them from assignees list (Mention takes priority)
    mentionSet.forEach(email => assigneeSet.delete(email));

    // 3. Prepare Notifications
    const notifications = [];

    // Deep Link Generation
    // Base: /SprintBoard
    // Params: taskId (if task), commentId (for highlight)
    let deepLink = `/SprintBoard?`;
    if (entityType === 'task') {
      deepLink += `taskId=${entityId}`;
    } else if (entityType === 'project') {
      deepLink = `/ProjectDetail?id=${entityId}`; // Different flow for project comments
    }

    // Append commentId for highlighting
    if (comment.id) {
      deepLink += `&commentId=${comment.id}`;
    }

    // Handle Mentions (High Priority)
    mentionSet.forEach(email => {
      notifications.push({
        tenant_id: tenantId,
        recipient_email: email,
        type: 'mention', // Special type for mentions
        title: 'You were mentioned',
        message: `${comment.author_name} mentioned you in ${contextString}`,
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
        project_name: projectName,
        sender_name: comment.author_name,
        comment_id: comment.id,
        link: deepLink, // <--- NEW LINK
        read: false,
        created_date: new Date().toISOString()
      });
    });

    // Handle Assignees (Standard Priority)
    assigneeSet.forEach(email => {
      notifications.push({
        tenant_id: tenantId,
        recipient_email: email,
        type: 'comment_added',
        title: 'New Comment',
        message: `${comment.author_name} commented on ${taskName || contextString}`,
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
        project_name: projectName,
        sender_name: comment.author_name,
        comment_id: comment.id,
        link: deepLink, // <--- NEW LINK
        read: false,
        created_date: new Date().toISOString()
      });
    });

    // 4. Save to Database (Promise.all)
    if (notifications.length > 0) {
      try {
        console.log(`[NotificationService] Saving ${notifications.length} notifications...`);
        await Promise.all(notifications.map(async (n) => {
          // 4a. Save to DB
          await groonabackend.entities.Notification.create(n);

          // 4b. Trigger Email (Fire and Forget)
          // We don't await this to keep UI snappy, or we can await if critical.
          // Let's await for reliability but catch errors so notifications don't fail.
          try {
            const recipientName = await this.getUserName(n.recipient_email);
            const emailPayload = {
              to: n.recipient_email,
              templateType: 'comment_added',
              templateData: {
                recipientName: recipientName,
                authorName: comment.author_name,
                commentContent: commentContent || "New comment received.",
                contextString: contextString,
                actionUrl: `${window.location.origin}${deepLink}` // Full URL for email
              }
            };

            // Use the backend function wrapper
            groonabackend.functions.invoke('sendNotificationEmail', emailPayload)
              .catch(err => console.error('[NotificationService] Email trigger failed silently:', err));

          } catch (emailErr) {
            console.error('[NotificationService] Failed to prepare email:', emailErr);
          }
        }));
        console.log('[NotificationService] Notifications saved and emails triggered.');
      } catch (error) {
        console.error('[NotificationService] Failed to save notifications:', error);
      }
    }

    return { count: notifications.length };
  },

  /**
   * Create notification for project updates
   */
  async notifyProjectUpdate({ project, updateType, updatedBy, teamMembers, tenantId, updatedByEmail }) {
    // teamMembers should already be filtered (excluding the uploader), but filter again just in case
    const notifications = teamMembers
      .filter(email => !updatedByEmail || email !== updatedByEmail)
      .map(userEmail => ({
        tenant_id: tenantId,
        recipient_email: userEmail,
        type: 'project_updated',
        title: 'Project Updated',
        message: `${updatedBy} ${updateType} project: "${project.name}"`,
        entity_type: 'project',
        entity_id: project.id,
        project_id: project.id,
        project_name: project.name,
        sender_name: updatedBy,
        read: false,
      }));

    try {
      if (notifications.length > 0) {
        await groonabackend.entities.Notification.bulkCreate(notifications);
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create project update notifications:', error);
    }
  },

  /**
   * Create notification for new comments (to owner/watchers)
   */
  async notifyNewComment({ comment, recipients, entityType, entityId, entityName, tenantId }) {
    // Determine Project Context (same logic as above)
    let projectId = null;
    let projectName = "Unknown Project";

    try {
      if (entityType === 'task') {
        // Try both id and _id
        let tasks = await groonabackend.entities.Task.filter({ id: entityId });
        if (!tasks || tasks.length === 0) {
          tasks = await groonabackend.entities.Task.filter({ _id: entityId });
        }
        const task = tasks[0];
        if (task) {
          projectId = task.project_id;
          const project = await this.getProjectDetails(projectId);
          let baseProjectName = project ? project.name : (entityName || "Unknown Project");

          const taskName = task.title || entityName || 'Task';
          let sprintName = '';
          if (task.sprint_id) {
            const sprint = await this.getSprintDetails(task.sprint_id);
            if (sprint) {
              sprintName = sprint.name;
            }
          }

          if (sprintName) {
            projectName = `${baseProjectName} > ${sprintName} > ${taskName}`;
          } else {
            projectName = `${baseProjectName} > ${taskName}`;
          }
        }
      } else if (entityType === 'project') {
        projectId = entityId;
        const project = await this.getProjectDetails(projectId);
        projectName = project ? project.name : "";
      }
    } catch (e) {
      console.error("Error resolving context", e);
    }

    const notifications = recipients
      .filter(email => email !== comment.author_email)
      .map(userEmail => {
        const projLabel = projectName.includes(' > ') ? projectName : `Project: **${projectName}**`;
        return {
          tenant_id: tenantId,
          recipient_email: userEmail,
          type: 'comment_added',
          title: 'New Comment',
          message: `${comment.author_name} commented in ${projLabel}`,
          entity_type: entityType,
          entity_id: entityId,
          project_id: projectId,
          project_name: projectName,
          sender_name: comment.author_name,
          comment_id: comment.id, // <--- ADDED COMMENT ID
          read: false,
        };
      });

    try {
      if (notifications.length > 0) {
        await groonabackend.entities.Notification.bulkCreate(notifications);

        // Trigger Emails (Fire and Forget)
        notifications.forEach(n => {
          try {
            // Reconstruct deep link (simplified)
            let deepLink = `/SprintBoard?`;
            if (entityType === 'task') deepLink += `taskId=${entityId}`;
            else if (entityType === 'project') deepLink = `/ProjectDetail?id=${entityId}`;
            if (comment.id) deepLink += `&commentId=${comment.id}`;

            const emailPayload = {
              to: n.recipient_email,
              templateType: 'comment_added',
              templateData: {
                recipientName: "User", // We don't have name here, template handles it nicely
                authorName: comment.author_name,
                commentContent: comment.content || "New comment received.",
                contextString: n.project_name || entityName || "Project",
                actionUrl: `${window.location.origin}${deepLink}`
              }
            };

            groonabackend.functions.invoke('sendNotificationEmail', emailPayload)
              .catch(e => console.error('[NotificationService] Email trigger failed silently:', e));
          } catch (e) { console.error(e); }
        });
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create comment notifications:', error);
    }
  }
};