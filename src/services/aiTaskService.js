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
    
    const response = await fetch(`${API_URL}/groona-assistant/create-task`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: taskData.title,
        project_name: taskData.project_name,
        sprint_name: taskData.sprint_name,
        assignee_email: taskData.assignee_email,
        assignee_name: taskData.assignee_name,
        due_date: taskData.due_date,
        ...(estimatedHours !== undefined && { estimated_hours: estimatedHours }),
        description: taskData.description,
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail
      }),
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

