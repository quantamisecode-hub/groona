import { groonabackend } from "@/api/groonabackend";

/**
 * Centralized Event Emitter
 * All modules emit events through this service instead of creating notifications directly
 */

class EventEmitter {
  /**
   * Emit an activity event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async emit(eventData) {
    try {
      const event = await groonabackend.entities.ActivityEvent.create({
        ...eventData,
        processed: false,
        created_date: new Date().toISOString()
      });

      console.log(`[EventEmitter] Event emitted: ${eventData.event_type}`, event);

      // Trigger notification processing asynchronously
      this.processEvent(event).catch(err => {
        console.error('[EventEmitter] Event processing failed:', err);
      });

      return event;
    } catch (error) {
      console.error('[EventEmitter] Failed to emit event:', error);
      // Don't throw - we don't want to break the main flow
      return null;
    }
  }

  /**
   * Process an event and create notifications
   * @param {Object} event - Activity event
   */
  async processEvent(event) {
    try {
      // Import notification engine dynamically to avoid circular dependencies
      const { notificationEngine } = await import('./notificationEngine');
      await notificationEngine.processEvent(event);
      
      // Mark event as processed
      await groonabackend.entities.ActivityEvent.update(event.id, { processed: true });
    } catch (error) {
      console.error('[EventEmitter] Failed to process event:', error);
      throw error;
    }
  }

  // Convenience methods for common events

