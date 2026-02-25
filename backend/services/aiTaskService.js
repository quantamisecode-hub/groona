const Models = require('../models/SchemaDefinitions');

/**
 * AI Task Service
 * Handles task creation logic for AI Assistant
 */

/**
 * Extract task information from conversation messages
 * @param {Array} messages - Conversation messages
 * @returns {Object} Extracted task data
 */
function extractTaskInfo(messages) {
  const taskInfo = {
    title: null,
    description: null,
    project_id: null,
    project_name: null,
    sprint_id: null,
    sprint_name: null,
    assignee_email: null,
    assignee_name: null,
    due_date: null,
    estimated_hours: null,
    priority: 'medium',
    status: 'todo',
    task_type: 'task'
  };

  // Look through recent messages to extract information
  // ONLY extract from USER messages, not assistant messages (to avoid capturing AI questions)
  const recentMessages = messages.slice(-10).reverse().filter(msg => msg.role === 'user');

  for (const msg of recentMessages) {
    const content = msg.content || '';
    const contentLower = content.toLowerCase();

    // First, try to extract from parentheses format: "Create a task (project,sprint,title,assignee,due date,estimate)"
    const parenMatch = content.match(/create\s+(?:a\s+)?task\s*\(([^)]+)\)/i);
    if (parenMatch) {
      const parts = parenMatch[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
      console.log('[Task Service] Extracted from parentheses:', parts);

      // Order: project, sprint, title, assignee, due date, estimate
      if (parts.length >= 1 && !taskInfo.project_name) {
        taskInfo.project_name = parts[0];
      }
      if (parts.length >= 2 && !taskInfo.sprint_name) {
        taskInfo.sprint_name = parts[1];
      }
      if (parts.length >= 3 && !taskInfo.title) {
        taskInfo.title = parts[2];
      }
      if (parts.length >= 4 && !taskInfo.assignee_email && !taskInfo.assignee_name) {
        const assignee = parts[3];
        if (assignee.includes('@')) {
          taskInfo.assignee_email = assignee;
        } else {
          taskInfo.assignee_name = assignee;
        }
      }
      if (parts.length >= 5 && !taskInfo.due_date) {
        const parsed = parseDate(parts[4]);
        if (parsed) {
          taskInfo.due_date = parsed;
        }
      }
      if (parts.length >= 6 && !taskInfo.estimated_hours) {
        const hours = parseFloat(parts[5]);
        if (!isNaN(hours)) {
          taskInfo.estimated_hours = hours;
        }
      }
    }

    // Also try format without parentheses: "Create a task project,sprint,title,assignee,due date,estimate"
    if ((!taskInfo.project_name || !taskInfo.title) && contentLower.includes('create') && contentLower.includes('task')) {
      const commaMatch = content.match(/create\s+(?:a\s+)?task\s+([^,\n\(\)]+?)\s*,\s*([^,\n\(\)]+?)\s*,\s*([^,\n\(\)]+?)(?:\s*[,\n]|$)/i);
      if (commaMatch) {
        if (!taskInfo.project_name) taskInfo.project_name = commaMatch[1].trim();
        if (!taskInfo.sprint_name) taskInfo.sprint_name = commaMatch[2].trim();
        if (!taskInfo.title) taskInfo.title = commaMatch[3].trim();
      }
    }

    // Extract task title
    if (!taskInfo.title) {
      const titleMatch = content.match(/(?:task title|title|task name|name of the task|create.*task.*named?)\s*[:\-]?\s*["']?([^"'\n\(\)]+)["']?/i);
      if (titleMatch) {
        taskInfo.title = titleMatch[1].trim();
      }
      // Also try to extract standalone task title if it's a simple message
      if (!taskInfo.title && contentLower.includes('create') && contentLower.includes('task')) {
        const simpleMatch = content.match(/create\s+(?:a\s+)?task\s+([^,\n\(\)]+?)(?:\s*[,\n]|$)/i);
        if (simpleMatch) {
          taskInfo.title = simpleMatch[1].trim();
        }
      }
    }

    // Extract project
    if (!taskInfo.project_name) {
      const projectMatch = content.match(/(?:project|in project|for project|belong to project)\s*[:\-]?\s*["']?([^"'\n]+)["']?/i);
      if (projectMatch) {
        taskInfo.project_name = projectMatch[1].trim();
      }
    }

    // Extract sprint
    if (!taskInfo.sprint_name) {
      const sprintMatch = content.match(/(?:sprint|in sprint|for sprint)\s*[:\-]?\s*["']?([^"'\n]+)["']?/i);
      if (sprintMatch) {
        taskInfo.sprint_name = sprintMatch[1].trim();
      }
    }

    // Extract assignee
    if (!taskInfo.assignee_email && !taskInfo.assignee_name) {
      const assigneeMatch = content.match(/(?:assign to|assignee|assign|assigned to|give to)\s*[:\-]?\s*["']?([^"'\n]+)["']?/i);
      if (assigneeMatch) {
        const assignee = assigneeMatch[1].trim();
        // Check if it's an email
        if (assignee.includes('@')) {
          taskInfo.assignee_email = assignee;
        } else {
          taskInfo.assignee_name = assignee;
        }
      }
    }

    // Extract due date
    if (!taskInfo.due_date) {
      const datePatterns = [
        /(?:due date|due|deadline|by|on)\s*[:\-]?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{0,4})/i,
        /(?:due date|due|deadline|by|on)\s*[:\-]?\s*([A-Za-z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?\s*,?\s*[0-9]{0,4})/i,
        /(?:due date|due|deadline|by|on)\s*[:\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i
      ];

      for (const pattern of datePatterns) {
        const dateMatch = content.match(pattern);
        if (dateMatch && dateMatch[1]) {
          const parsed = parseDate(dateMatch[1]);
          if (parsed) {
            taskInfo.due_date = parsed;
            break;
          }
        }
      }
    }

    // Extract estimated hours
    if (!taskInfo.estimated_hours) {
      const hoursMatch = content.match(/(?:estimate|estimated|hours|hrs|h)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
      if (hoursMatch) {
        taskInfo.estimated_hours = parseFloat(hoursMatch[1]);
      }
    }

    // Extract priority
    if (content.match(/\b(urgent|high|medium|low)\s+priority\b/i)) {
      const priorityMatch = content.match(/\b(urgent|high|medium|low)\s+priority\b/i);
      if (priorityMatch) {
        taskInfo.priority = priorityMatch[1].toLowerCase();
      }
    }
  }

  return taskInfo;
}

/**
 * Parse date string to ISO format (reuse from project service)
 * @param {string} dateStr - Date string
 * @returns {string|null} ISO date string or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    let cleanDate = dateStr.trim().toLowerCase();
    cleanDate = cleanDate.replace(/(\d+)(st|nd|rd|th)/g, '$1');

    const monthNames = {
      'jan': 0, 'january': 0, 'feb': 1, 'february': 1,
      'mar': 2, 'march': 2, 'apr': 3, 'april': 3,
      'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
      'aug': 7, 'august': 7, 'sep': 8, 'september': 8,
      'oct': 9, 'october': 9, 'nov': 10, 'november': 10,
      'dec': 11, 'december': 11
    };

    for (const [monthName, monthIndex] of Object.entries(monthNames)) {
      const pattern1 = new RegExp(`(\\d+)\\s+${monthName}(?:\\s+(\\d{4}))?`, 'i');
      const pattern2 = new RegExp(`${monthName}\\s+(\\d+)(?:\\s+(\\d{4}))?`, 'i');

      let match = cleanDate.match(pattern1);
      if (match) {
        const day = parseInt(match[1]);
        const year = match[2] ? parseInt(match[2]) : new Date().getFullYear();
        const date = new Date(year, monthIndex, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }

      match = cleanDate.match(pattern2);
      if (match) {
        const day = parseInt(match[1]);
        const year = match[2] ? parseInt(match[2]) : new Date().getFullYear();
        const date = new Date(year, monthIndex, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }

    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Find project by name (fuzzy match)
 * @param {Array} projects - List of projects
 * @param {string} projectName - Project name to find
 * @returns {Object|null} Found project or null
 */
function findProjectByName(projects, projectName) {
  if (!projectName || !projects || projects.length === 0) return null;

  const normalized = projectName.toLowerCase().trim();

  let found = projects.find(p => p.name.toLowerCase().trim() === normalized);
  if (found) return found;

  found = projects.find(p =>
    p.name.toLowerCase().includes(normalized) ||
    normalized.includes(p.name.toLowerCase())
  );
  if (found) return found;

  return null;
}

/**
 * Find sprint by name (fuzzy match)
 * @param {Array} sprints - List of sprints
 * @param {string} sprintName - Sprint name to find
 * @returns {Object|null} Found sprint or null
 */
function findSprintByName(sprints, sprintName) {
  if (!sprintName || !sprints || sprints.length === 0) return null;

  const normalized = sprintName.toLowerCase().trim();

  let found = sprints.find(s => s.name.toLowerCase().trim() === normalized);
  if (found) return found;

  found = sprints.find(s =>
    s.name.toLowerCase().includes(normalized) ||
    normalized.includes(s.name.toLowerCase())
  );
  if (found) return found;

  return null;
}

/**
 * Find user by name or email
 * @param {Array} users - List of users
 * @param {string} identifier - User name or email
 * @returns {Object|null} Found user or null
 */
function findUserByIdentifier(users, identifier) {
  if (!identifier || !users || users.length === 0) return null;

  const normalized = identifier.toLowerCase().trim();

  // Try email first
  let found = users.find(u => u.email.toLowerCase() === normalized);
  if (found) return found;

  // Try name
  found = users.find(u =>
    u.full_name?.toLowerCase().includes(normalized) ||
    normalized.includes(u.full_name?.toLowerCase())
  );
  if (found) return found;

  return null;
}

/**
 * Create task from extracted information
 * @param {Object} taskInfo - Task information
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} Created task
 */
async function createTaskFromInfo(taskInfo, tenantId, userId, userEmail) {
  // Validate required fields
  if (!taskInfo.title) {
    throw new Error('Task title is required');
  }

  if (!taskInfo.project_id && !taskInfo.project_name) {
    throw new Error('Project is required');
  }

  // Find project
  let projectId = taskInfo.project_id;
  let workspaceId = null;

  if (!projectId && taskInfo.project_name) {
    const projects = await Models.Project.find({ tenant_id: tenantId });
    const project = findProjectByName(projects, taskInfo.project_name);
    if (project) {
      projectId = project._id.toString();
      workspaceId = project.workspace_id;
    } else {
      throw new Error(`Project "${taskInfo.project_name}" not found`);
    }
  } else if (projectId) {
    const project = await Models.Project.findById(projectId);
    if (project) {
      workspaceId = project.workspace_id;
    }
  }

  if (!projectId) {
    throw new Error('Project not found');
  }

  // Find sprint if provided
  let sprintId = taskInfo.sprint_id;
  if (!sprintId && taskInfo.sprint_name) {
    const sprints = await Models.Sprint.find({ tenant_id: tenantId, project_id: projectId });
    const sprint = findSprintByName(sprints, taskInfo.sprint_name);
    if (sprint) {
      sprintId = sprint._id.toString();
    }
    // Don't throw error if sprint not found, just continue without it
  }

  // STRICT: Find and validate assignee if provided
  let assignedTo = [];
  if (taskInfo.assignee_name) {
    // Get all team members for this tenant
    const users = await Models.User.find({ tenant_id: tenantId });

    // STRICT: Find user by name only (no email matching for privacy)
    const normalizedName = taskInfo.assignee_name.toLowerCase().trim();
    const user = users.find(u => {
      const fullName = u.full_name?.toLowerCase().trim();
      return fullName === normalizedName ||
        fullName?.includes(normalizedName) ||
        normalizedName.includes(fullName);
    });

    if (!user) {
      // STRICT: Reject if name doesn't match any team member
      throw new Error(`The name "${taskInfo.assignee_name}" is not a team member, or you entered the wrong name. Please provide the correct team member name.`);
    }

    // Only assign if user is found
    assignedTo = [user.email];
  } else if (taskInfo.assignee_email) {
    // If email is provided directly, validate it's a team member
    const users = await Models.User.find({ tenant_id: tenantId });
    const user = users.find(u => u.email.toLowerCase() === taskInfo.assignee_email.toLowerCase());

    if (!user) {
      throw new Error(`The email provided does not belong to a team member. Please provide a valid team member name instead.`);
    }

    assignedTo = [user.email];
  }

  // Validate and parse due date
  let dueDate = undefined;
  if (taskInfo.due_date) {
    if (typeof taskInfo.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(taskInfo.due_date)) {
      dueDate = taskInfo.due_date;
    } else {
      dueDate = parseDate(taskInfo.due_date);
      if (!dueDate) {
        console.warn('Invalid due date format, skipping:', taskInfo.due_date);
      }
    }
  }

  // Validate and convert estimated_hours to a number or use 0
  let estimatedHours = 0;
  if (taskInfo.estimated_hours !== undefined && taskInfo.estimated_hours !== null && taskInfo.estimated_hours !== 'undefined') {
    const parsed = Number(taskInfo.estimated_hours);
    if (!isNaN(parsed) && parsed >= 0) {
      estimatedHours = parsed;
    }
  }

  // Build task data
  const taskData = {
    tenant_id: tenantId,
    project_id: projectId,
    workspace_id: workspaceId,
    title: taskInfo.title,
    description: taskInfo.description || `Task created via AI Assistant: ${taskInfo.title}`,
    task_type: taskInfo.task_type || 'task',
    status: taskInfo.status || 'todo',
    priority: taskInfo.priority || 'medium',
    assigned_to: assignedTo,
    reporter: userEmail,
    sprint_id: sprintId || null,
    due_date: dueDate || undefined,
    estimated_hours: estimatedHours,
    story_points: 0,
    labels: [],
    attachments: [],
    dependencies: [],
    acceptance_criteria: '',
    subtasks: [],
    custom_fields: {},
    ai_generated: true,
    ai_metadata: {
      created_via: 'ai_assistant',
      created_at: new Date().toISOString()
    }
  };

  // Create task
  const task = new Models.Task(taskData);
  await task.save();

  // Create activity log
  try {
    await Models.Activity.create({
      tenant_id: tenantId,
      action: 'created',
      entity_type: 'task',
      entity_id: task._id.toString(),
      entity_name: task.title,
      project_id: projectId,
      user_email: userEmail,
      user_name: userEmail,
      details: `Created task "${task.title}" via AI Assistant`
    });
  } catch (error) {
    console.error('Failed to create activity:', error);
  }

  // Return task immediately, then send emails asynchronously
  // This ensures task creation is not affected by email failures
  const taskToReturn = task;

  // Send email to assigned team members asynchronously after task is returned
  if (assignedTo && assignedTo.length > 0) {
    setImmediate(async () => {
      try {
        const emailService = require('./emailService');
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) {
          console.warn('FRONTEND_URL not set in environment variables, skipping email notification');
          return;
        }

        // Get project info
        const project = await Models.Project.findById(projectId);
        const projectName = project?.name || 'Unknown Project';

        // Get assigner info
        const assigner = await Models.User.findOne({ email: userEmail });
        const assignerName = assigner?.full_name || userEmail;

        // Get assignee info and send email
        for (const assigneeEmail of assignedTo) {
          try {
            const assignee = await Models.User.findOne({ email: assigneeEmail });
            const assigneeName = assignee?.full_name || assigneeEmail;

            await emailService.sendEmail({
              to: assigneeEmail,
              templateType: 'task_assigned',
              data: {
                assigneeName,
                assigneeEmail,
                taskTitle: taskToReturn.title,
                taskDescription: taskToReturn.description,
                projectName,
                assignedBy: assignerName,
                dueDate: taskToReturn.due_date,
                priority: taskToReturn.priority,
                taskUrl: `${frontendUrl}/ProjectDetail?id=${projectId}&taskId=${taskToReturn._id}`
              }
            });
          } catch (error) {
            console.error(`Failed to send task assignment email to ${assigneeEmail}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to send task assignment emails:', error);
        // Email failure does not affect task creation
      }
    });
  }

  return taskToReturn;
}

/**
 * Check if conversation is about creating a task
 * @param {Array} messages - Conversation messages
 * @returns {boolean} True if conversation is about task creation
 */
function isTaskCreationConversation(messages) {
  if (!messages || messages.length === 0) return false;

  const recentMessages = messages.slice(-5);
  const combinedText = recentMessages
    .map(m => (m.content || '').toLowerCase())
    .join(' ');

  const taskKeywords = [
    'create task',
    'new task',
    'make a task',
    'add task',
    'task creation',
    'create a task'
  ];

  return taskKeywords.some(keyword => combinedText.includes(keyword));
}

/**
 * Check if all required task information is collected
 * @param {Object} taskInfo - Task information
 * @param {Array} projects - Available projects
 * @returns {Object} Status with missing fields
 */
function checkTaskInfoComplete(taskInfo, projects = []) {
  const missing = [];

  // Check project first (required)
  const hasProject = taskInfo.project_id ||
    (taskInfo.project_name && typeof taskInfo.project_name === 'string' && taskInfo.project_name.trim() !== '');
  if (!hasProject && projects.length > 0) {
    missing.push('project');
  }

  // Check title (required)
  if (!taskInfo.title || (typeof taskInfo.title === 'string' && taskInfo.title.trim() === '')) {
    missing.push('task title');
  }

  const result = {
    isComplete: missing.length === 0,
    missing: missing
  };

  console.log('[Task Service] Completeness check:', {
    taskInfo,
    missing,
    isComplete: result.isComplete
  });

  return result;
}

module.exports = {
  extractTaskInfo,
  createTaskFromInfo,
  findProjectByName,
  findSprintByName,
  findUserByIdentifier,
  isTaskCreationConversation,
  checkTaskInfoComplete,
  parseDate
};
