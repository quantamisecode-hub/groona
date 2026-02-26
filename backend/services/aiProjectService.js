const Models = require('../models/SchemaDefinitions');

/**
 * AI Project Service
 * Handles project creation logic for AI Assistant
 */

/**
 * Extract project information from conversation messages
 * @param {Array} messages - Conversation messages
 * @returns {Object} Extracted project data
 */
function extractProjectInfo(messages) {
  const projectInfo = {
    name: null,
    description: null,
    deadline: null,
    workspace_id: null,
    workspace_name: null,
    team_members: [],
    priority: 'medium',
    status: 'planning'
  };

  // Check if this is a project creation conversation
  const isProjectCreation = isProjectCreationConversation(messages);

  // Look through recent messages to extract information
  // Process messages in reverse order (newest first) to prioritize latest user input
  // ONLY extract from USER messages, not assistant messages (to avoid capturing AI questions)
  const recentMessages = messages.slice(-10).filter(msg => msg.role === 'user').reverse();

  console.log('[Project Service] Processing messages for extraction:', recentMessages.map(m => ({ role: m.role, content: m.content?.substring(0, 50) })));

  for (const msg of recentMessages) {
    const content = msg.content || '';
    const contentLower = content.toLowerCase().trim();

    // First, try to extract from parentheses format: "Create a project (name,deadline,workspace)"
    const parenMatch = content.match(/create\s+(?:a\s+)?project\s*\(([^)]+)\)/i);
    if (parenMatch) {
      const parts = parenMatch[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
      console.log('[Project Service] Extracted from parentheses:', parts);

      if (parts.length >= 1 && !projectInfo.name) {
        projectInfo.name = parts[0];
      }
      if (parts.length >= 2 && !projectInfo.deadline) {
        const parsed = parseDate(parts[1]);
        if (parsed) {
          projectInfo.deadline = parsed;
        } else {
          // Store raw date string if parsing fails, will try again later
          projectInfo.deadline = parts[1];
        }
      }
      if (parts.length >= 3 && !projectInfo.workspace_name) {
        projectInfo.workspace_name = parts[2];
      }
    }

    // Also try format without parentheses: "Create a project name,deadline,workspace" (comma-separated)
    if ((!projectInfo.name || !projectInfo.deadline || !projectInfo.workspace_name) && contentLower.includes('create') && contentLower.includes('project')) {
      const commaMatch = content.match(/create\s+(?:a\s+)?project\s+([^,\n\(\)]+?)\s*,\s*([^,\n\(\)]+?)\s*,\s*([^,\n\(\)]+?)(?:\s*[,\n]|$)/i);
      if (commaMatch) {
        if (!projectInfo.name) projectInfo.name = commaMatch[1].trim();
        if (!projectInfo.deadline) {
          const parsed = parseDate(commaMatch[2].trim());
          projectInfo.deadline = parsed || commaMatch[2].trim();
        }
        if (!projectInfo.workspace_name) projectInfo.workspace_name = commaMatch[3].trim();
      }
    }

    // Also try simple format: "Create a project name" (single word after project)
    if (!projectInfo.name && contentLower.includes('create') && contentLower.includes('project')) {
      const simpleMatch = content.match(/create\s+(?:a\s+)?project\s+([^,\n\(\)]+?)(?:\s*[,\n]|$)/i);
      if (simpleMatch && !projectInfo.name) {
        const potentialName = simpleMatch[1].trim();
        // Check if it's not a date or workspace name
        if (!parseDate(potentialName) && potentialName.length > 2) {
          projectInfo.name = potentialName;
        }
      }
    }

    // Extract project name - avoid capturing AI questions
    if (!projectInfo.name) {
      const nameMatch = content.match(/(?:project name|name of the project|project called|create.*project.*named?)\s*[:\-]?\s*["']?([^"'\n\(\)\?]+)["']?/i);
      if (nameMatch && nameMatch[1]) {
        const potentialName = nameMatch[1].trim();
        // Reject if it looks like a question
        if (!potentialName.toLowerCase().includes('would you like') &&
          !potentialName.toLowerCase().includes('what') &&
          !potentialName.toLowerCase().includes('this project') &&
          potentialName.length > 1) {
          projectInfo.name = potentialName;
        }
      }
    }

    // IMPORTANT: If this is a project creation conversation and we don't have a name yet,
    // treat simple user responses as potential project names (follow-up messages)
    // This handles cases where user says "create project" -> AI asks -> user says "ai project"
    if (!projectInfo.name && isProjectCreation) {
      // Skip if message contains question words or looks like a question or command
      const isQuestion = contentLower.includes('?') ||
        contentLower.includes('what') ||
        contentLower.includes('would you') ||
        contentLower.includes('can you') ||
        contentLower.includes('how') ||
        contentLower.includes('when') ||
        contentLower.includes('where') ||
        contentLower.includes('why') ||
        contentLower.startsWith('create') ||
        contentLower.includes('help') ||
        contentLower.includes('i want') ||
        contentLower.includes('please') ||
        contentLower.length > 200; // Skip very long messages

      // Check if message is a simple response (likely a project name)
      // Allow "project" in the name (like "ai project") but reject if message is ONLY about creating a project (command)
      const isCreateCommand = contentLower.match(/^(create|make|start|new)\s+(a\s+)?project/i);
      const isSimpleResponse = !isQuestion &&
        !isCreateCommand &&
        contentLower.length > 0 &&
        contentLower.length < 100 &&
        !contentLower.includes('workspace') &&
        !contentLower.includes('deadline') &&
        !contentLower.includes('due date');

      if (isSimpleResponse) {
        // Check if it's not obviously a date
        const isDate = parseDate(content) !== null;

        // Check if it looks like a project name (not a command, not a question, reasonable length)
        if (!isDate) {
          const trimmed = content.trim();
          // Accept as project name if it's reasonable text (allow "ai project" as two words)
          if (trimmed.length >= 1 && trimmed.length < 100 && !trimmed.match(/^\d+$/)) {
            projectInfo.name = trimmed;
            console.log('[Project Service] ✅ Extracted project name from follow-up message:', trimmed);
            // Once we find a name, break to prioritize this extraction
            break;
          }
        }
      }
    }

    // Extract deadline - improved pattern to catch more date formats
    if (!projectInfo.deadline) {
      // Try various date patterns
      const datePatterns = [
        /(?:deadline|due date|end date|finish by|by|on)\s*[:\-]?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{0,4})/i,
        /(?:deadline|due date|end date|finish by|by|on)\s*[:\-]?\s*([A-Za-z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?\s*,?\s*[0-9]{0,4})/i,
        /(?:deadline|due date|end date|finish by|by|on)\s*[:\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
        /(?:deadline|due date|end date|finish by|by|on)\s*[:\-]?\s*([0-9]{4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2})/i
      ];

      for (const pattern of datePatterns) {
        const dateMatch = content.match(pattern);
        if (dateMatch && dateMatch[1]) {
          const parsed = parseDate(dateMatch[1]);
          if (parsed) {
            projectInfo.deadline = parsed;
            break;
          }
        }
      }

      // Also try to find dates in the message without keywords (but not if we already have a name extracted)
      if (!projectInfo.deadline) {
        const datePattern = /([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{0,4}|[A-Za-z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?\s*,?\s*[0-9]{0,4}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i;
        const dateMatch = content.match(datePattern);
        if (dateMatch && dateMatch[1]) {
          const parsed = parseDate(dateMatch[1]);
          if (parsed) {
            projectInfo.deadline = parsed;
          }
        }
      }
    }

    // Extract workspace
    if (!projectInfo.workspace_name) {
      const workspaceMatch = content.match(/(?:workspace|in workspace|belong to)\s*[:\-]?\s*["']?([^"'\n\(\)]+)["']?/i);
      if (workspaceMatch) {
        projectInfo.workspace_name = workspaceMatch[1].trim();
      }
    }

    // Final validation: if deadline is a string, try to parse it one more time
    if (projectInfo.deadline && typeof projectInfo.deadline === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(projectInfo.deadline)) {
      const parsed = parseDate(projectInfo.deadline);
      if (parsed) {
        projectInfo.deadline = parsed;
      }
    }
  }

  return projectInfo;
}

/**
 * Parse date string to ISO format
 * Handles various date formats including natural language dates
 * @param {string} dateStr - Date string
 * @returns {string|null} ISO date string or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Clean the date string
    let cleanDate = dateStr.trim().toLowerCase();

    // Handle ordinal numbers (1st, 2nd, 3rd, 4th, etc.)
    cleanDate = cleanDate.replace(/(\d+)(st|nd|rd|th)/g, '$1');

    // Try to parse common date formats
    // Format: "10 jan" or "jan 10" or "10 january" or "january 10"
    const monthNames = {
      'jan': 0, 'january': 0,
      'feb': 1, 'february': 1,
      'mar': 2, 'march': 2,
      'apr': 3, 'april': 3,
      'may': 4,
      'jun': 5, 'june': 5,
      'jul': 6, 'july': 6,
      'aug': 7, 'august': 7,
      'sep': 8, 'september': 8,
      'oct': 9, 'october': 9,
      'nov': 10, 'november': 10,
      'dec': 11, 'december': 11
    };

    // Try to match patterns like "10 jan" or "jan 10" (handles "10th jan" after ordinal removal)
    for (const [monthName, monthIndex] of Object.entries(monthNames)) {
      // Pattern 1: "10 jan" or "10 january" (day first)
      const pattern1 = new RegExp(`(\\d+)\\s+${monthName}(?:\\s+(\\d{4}))?`, 'i');
      // Pattern 2: "jan 10" or "january 10" (month first)
      const pattern2 = new RegExp(`${monthName}\\s+(\\d+)(?:\\s+(\\d{4}))?`, 'i');

      let match = cleanDate.match(pattern1);
      if (match) {
        const day = parseInt(match[1]);
        const year = match[2] ? parseInt(match[2]) : new Date().getFullYear();
        if (day >= 1 && day <= 31) {
          const date = new Date(year, monthIndex, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }

      match = cleanDate.match(pattern2);
      if (match) {
        const day = parseInt(match[1]);
        const year = match[2] ? parseInt(match[2]) : new Date().getFullYear();
        if (day >= 1 && day <= 31) {
          const date = new Date(year, monthIndex, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }

    // Try standard Date parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try parsing formats like "DD/MM/YYYY" or "MM/DD/YYYY"
    const slashPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const slashMatch = cleanDate.match(slashPattern);
    if (slashMatch) {
      const day = parseInt(slashMatch[1]);
      const month = parseInt(slashMatch[2]) - 1; // Month is 0-indexed
      const year = parseInt(slashMatch[3]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // Try parsing formats like "YYYY-MM-DD"
    const dashPattern = /(\d{4})-(\d{1,2})-(\d{1,2})/;
    const dashMatch = cleanDate.match(dashPattern);
    if (dashMatch) {
      const year = parseInt(dashMatch[1]);
      const month = parseInt(dashMatch[2]) - 1;
      const day = parseInt(dashMatch[3]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (e) {
    console.error('Date parsing error:', e);
    return null;
  }
}

/**
 * Find workspace by name (fuzzy match)
 * @param {Array} workspaces - List of workspaces
 * @param {string} workspaceName - Workspace name to find
 * @returns {Object|null} Found workspace or null
 */
function findWorkspaceByName(workspaces, workspaceName) {
  if (!workspaceName || !workspaces || workspaces.length === 0) return null;

  const normalized = workspaceName.toLowerCase().trim();

  // Exact match
  let found = workspaces.find(w => w.name.toLowerCase().trim() === normalized);
  if (found) return found;

  // Partial match
  found = workspaces.find(w =>
    w.name.toLowerCase().includes(normalized) ||
    normalized.includes(w.name.toLowerCase())
  );
  if (found) return found;

  return null;
}

/**
 * Create project from extracted information
 * @param {Object} projectInfo - Project information
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} Created project
 */
async function createProjectFromInfo(projectInfo, tenantId, userId, userEmail) {
  // Validate required fields
  if (!projectInfo.name) {
    throw new Error('Project name is required');
  }

  // Find workspace
  let workspaceId = projectInfo.workspace_id;
  if (!workspaceId && projectInfo.workspace_name) {
    const workspaces = await Models.Workspace.find({ tenant_id: tenantId });
    const workspace = findWorkspaceByName(workspaces, projectInfo.workspace_name);
    if (workspace) {
      workspaceId = workspace._id.toString();
    } else {
      throw new Error(`Workspace "${projectInfo.workspace_name}" not found`);
    }
  }

  // If no workspace found, use default or first available
  if (!workspaceId) {
    const workspaces = await Models.Workspace.find({ tenant_id: tenantId });
    if (workspaces.length > 0) {
      const defaultWorkspace = workspaces.find(w => w.is_default) || workspaces[0];
      workspaceId = defaultWorkspace._id.toString();
    }
  }

  // Validate and parse deadline if provided
  let deadlineDate = undefined;
  if (projectInfo.deadline) {
    // If deadline is already a valid date string (ISO format), use it
    if (typeof projectInfo.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(projectInfo.deadline)) {
      deadlineDate = projectInfo.deadline;
    } else {
      // Try to parse it
      deadlineDate = parseDate(projectInfo.deadline);
      if (!deadlineDate) {
        console.warn('Invalid deadline format, skipping:', projectInfo.deadline);
      }
    }
  }

  // Build project data
  const projectData = {
    tenant_id: tenantId,
    name: projectInfo.name,
    description: projectInfo.description || `Project created via AI Assistant: ${projectInfo.name}`,
    status: projectInfo.status || 'planning',
    priority: projectInfo.priority || 'medium',
    deadline: deadlineDate || undefined,
    workspace_id: workspaceId,
    owner: userEmail,
    progress: 0,
    team_members: [
      {
        email: userEmail,
        role: 'project_manager'
      },
      ...(projectInfo.team_members || [])
    ]
  };

  // Create project
  const project = new Models.Project(projectData);
  await project.save();

  // Create ProjectUserRole entry
  try {
    await Models.ProjectUserRole.create({
      tenant_id: tenantId,
      user_id: userId,
      project_id: project._id.toString(),
      role: 'project_manager'
    });
  } catch (error) {
    console.error('Failed to create ProjectUserRole:', error);
    // Continue even if this fails
  }

  // Create activity log
  try {
    await Models.Activity.create({
      tenant_id: tenantId,
      action: 'created',
      entity_type: 'project',
      entity_id: project._id.toString(),
      entity_name: project.name,
      project_id: project._id.toString(),
      user_email: userEmail,
      details: `Created project "${project.name}" via AI Assistant`
    });
  } catch (error) {
    console.error('Failed to create activity:', error);
    // Continue even if this fails
  }

  // Send emails to team members who were added
  try {
    const emailService = require('./emailService');
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.warn('FRONTEND_URL not set in environment variables, skipping email notification');
      return;
    }

    // Get all team members except the creator
    const teamMembers = (projectInfo.team_members || []).filter(m => {
      const memberEmail = typeof m === 'string' ? m : m.email;
      return memberEmail && memberEmail.toLowerCase() !== userEmail.toLowerCase();
    });

    // Get user info for the creator
    const creator = await Models.User.findOne({ email: userEmail });
    const creatorName = creator?.full_name || userEmail;

    // Send email to each team member
    for (const member of teamMembers) {
      const memberEmail = typeof member === 'string' ? member : member.email;
      const memberUser = await Models.User.findOne({ email: memberEmail });
      const memberName = memberUser?.full_name || memberEmail;

      await emailService.sendEmail({
        to: memberEmail,
        templateType: 'project_member_added',
        data: {
          memberName,
          memberEmail,
          projectName: project.name,
          projectDescription: project.description,
          addedBy: creatorName,
          projectUrl: `${frontendUrl}/ProjectDetail?id=${project._id}`
        }
      });
    }
  } catch (error) {
    console.error('Failed to send project member emails:', error);
    // Continue even if email fails
  }

  return project;
}

/**
 * Check if conversation is about creating a project
 * @param {Array} messages - Conversation messages
 * @returns {boolean} True if conversation is about project creation
 */
function isProjectCreationConversation(messages) {
  if (!messages || messages.length === 0) return false;

  const recentMessages = messages.slice(-5);
  const combinedText = recentMessages
    .map(m => (m.content || '').toLowerCase())
    .join(' ');

  const projectKeywords = [
    'create project',
    'new project',
    'make a project',
    'start project',
    'project creation',
    'create a project'
  ];

  return projectKeywords.some(keyword => combinedText.includes(keyword));
}

/**
 * Check if all required project information is collected
 * @param {Object} projectInfo - Project information
 * @param {Array} workspaces - Available workspaces
 * @returns {Object} Status with missing fields
 */
function checkProjectInfoComplete(projectInfo, workspaces = []) {
  const missing = [];

  // Check project name
  if (!projectInfo.name || (typeof projectInfo.name === 'string' && projectInfo.name.trim() === '')) {
    missing.push('project name');
  }

  // Check deadline - accept both parsed ISO format and raw string (will be parsed later)
  // A deadline is considered present if it exists and is not empty
  const hasDeadline = projectInfo.deadline &&
    (typeof projectInfo.deadline === 'string' ? projectInfo.deadline.trim() !== '' : true);
  if (!hasDeadline) {
    missing.push('deadline');
  }

  // Workspace is required only if workspaces exist
  const hasWorkspace = projectInfo.workspace_id ||
    (projectInfo.workspace_name && typeof projectInfo.workspace_name === 'string' && projectInfo.workspace_name.trim() !== '');
  if (workspaces.length > 0 && !hasWorkspace) {
    missing.push('workspace');
  }

  const result = {
    isComplete: missing.length === 0,
    missing: missing
  };

  console.log('[Project Service] Completeness check:', {
    projectInfo,
    missing,
    isComplete: result.isComplete
  });

  return result;
}

module.exports = {
  extractProjectInfo,
  createProjectFromInfo,
  findWorkspaceByName,
  isProjectCreationConversation,
  checkProjectInfoComplete,
  parseDate
};

// Export parseDate for use in routes
module.exports.parseDate = parseDate;
