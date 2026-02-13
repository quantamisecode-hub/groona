import { groonabackend, API_BASE } from "@/api/groonabackend";

/**
 * AI Project Service - Frontend
 * Handles project creation from AI Assistant conversations
 */

const API_URL = `${API_BASE}/api`;

/**
 * Create project from AI Assistant conversation
 * @param {Object} projectData - Project data from AI
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} Created project
 */
export async function createProjectFromAI(projectData, tenantId, userId, userEmail) {
  try {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}/groona-assistant/create-project`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        project_name: projectData.project_name,
        workspace_name: projectData.workspace_name,
        deadline: projectData.deadline,
        description: projectData.description,
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create project');
    }

    const result = await response.json();
    return result.project;
  } catch (error) {
    console.error('[AI Project Service] Error creating project:', error);
    throw error;
  }
}

/**
 * Parse AI response to check if it contains project creation action
 * @param {string} aiResponse - AI assistant response
 * @returns {Object|null} Parsed project data or null
 */
export function parseProjectCreationResponse(aiResponse) {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(aiResponse);
    if (parsed.action === 'create_project') {
      return {
        action: 'create_project',
        project_name: parsed.project_name,
        workspace_name: parsed.workspace_name,
        deadline: parsed.deadline,
        description: parsed.description
      };
    }
    if (parsed.action === 'create_task') {
      return {
        action: 'create_task',
        title: parsed.title,
        project_name: parsed.project_name,
        sprint_name: parsed.sprint_name,
        assignee_email: parsed.assignee_email,
        assignee_name: parsed.assignee_name,
        due_date: parsed.due_date,
        estimated_hours: parsed.estimated_hours,
        description: parsed.description
      };
    }
  } catch (e) {
    // Not JSON, check for action indicators in text
    if (aiResponse.includes('"action": "create_project"') || 
        aiResponse.includes('create_project')) {
      // Try to extract JSON from text
      const jsonMatch = aiResponse.match(/\{[\s\S]*"action":\s*"create_project"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            action: 'create_project',
            project_name: parsed.project_name,
            workspace_name: parsed.workspace_name,
            deadline: parsed.deadline,
            description: parsed.description
          };
        } catch (e2) {
          console.error('Failed to parse project creation JSON:', e2);
        }
      }
    }
    if (aiResponse.includes('"action": "create_task"') || 
        aiResponse.includes('create_task')) {
      // Try to extract JSON from text
      const jsonMatch = aiResponse.match(/\{[\s\S]*"action":\s*"create_task"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            action: 'create_task',
            title: parsed.title,
            project_name: parsed.project_name,
            sprint_name: parsed.sprint_name,
            assignee_email: parsed.assignee_email,
            assignee_name: parsed.assignee_name,
            due_date: parsed.due_date,
            estimated_hours: parsed.estimated_hours,
            description: parsed.description
          };
        } catch (e2) {
          console.error('Failed to parse task creation JSON:', e2);
        }
      }
    }
  }
  return null;
}

/**
 * Check if AI response indicates project creation confirmation
 * @param {string} aiResponse - AI assistant response
 * @returns {boolean} True if response indicates project creation
 */
export function isProjectCreationResponse(aiResponse) {
  const projectData = parseProjectCreationResponse(aiResponse);
  return projectData !== null && projectData.action === 'create_project';
}

