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
  async notifyComment({ entityId }) {
    // Consolidate processing to backend via database hooks
    console.log(`[NotificationService] Comment processing delegated to backend for entity ${entityId}`);
    return { count: 0, delegated: true };
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
  async notifyNewComment() {
    // Delegated to backend
    return { count: 0, delegated: true };
  }
};