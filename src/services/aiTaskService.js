import { groonabackend, API_BASE } from "@/api/groonabackend";

/**
 * AI Task Service - Frontend
 * Handles task creation from AI Assistant conversations
 */

const API_URL = `${API_BASE}/api`;

/**
 * Create task from AI Assistant conversation
 * @param {Object} taskData - Task data from AI
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} Created task
 */
export async function createTaskFromAI(taskData, tenantId, userId, userEmail) {
  try {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Validate and convert estimated_hours to a number or omit it
    let estimatedHours = undefined;
    if (taskData.estimated_hours !== undefined && taskData.estimated_hours !== null) {
      const parsed = Number(taskData.estimated_hours);
      if (!isNaN(parsed) && parsed >= 0) {
        estimatedHours = parsed;
      }
    }

    // Handle both single assignee and multiple assignees
    const payload = {
      title: taskData.title,
      project_name: taskData.project_name,
      sprint_name: taskData.sprint_name,
      milestone_name: taskData.milestone_name,
      story_name: taskData.story_name,
      story_points: taskData.story_points,
      priority: taskData.priority,
      due_date: taskData.due_date,
      ...(estimatedHours !== undefined && { estimated_hours: estimatedHours }),
      description: taskData.description,
      tenant_id: tenantId,
      user_id: userId,
      user_email: userEmail
    };

    // Support multiple assignees (array of names or emails)
    if (taskData.assignee_names && Array.isArray(taskData.assignee_names)) {
      payload.assignee_names = taskData.assignee_names;
    } else if (taskData.assignee_name) {
      // Single assignee fallback
      payload.assignee_name = taskData.assignee_name;
    } else if (taskData.assignee_email) {
      if (Array.isArray(taskData.assignee_email)) {
        payload.assignee_emails = taskData.assignee_email;
      } else {
        payload.assignee_email = taskData.assignee_email;
      }
    }

    const response = await fetch(`${API_URL}/groona-assistant/create-task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create task');
    }

    const result = await response.json();
    return result.task;
  } catch (error) {
    console.error('[AI Task Service] Error creating task:', error);
    throw error;
  }
}