  async taskCreated({ task, createdBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TASK_CREATED',
      actor_email: createdBy.email,
      actor_name: createdBy.name,
      entity_type: 'task',
      entity_id: task.id,
      entity_name: task.title,
      metadata: {
        project_id: task.project_id,
        project_name: task.project_name
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async taskAssigned({ task, assignedTo, assignedBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TASK_ASSIGNED',
      actor_email: assignedBy.email,
      actor_name: assignedBy.name,
      entity_type: 'task',
      entity_id: task.id,
      entity_name: task.title,
      metadata: {
        assigned_to: assignedTo,
        project_id: task.project_id,
        project_name: task.project_name
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async taskCompleted({ task, completedBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TASK_COMPLETED',
      actor_email: completedBy.email,
      actor_name: completedBy.name,
      entity_type: 'task',
      entity_id: task.id,
      entity_name: task.title,
      metadata: {
        project_id: task.project_id,
        project_name: task.project_name
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async timesheetSubmitted({ timesheet, submittedBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TIMESHEET_SUBMITTED',
      actor_email: submittedBy.email,
      actor_name: submittedBy.name,
      entity_type: 'timesheet',
      entity_id: timesheet.id,
      entity_name: `Timesheet for ${timesheet.date}`,
      metadata: {
        project_id: timesheet.project_id,
        task_id: timesheet.task_id,
        hours: timesheet.hours,
        total_minutes: timesheet.total_minutes
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async timesheetApproved({ timesheet, approvedBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TIMESHEET_APPROVED',
      actor_email: approvedBy.email,
      actor_name: approvedBy.name,
      entity_type: 'timesheet',
      entity_id: timesheet.id,
      entity_name: `Timesheet for ${timesheet.date}`,
      metadata: {
        user_email: timesheet.user_email
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async timesheetRejected({ timesheet, rejectedBy, reason, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TIMESHEET_REJECTED',
      actor_email: rejectedBy.email,
      actor_name: rejectedBy.name,
      entity_type: 'timesheet',
      entity_id: timesheet.id,
      entity_name: `Timesheet for ${timesheet.date}`,
      metadata: {
        user_email: timesheet.user_email,
        reason: reason
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async ticketCreated({ ticket, createdBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TICKET_CREATED',
      actor_email: createdBy.email,
      actor_name: createdBy.name,
      entity_type: 'ticket',
      entity_id: ticket.id,
      entity_name: ticket.title,
      metadata: {
        ticket_number: ticket.ticket_number,
        priority: ticket.priority,
        category: ticket.category
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async ticketAssigned({ ticket, assignedTo, assignedBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TICKET_ASSIGNED',
      actor_email: assignedBy.email,
      actor_name: assignedBy.name,
      entity_type: 'ticket',
      entity_id: ticket.id,
      entity_name: ticket.title,
      metadata: {
        assigned_to: assignedTo,
        ticket_number: ticket.ticket_number,
        priority: ticket.priority
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async ticketSLABreached({ ticket, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TICKET_SLA_BREACHED',
      entity_type: 'ticket',
      entity_id: ticket.id,
      entity_name: ticket.title,
      metadata: {
        ticket_number: ticket.ticket_number,
        assigned_to: ticket.assigned_to_email,
        sla_due_at: ticket.sla_due_at
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async commentAdded({ comment, mentions, entityType, entityId, entityName, tenantId }) {
    // Emit separate events for mentions and regular comments
    if (mentions && mentions.length > 0) {
      await this.emit({
        tenant_id: tenantId,
        event_type: 'COMMENT_MENTION',
        actor_email: comment.author_email,
        actor_name: comment.author_name,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        metadata: {
          comment_id: comment.id,
          mentions: mentions,
          content: comment.content.substring(0, 100)
        },
        notification_channels: ['IN_APP', 'EMAIL']
      });
    }

    return this.emit({
      tenant_id: tenantId,
      event_type: 'COMMENT_ADDED',
      actor_email: comment.author_email,
      actor_name: comment.author_name,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      metadata: {
        comment_id: comment.id,
        content: comment.content.substring(0, 100)
      },
      notification_channels: ['IN_APP']
    });
  }

  async clientCommentAdded({ comment, projectId, projectName, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'CLIENT_COMMENT_ADDED',
      actor_email: comment.author_email,
      actor_name: comment.author_name,
      entity_type: 'comment',
      entity_id: comment.id,
      entity_name: `Comment on ${projectName}`,
      metadata: {
        project_id: projectId,
        project_name: projectName,
        content: comment.content.substring(0, 100)
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async projectUpdated({ project, updatedBy, updateType, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'PROJECT_UPDATED',
      actor_email: updatedBy.email,
      actor_name: updatedBy.name,
      entity_type: 'project',
      entity_id: project.id,
      entity_name: project.name,
      metadata: {
        update_type: updateType
      },
      notification_channels: ['IN_APP']
    });
  }

  async milestoneCompleted({ milestone, completedBy, projectId, projectName, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'MILESTONE_COMPLETED',
      actor_email: completedBy.email,
      actor_name: completedBy.name,
      entity_type: 'milestone',
      entity_id: milestone.id,
      entity_name: milestone.title,
      metadata: {
        project_id: projectId,
        project_name: projectName
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async leaveSubmitted({ leave, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'APPROVAL_REQUESTED',
      actor_email: leave.user_email,
      actor_name: leave.user_name,
      entity_type: 'leave',
      entity_id: leave.id,
      entity_name: `Leave request for ${leave.total_days} days`,
      metadata: {
        leave_type: leave.leave_type_name,
        start_date: leave.start_date,
        end_date: leave.end_date,
        total_days: leave.total_days
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async leaveApproved({ leave, approvedBy, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TIMESHEET_APPROVED', // Reusing existing type for consistency
      actor_email: approvedBy.email,
      actor_name: approvedBy.name,
      entity_type: 'leave',
      entity_id: leave.id,
      entity_name: `Leave approved`,
      metadata: {
        user_email: leave.user_email,
        leave_type: leave.leave_type_name,
        start_date: leave.start_date,
        end_date: leave.end_date
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async leaveRejected({ leave, rejectedBy, reason, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'TIMESHEET_REJECTED', // Reusing existing type
      actor_email: rejectedBy.email,
      actor_name: rejectedBy.name,
      entity_type: 'leave',
      entity_id: leave.id,
      entity_name: `Leave rejected`,
      metadata: {
        user_email: leave.user_email,
        reason: reason
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }

  async leaveCancelled({ leave, cancelledBy, reason, tenantId }) {
    return this.emit({
      tenant_id: tenantId,
      event_type: 'LEAVE_CANCELLED',
      actor_email: cancelledBy.email,
      actor_name: cancelledBy.name,
      entity_type: 'leave',
      entity_id: leave.id,
      entity_name: `Leave cancelled`,
      metadata: {
        user_email: leave.user_email,
        leave_type: leave.leave_type_name,
        reason: reason,
        was_approved: leave.status === 'approved'
      },
      notification_channels: ['IN_APP', 'EMAIL']
    });
  }
}

// Export singleton instance
export const eventEmitter = new EventEmitter();

