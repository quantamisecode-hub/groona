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

    // For project comments, entityName should be the project name (passed from component)
    // For task comments, we need to fetch the project
    if (entityType === 'project') {
      // For project comments, entityId IS the projectId, and entityName should be the project name
      projectId = entityId;
      // Priority: Use entityName first (most reliable as it's passed directly)
      if (entityName && entityName.trim() !== '') {
        projectName = entityName.trim();
      } else {
        // Fallback: Try to fetch project
        try {
          const project = await this.getProjectDetails(projectId);
          projectName = project ? project.name : 'Unknown Project';
        } catch (e) {
          projectName = 'Unknown Project';
        }
      }
    } else if (entityType === 'task') {
      // For task comments, fetch the task to get project_id and sprint_id
      try {
        // Try both id and _id
        let tasks = await groonabackend.entities.Task.filter({ id: entityId });
        if (!tasks || tasks.length === 0) {
          tasks = await groonabackend.entities.Task.filter({ _id: entityId });
        }
        const task = tasks[0];
        if (task) {
          // 1. Get Project
          projectId = task.project_id;
          if (projectId) {
            const project = await this.getProjectDetails(projectId);
            projectName = project ? project.name : (entityName || 'Unknown Project');
          } else {
            projectName = entityName || 'Unknown Project';
          }

          // 2. Get Task Name
          const taskName = task.title || entityName || 'Task';

          // 3. Get Sprint Name if exists
          let sprintName = '';
          if (task.sprint_id) {
            const sprint = await this.getSprintDetails(task.sprint_id);
            if (sprint) {
              sprintName = sprint.name;
            }
          }

          // 4. Construct rich context name
          // Format: Project > Sprint > Task (if sprint exists)
          // Format: Project > Task (if no sprint)
          if (sprintName) {
            projectName = `${projectName} > ${sprintName} > ${taskName}`;
          } else {
            projectName = `${projectName} > ${taskName}`;
          }
        } else {
          projectName = entityName || 'Unknown Project';
        }
      } catch (e) {
        console.error("Error resolving task context for comment notification", e);
        projectName = entityName || 'Unknown Project';
      }
    } else {
      // Fallback for other entity types
      projectName = entityName || 'Unknown Project';
    }

    // Final check: ensure project name is never empty
    if (!projectName || projectName.trim() === '') {
      projectName = entityName || 'Unknown Project';
    }

    // Get comment preview (first 50 characters for cleaner display)
    let commentPreview = (commentContent || '').trim();
    // Remove @ mentions from preview for cleaner text, but keep the rest
    commentPreview = commentPreview.replace(/@[A-Za-z][A-Za-z\s'-]*/g, '').trim();
    // Remove extra whitespace
    commentPreview = commentPreview.replace(/\s+/g, ' ').trim();

    // Build clear, descriptive notification message with project name and comment preview
    // Always include project name and comment preview in the message
    const previewText = commentPreview && commentPreview.length > 0
      ? `: "${commentPreview}"`
      : '';

    // Ensure project name is always in the message - use resolved projectName
    const finalProjectName = projectName || entityName || 'Unknown Project';

    // Improved message format: "User mentioned you in Context: Preview"
    // "Context" will now be "Project > Sprint > Task" or "Project > Task" or just "Project"
    const message = `${comment.author_name} mentioned you in ${finalProjectName}${previewText}`;

    // Debug logging
    console.log('[NotificationService] Mention detection (Backend will handle notifications):', {
      projectName,
      finalProjectName,
      message,
      mentionsCount: mentions.length
    });

    // NOTE: In-app mention notifications are now handled by backend middleware in SchemaDefinitions.js
    // to prevent duplication and ensure consistency across all clients/devices.
    return { message, finalProjectName };
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
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create comment notifications:', error);
    }
  }
};

