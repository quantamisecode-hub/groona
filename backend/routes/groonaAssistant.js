const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');
const axios = require('axios');
const aiProjectService = require('../services/aiProjectService');
const aiTaskService = require('../services/aiTaskService');

// OpenRouter API Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Whitelist of working models - STRICT matching patterns (case-insensitive)
// These patterns must appear in the model name or ID
const WORKING_MODELS_PATTERNS = [
    'devstral-2-2512',
    'devstral 2 2512',
    'mimo-v2',
    'mimo v2',
    'kat-coder-pro',
    'kat coder pro',
    'deepseek-r1-0528',
    'deepseek r1 0528',
    'deepseek-r1t-chimera',
    'deepseek r1t chimera',
    'deepseek-r1t2-chimera',
    'deepseek r1t2 chimera',
    'r1t-chimera',
    'r1t chimera',
    'trinity-mini',
    'trinity mini',
    'gemma-3-27b',
    'gemma 3 27b',
    'llama-3.2-3b-instruct',
    'llama 3.2 3b instruct',
    'llama-3.3-70b-instruct',
    'llama 3.3 70b instruct',
    'hermes-3-405b-instruct',
    'hermes 3 405b instruct',
    'glm-4.5-air',
    'glm 4.5 air',
    'mistral-small-3.1-24b',
    'mistral small 3.1 24b',
    'nemotron-nano-12b-2-vl',
    'nemotron nano 12b 2 vl',
    'qwen3-4b',
    'qwen3 4b',
    'mistral-7b-instruct',
    'mistral 7b instruct',
    'venice-uncensored',
    'venice uncensored'
];

// Helper function to check if a model matches the whitelist (STRICT matching)
function isModelWhitelisted(model) {
    if (!model || !model.name || !model.id) return false;
    
    const modelNameLower = model.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
    const modelIdLower = model.id.toLowerCase();
    
    // STRICT: Check if model name or ID contains EXACT pattern match
    // Must match one of the patterns exactly (allowing for variations in separators)
    return WORKING_MODELS_PATTERNS.some(pattern => {
        const patternLower = pattern.toLowerCase();
        // Normalize separators for comparison
        const normalizedName = modelNameLower.replace(/[-_\s]+/g, ' ');
        const normalizedId = modelIdLower.replace(/[-_\s]+/g, ' ');
        const normalizedPattern = patternLower.replace(/[-_\s]+/g, ' ');
        
        // Check if normalized strings contain the pattern
        return normalizedName.includes(normalizedPattern) || normalizedId.includes(normalizedPattern);
    });
}

// Helper: Get available models from OpenRouter (only working models)
async function getOpenRouterModels() {
    if (!OPENROUTER_API_KEY) {
        // Return empty array if API key not configured - models must come from OpenRouter API
        console.warn('[Groona Assistant] OpenRouter API key not configured');
        return [];
    }

    try {
        const response = await axios.get(`${OPENROUTER_API_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.APP_URL || process.env.API_BASE || '',
                'X-Title': 'Groona Assistant'
            }
        });

        // STRICT FILTER: Only include whitelisted working models
        const allModels = response.data.data || [];
        const whitelistedModels = allModels
            .filter(model => {
                if (!model || !model.id || !model.name) return false;
                if (model.id.toLowerCase().includes('embedding')) return false; // Exclude embedding-only models
                return isModelWhitelisted(model); // STRICT whitelist check
            })
            .sort((a, b) => {
                // Sort by name for consistency
                return (a.name || a.id).localeCompare(b.name || b.id);
            })
            .map(model => ({
                id: model.id,
                name: model.name || model.id,
                description: model.description || `Model: ${model.name || model.id}`,
                context_length: model.context_length || 0,
                pricing: model.pricing || { prompt: '0', completion: '0' }
            }));

        // Log for debugging
        console.log(`[Groona Assistant] Filtered ${whitelistedModels.length} whitelisted models from ${allModels.length} total models`);
        
        // Return only whitelisted models (empty array if none match)
        return whitelistedModels;
    } catch (error) {
        console.error('[Groona Assistant] Error fetching OpenRouter models:', error.message);
        // Return empty array on error - no models should be shown if API fails
        return [];
    }
}

// Helper: Build context from database
async function buildContext(tenant_id, user_id, content) {
    let contextStr = "";
    if (!content) return contextStr;
    const lowerQ = content.toLowerCase();
    
    try {
        const workspaces = await Models.Workspace.find({ tenant_id });
        const users = await Models.User.find({ tenant_id });
        
        contextStr += `\n=== AVAILABLE WORKSPACES ===\n`;
        if (workspaces.length > 0) {
            contextStr += workspaces.map(w => `- Name: "${w.name}"`).join('\n');
        } else {
            contextStr += "No workspaces found. (User needs to create one first)\n";
        }
        
        // CRITICAL: Never include email addresses - privacy protection
        contextStr += `\n=== AVAILABLE TEAM MEMBERS (Names Only) ===\n`;
        if (users.length > 0) {
            contextStr += users
                .filter(u => u.full_name) // Only include users with names
                .map(u => `- Name: ${u.full_name}`)
                .join('\n');
        } else {
            contextStr += "No team members found.\n";
        }
    } catch (e) {
        console.error("Error building context:", e);
    }

    if (lowerQ.match(/task|project|assign|team|manager|status|due|ticket/)) {
        const tasks = await Models.Task.find({ tenant_id }).sort({ due_date: 1 }).limit(20);
        contextStr += `\n=== RELEVANT TASKS ===\n`;
        contextStr += tasks.map(t => `* Task: "${t.title}" | Status: ${t.status} | Due: ${t.due_date}`).join('\n');
    }
    return contextStr;
}

// 1. Get Available Models
router.get('/models', async (req, res) => {
    try {
        const models = await getOpenRouterModels();
        res.json({
            success: true,
            models: models,
            totalAvailable: models.length
        });
    } catch (error) {
        console.error('[Groona Assistant] Error in /models:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Get Conversations
router.get('/conversations', async (req, res) => {
    const { user_id, tenant_id } = req.query;
    try {
        const conversations = await Models.Conversation.find({ 
            user_id, 
            tenant_id, 
            is_active: true,
            'metadata.assistant_type': 'groona' // Filter for Groona Assistant conversations
        }).sort({ updated_date: -1 }).limit(20);
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Create Conversation
router.post('/conversations', async (req, res) => {
    try {
        const convo = new Models.Conversation({ 
            ...req.body, 
            messages: [],
            metadata: {
                ...(req.body.metadata || {}),
                assistant_type: 'groona' // Mark as Groona Assistant conversation
            }
        });
        await convo.save();
        res.json(convo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Delete Conversation
router.delete('/conversations/:id', async (req, res) => {
    try {
        const conversation = await Models.Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Soft delete by setting is_active to false
        conversation.is_active = false;
        await conversation.save();
        
        res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Main Chat Route
router.post('/chat', async (req, res) => {
    const { conversation_id, content, file_urls, context, model, user_id, tenant_id } = req.body;
    
    if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "OpenRouter API key not configured" });
    }

    try {
        const conversation = await Models.Conversation.findById(conversation_id);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        // Add user message
        const userMsg = { role: 'user', content: content, file_urls, created_at: new Date() };
        conversation.messages.push(userMsg);
        conversation.updated_date = new Date();
        await conversation.save();

        // Build context
        const deepContext = await buildContext(tenant_id, user_id, content);
        let contextBlock = "";
        if (context) contextBlock += `${context}\n`;
        if (deepContext) contextBlock += `${deepContext}\n`;

        // Get workspaces and projects for project/task creation
        const workspaces = await Models.Workspace.find({ tenant_id });
        const projects = await Models.Project.find({ tenant_id });
        const workspaceList = workspaces.map(w => `- ${w.name}`).join('\n');
        const projectList = projects.map(p => `- ${p.name}`).join('\n');
        
        // Get team members (names only - NO emails for privacy)
        const teamMembers = await Models.User.find({ tenant_id });
        const teamMemberList = teamMembers
            .filter(u => u.full_name) // Only include users with names
            .map(u => `- ${u.full_name}`)
            .join('\n');

        // Build system prompt for project/task creation
        const systemPrompt = `You are Groona, a friendly and intelligent Project Management Assistant powered by OpenRouter.

TONE & LANGUAGE:
- Speak naturally like ChatGPT - be conversational and friendly
- Never sound like a form or robot
- Ask for missing info politely and naturally
- Use short, friendly sentences that are easy to understand
- Avoid technical jargon unless absolutely necessary
- Be concise but warm - like chatting with a helpful colleague

RESPONSE FORMATTING:
- Use **bold** for important terms like project names, member names, dates, and key information
- Add proper spacing between paragraphs (double line breaks)
- Make your responses easy to scan and read

CORE INSTRUCTIONS:

1. PROJECT CREATION:
If the user wants to "Create a Project", gather these required pieces of information:
- Project Name (REQUIRED)
- Workspace (REQUIRED - User MUST select from available workspaces)
- Deadline (REQUIRED - Date)
- Team Members to Invite (Optional)

AVAILABLE WORKSPACES:
${workspaceList || "No workspaces found. User needs to create one first."}

AVAILABLE PROJECTS:
${projectList || "No projects found."}

AVAILABLE TEAM MEMBERS (Names Only - Use these exact names for assignees):
${teamMemberList || "No team members found."}

BEHAVIOR:
- If ALL required information is present (name, workspace, deadline), respond IMMEDIATELY with JSON: {"action": "create_project", "project_name": "[name]", "workspace_name": "[workspace]", "deadline": "[date]", "description": "[generated description]"}
- Only ask questions if information is missing - ask naturally like "What would you like to name your project?" or "Which workspace should I create this in?"
- Check conversation history - user might have provided info in previous messages

2. TASK CREATION:
If the user wants to "Create a Task", gather:
- Project (REQUIRED)
- Task Title (REQUIRED)
- Sprint (Optional)
- Assignee Name (Optional - MUST be a valid team member name from the available team members list)
- Due Date (Optional)
- Estimated Hours (Optional)

CRITICAL PRIVACY RULES:
- NEVER display, mention, or reveal any email addresses in your responses
- NEVER show email IDs in chat - this is a strict privacy requirement
- Only use team member names (full names) when referring to assignees
- If user provides an email address, convert it to the team member's name if they exist

ASSIGNEE VALIDATION:
- When user provides an assignee name, you MUST verify it matches a team member from the available list
- If the name doesn't match any team member, respond with: "The name you entered is not a team member, or you entered the wrong name. Please provide the correct team member name."
- Use "assignee_name" field (NOT assignee_email) in the JSON response
- Only include assignee if the name exactly matches a team member

BEHAVIOR:
- If ALL required information is present (project, title), respond IMMEDIATELY with JSON: {"action": "create_task", "title": "[title]", "project_name": "[project]", "sprint_name": "[sprint]", "assignee_name": "[name]", "due_date": "[date]", "estimated_hours": [hours], "description": "[generated description]"}
- If assignee name is provided but doesn't match any team member, respond with an error message (do NOT create the task)
- Only ask questions if information is missing - ask naturally and politely
- NEVER include email addresses in your responses

For all other queries, respond naturally and helpfully. Always use **bold** for important terms like project names, dates, member names, and key information. Keep responses concise but friendly. NEVER display email addresses.`;

        // Build messages array for OpenRouter
        const messages = [];
        
        // Add system message
        messages.push({
            role: 'system',
            content: systemPrompt + (contextBlock ? `\n\nCONTEXT:\n${contextBlock}` : '')
        });

        // Add conversation history (last 10 messages)
        const historyMessages = conversation.messages.slice(-10);
        historyMessages.forEach(msg => {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content || ''
                });
            }
        });

        // Add current user message
        messages.push({
            role: 'user',
            content: content
        });

        // Call OpenRouter API
        const selectedModel = model || 'meta-llama/llama-3.2-3b-instruct:free';
        
        // STRICT VALIDATION: Ensure the selected model is whitelisted
        const availableModels = await getOpenRouterModels();
        const isModelValid = availableModels.some(m => m.id === selectedModel);
        
        if (!isModelValid) {
            console.error(`[Groona Assistant] Attempted to use non-whitelisted model: ${selectedModel}`);
            return res.status(400).json({ 
                error: `Model "${selectedModel}" is not in the whitelist. Please select a valid model.` 
            });
        }
        
        const openRouterResponse = await axios.post(
            `${OPENROUTER_API_URL}/chat/completions`,
            {
                model: selectedModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': process.env.APP_URL || process.env.API_BASE || '',
                    'X-Title': 'Groona Assistant',
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        let assistantMessage = openRouterResponse.data.choices[0]?.message?.content || 'No response generated';
        
        // Check if response contains project/task creation action
        let actionData = null;
        let displayMessage = assistantMessage;
        
        try {
            const jsonMatch = assistantMessage.match(/\{[\s\S]*"action"[\s\S]*\}/);
            if (jsonMatch) {
                actionData = JSON.parse(jsonMatch[0]);
                
                // Replace JSON with a clean message
                if (actionData.action === 'create_project') {
                    displayMessage = `Your project **${actionData.project_name}** has been created successfully!`;
                } else if (actionData.action === 'create_task') {
                    displayMessage = `Your task **${actionData.title}** has been created successfully!`;
                }
            }
        } catch (e) {
            // Not JSON, continue normally
        }

        // Add assistant message with clean display content
        conversation.messages.push({ 
            role: 'assistant', 
            content: assistantMessage, // Store original for action parsing
            created_at: new Date(),
            action: actionData // Store action data for frontend
        });
        await conversation.save();

        // Return response with clean display message
        res.json({
            message: displayMessage, // Return clean message instead of JSON
            model: selectedModel,
            usage: openRouterResponse.data.usage,
            action: actionData // Include action data if present
        });

    } catch (error) {
        console.error('[Groona Assistant] Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: error.response?.data?.error?.message || error.message || 'Failed to generate response'
        });
    }
});

// 5. Create Project Endpoint
router.post('/create-project', async (req, res) => {
    const { project_name, workspace_name, deadline, description, tenant_id, user_id, user_email } = req.body;
    
    if (!project_name || !tenant_id || !user_id || !user_email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const projectInfo = {
            name: project_name,
            description: description || `Project created via Groona Assistant: ${project_name}`,
            deadline: deadline || undefined,
            workspace_name: workspace_name
        };

        const project = await aiProjectService.createProjectFromInfo(
            projectInfo,
            tenant_id,
            user_id,
            user_email
        );

        res.json({ 
            success: true, 
            project: project,
            message: `Project "${project.name}" created successfully!`
        });
    } catch (error) {
        console.error('Project creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 6. Create Task Endpoint
router.post('/create-task', async (req, res) => {
    const { title, project_name, sprint_name, assignee_name, assignee_email, due_date, estimated_hours, description, tenant_id, user_id, user_email } = req.body;
    
    if (!title || !tenant_id || !user_id || !user_email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Validate and convert estimated_hours to a number or undefined
        let validEstimatedHours = undefined;
        if (estimated_hours !== undefined && estimated_hours !== null && estimated_hours !== 'undefined') {
            const parsed = Number(estimated_hours);
            if (!isNaN(parsed) && parsed >= 0) {
                validEstimatedHours = parsed;
            }
        }
        
        // STRICT: Validate assignee if provided
        if (assignee_name) {
            const teamMembers = await Models.User.find({ tenant_id });
            const normalizedName = assignee_name.toLowerCase().trim();
            const isValidMember = teamMembers.some(u => {
                const fullName = u.full_name?.toLowerCase().trim();
                return fullName === normalizedName || 
                       fullName?.includes(normalizedName) ||
                       normalizedName.includes(fullName);
            });
            
            if (!isValidMember) {
                return res.status(400).json({ 
                    error: `The name "${assignee_name}" is not a team member, or you entered the wrong name. Please provide the correct team member name.` 
                });
            }
        }
        
        // STRICT: If email is provided, validate it's a team member
        if (assignee_email && !assignee_name) {
            const teamMembers = await Models.User.find({ tenant_id });
            const isValidMember = teamMembers.some(u => u.email.toLowerCase() === assignee_email.toLowerCase());
            
            if (!isValidMember) {
                return res.status(400).json({ 
                    error: `The email provided does not belong to a team member. Please provide a valid team member name instead.` 
                });
            }
        }
        
        const taskInfo = {
            title: title,
            description: description || `Task created via Groona Assistant: ${title}`,
            project_name: project_name,
            sprint_name: sprint_name,
            assignee_name: assignee_name, // Use name instead of email
            ...(assignee_email && !assignee_name && { assignee_email: assignee_email }), // Only if name not provided
            due_date: due_date,
            ...(validEstimatedHours !== undefined && { estimated_hours: validEstimatedHours })
        };

        const task = await aiTaskService.createTaskFromInfo(
            taskInfo,
            tenant_id,
            user_id,
            user_email
        );

        res.json({ 
            success: true, 
            task: task,
            message: `Task "${task.title}" created successfully!`
        });
    } catch (error) {
        console.error('Task creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
