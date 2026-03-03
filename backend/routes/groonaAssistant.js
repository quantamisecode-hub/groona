const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');
const axios = require('axios');
const aiProjectService = require('../services/aiProjectService');
const aiTaskService = require('../services/aiTaskService');

// Groq API Configuration
const GROQ_API_KEY = process.env.GROQ_API;
const GROQ_API_URL = 'https://api.groq.com/openai/v1';

// Whitelist of Groq models - These are commonly available on Groq
const WORKING_MODELS = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: 'Groq\'s most capable model, great for complex tasks and analysis.',
        context_length: 128000
    },
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: 'Fast and efficient for quick questions and simple tasks.',
        context_length: 128000
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'High quality model with a large context window.',
        context_length: 32768
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B It',
        description: 'Google\'s Gemma model optimized for instruction following.',
        context_length: 8192
    }
];

// Helper: Get available models from Groq (static whitelisted list for reliability)
async function getGroqModels() {
    if (!GROQ_API_KEY) {
        console.warn('[Groona Assistant] Groq API key not configured');
        return [];
    }

    // For Groq, we'll use a curated list of reliable models instead of fetching all
    // This provides a better UX by only showing models we know work well for Groona
    return WORKING_MODELS;
}


// Helper: Build context from database
async function buildContext(tenant_id, user_id, content, requestingUser) {
    let contextStr = "";
    if (!content) return contextStr;
    const lowerQ = content.toLowerCase();

    try {
        if (!requestingUser) requestingUser = await Models.User.findById(user_id);
        const workspaces = await Models.Workspace.find({ tenant_id });
        const users = await Models.User.find({ tenant_id });
        const projects = await Models.Project.find({ tenant_id });
        const milestones = await Models.Milestone.find({ tenant_id });
        const expenses = await Models.ProjectExpense.find({ tenant_id });
        const exchangeRates = await Models.ExchangeRate.find({}); // Fetch ALL rates for cross-conversion

        // FINANCIAL RESTRICTION: Admin with custom_role='project_manager' cannot see financial data
        const isProjectManager = requestingUser?.role === 'admin' && requestingUser?.custom_role === 'project_manager';

        if (isProjectManager) {
            contextStr += `\n[NOTE: The requesting user is a Project Manager. Financial data visibility is RESTRICTED. Do not provide budget or revenue details.]\n`;
        }

        contextStr += `\n=== AVAILABLE WORKSPACES ===\n`;
        if (workspaces.length > 0) {
            contextStr += workspaces.map(w => `- Name: "${w.name}"`).join('\n');
        } else {
            contextStr += "No workspaces found. (User needs to create one first)\n";
        }

        // Helper: Currency Conversion Logic matching Profitability Page
        const getRate = (from, to) => {
            if (!from || !to || from === to) return 1;
            const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
            const rate = exchangeRates.find(r => r.from === from.toUpperCase() && r.to === to.toUpperCase());
            if (rate) return rate.rate;

            // Try cross conversion via common base (prefer EUR or USD)
            const fromToUSD = exchangeRates.find(r => r.from === from.toUpperCase() && r.to === 'USD');
            const toToUSD = exchangeRates.find(r => r.from === to.toUpperCase() && r.to === 'USD');
            if (fromToUSD && toToUSD) return fromToUSD.rate / toToUSD.rate;

            return 1; // Fallback
        };

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

        // Add Project Analytics & Progress Context
        if (lowerQ.match(/analytics|project|revenue|profit|margin|performance|analysis|metric|status|timesheet|billable|cost|budget|task|activity|workload/)) {
            contextStr += `\n=== PROJECT ANALYTICS & FINANCIAL PROFITABILITY (Official Data) ===\n`;
            const now = new Date();

            // Fetch ALL relevant timesheets for accurate labor cost
            const timesheets = await Models.Timesheet.find({ tenant_id });

            if (projects.length > 0) {
                for (const p of projects) {
                    const pName = p.name;
                    const pId = String(p._id);
                    const billingModel = p.billing_model || 'fixed_price';
                    const currency = p.currency || 'INR';

                    // 1. Calculate Labor costs from Approved Billable timesheets
                    const projectTimesheets = timesheets.filter(ts => String(ts.project_id) === pId);
                    const approvedBillableTimesheets = projectTimesheets.filter(ts => ts.status === 'approved' && ts.is_billable !== false);

                    let laborCost = 0;
                    let nonBillableCost = 0;
                    let totalHours = 0;

                    projectTimesheets.forEach(ts => {
                        const h = (ts.total_minutes || 0) / 60;
                        totalHours += h;

                        const tsCost = ts.snapshot_total_cost || 0;
                        const tsCurrency = ts.currency || 'INR';
                        const rate = getRate(tsCurrency, currency);

                        if (ts.status === 'approved' && ts.is_billable !== false) {
                            laborCost += (tsCost * rate);
                        } else if (ts.is_billable === false || (ts.work_type === 'rework' || ts.work_type === 'bug')) {
                            nonBillableCost += (tsCost * rate);
                        }
                    });

                    // 2. Calculate Non-Labor costs from Approved Expenses
                    const projectExpenses = expenses.filter(e => String(e.project_id) === pId && e.status === 'approved');
                    const totalExpenseCost = projectExpenses.reduce((sum, e) => {
                        const eAmount = e.amount || 0;
                        const eCurrency = e.currency || currency;
                        const rate = getRate(eCurrency, currency);
                        return sum + (eAmount * rate);
                    }, 0);

                    const totalActualCost = laborCost + totalExpenseCost;

                    // 3. Determine Contract Value/Budget based on Billing Model
                    let contractValue = Number(p.contract_amount || p.budget || 0);

                    if (billingModel === 'retainer') {
                        const amount = Number(p.retainer_amount || p.contract_amount || 0);
                        const start = p.contract_start_date ? new Date(p.contract_start_date) : (p.created_date || new Date());
                        const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + (now.getDate() >= start.getDate() ? 1 : 0);
                        contractValue = amount * Math.max(1, months);
                    } else if (billingModel === 'time_and_materials') {
                        const estHours = Number(p.estimated_duration || 0);
                        const rate = Number(p.default_bill_rate_per_hour || 0);
                        if (estHours > 0 && rate > 0) contractValue = estHours * rate;
                    }

                    const netProfit = contractValue - totalActualCost;
                    const margin = contractValue > 0 ? (netProfit / contractValue) * 100 : 0;

                    // 4. Timeline Health & Delay Impact
                    const deadline = p.deadline ? new Date(p.deadline) : null;
                    const daysOverdue = (deadline && now > deadline) ? Math.ceil((now - deadline) / (1000 * 60 * 60 * 24)) : 0;

                    const start = p.start_date ? new Date(p.start_date) : (p.created_date || new Date());
                    const durationSoFar = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
                    const dailyBurn = totalActualCost / durationSoFar;
                    const delayCostImpact = daysOverdue * dailyBurn;

                    // 5. Phase performance
                    const projectMilestones = milestones.filter(m => String(m.project_id) === pId);
                    const phases = projectMilestones.map(m => {
                        const mId = String(m._id);
                        const mData = projectTimesheets.filter(ts => String(ts.milestone_id) === mId && ts.status === 'approved');
                        const mExp = projectExpenses.filter(e => String(e.milestone_id) === mId);

                        const mLabor = mData.reduce((s, ts) => s + ((ts.snapshot_total_cost || 0) * getRate(ts.currency || 'INR', currency)), 0);
                        const mEx = mExp.reduce((s, e) => s + ((e.amount || 0) * getRate(e.currency || currency, currency)), 0);
                        const mCost = mLabor + mEx;
                        const mRevenue = m.budget_value || 0;

                        let health = 'Healthy';
                        if (mRevenue > 0) {
                            const util = (mCost / mRevenue) * 100;
                            if (util > 100) health = 'Critical';
                            else if (util > 90) health = 'High Risk';
                            else if (util >= 80) health = 'At Risk';
                        }

                        return {
                            name: m.name,
                            cost: mCost,
                            profitPoint: mRevenue - mCost,
                            healthStatus: health
                        };
                    });

                    let pStr = `- Project: "${p.name}" (Official Analysis Data)\n`;
                    pStr += `  * Status Hist: Status: ${p.status} | Progress: ${p.progress}% | Risk: ${p.risk_level || 'low'} | Overdue: ${daysOverdue} days\n`;

                    if (!isProjectManager) {
                        pStr += `  * Profitability: [Current Revenue: ₹${contractValue.toLocaleString()}, Total Actual Cost: ₹${totalActualCost.toLocaleString()}, Net Profit: ₹${netProfit.toLocaleString()} (${margin.toFixed(1)}% Margin)]\n`;
                        pStr += `  * Deep Audit: [Labor: ₹${laborCost.toLocaleString()} (${totalHours.toFixed(1)}h), Expense: ₹${totalExpenseCost.toLocaleString()}, Non-Billable Lekage: ₹${nonBillableCost.toLocaleString()}, Delay Cost Leakage: ₹${delayCostImpact.toLocaleString()}]\n`;
                    }

                    if (phases.length > 0) {
                        pStr += `  * Phase-wise Performance: ${phases.map(ph => `[${ph.name}: Cost=₹${ph.cost.toLocaleString()}, P&L=₹${ph.profitPoint.toLocaleString()}, Health=${ph.healthStatus}]`).join(', ')}\n`;
                    }

                    contextStr += pStr;
                }
            } else {
                contextStr += "No projects found for analytics.\n";
            }

            // Aggregate User Performance (Using existing timesheets fetch)
            const userStats = {};
            timesheets.forEach(ts => {
                if (ts.status !== 'approved') return;
                const uName = ts.user_name || ts.user_email || 'Unknown';
                const hours = (ts.total_minutes || 0) / 60;
                const cost = ts.snapshot_total_cost || 0;
                const pName = ts.project_name || 'Unassigned';

                if (!userStats[uName]) userStats[uName] = { hours: 0, cost: 0, projects: new Set(), workTypes: {} };
                userStats[uName].hours += hours;
                userStats[uName].cost += cost;
                userStats[uName].projects.add(pName);
                userStats[uName].workTypes[ts.work_type] = (userStats[uName].workTypes[ts.work_type] || 0) + hours;
            });

            if (Object.keys(userStats).length > 0) {
                contextStr += `\n=== USER PERFORMANCE & COST (Official Data) ===\n`;
                Object.entries(userStats).forEach(([name, stats]) => {
                    const primaryWorkType = Object.entries(stats.workTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
                    contextStr += `- Name: ${name}: Total Logged: ${stats.hours.toFixed(1)}h | Projects: ${stats.projects.size} | Primary Focus: ${primaryWorkType}`;
                    if (!isProjectManager) {
                        contextStr += ` | Total Labor Cost: ₹${stats.cost.toLocaleString()}\n`;
                    } else {
                        contextStr += `\n`;
                    }
                });
            }

            // NEW: Project Workload & Activity Mapped with Timesheets
            const tasks = await Models.Task.find({ tenant_id }).sort({ due_date: 1 });
            contextStr += `\n=== PROJECT WORKLOAD & TASK PROGRESS (Timesheet Mapped) ===\n`;

            for (const p of projects.slice(0, 5)) { // Limit to top 5 projects for context size
                const projectTasks = tasks.filter(t => String(t.project_id) === String(p._id));
                if (projectTasks.length === 0) continue;

                contextStr += `- Project: "${p.name}" (Tasks mapped with timesheets):\n`;
                // Show top 5 most "active" or "pending" tasks
                projectTasks.slice(0, 8).forEach(t => {
                    const taskTimesheets = timesheets.filter(ts => String(ts.task_id) === String(t._id) && ts.status === 'approved');
                    const loggedHours = taskTimesheets.reduce((sum, ts) => sum + ((ts.total_minutes || 0) / 60), 0);
                    const estHours = t.estimated_hours || 0;
                    const burnRatio = estHours > 0 ? (loggedHours / estHours) * 100 : 0;

                    contextStr += `  * Task: "${t.title}" [Status: ${t.status}] | Logged: ${loggedHours.toFixed(1)}h / Est: ${estHours}h (${burnRatio.toFixed(0)}% burn)\n`;
                });
            }

            // NEW: Recent Activity Stream
            contextStr += `\n=== RECENT TEAM ACTIVITY (Timesheet Logs) ===\n`;
            const recentLogs = timesheets
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);

            if (recentLogs.length > 0) {
                contextStr += recentLogs.map(ts => `- [${ts.date}] ${ts.user_name || ts.user_email}: Spent ${(ts.total_minutes / 60).toFixed(1)}h on "${ts.task_title || 'Unknown Task'}" | Work Type: ${ts.work_type || 'General'}`).join('\n');
            }
        }
    } catch (e) {
        console.error("Error building context:", e);
    }

    return contextStr;
}

// 1. Get Available Models
router.get('/models', async (req, res) => {
    try {
        const models = await getGroqModels();
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

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: "Groq API key not configured" });
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

        // Fetch requesting user for personalization
        const requestingUser = await Models.User.findById(user_id);

        // Build context
        const deepContext = await buildContext(tenant_id, user_id, content, requestingUser);
        let contextBlock = "";
        if (context) contextBlock += `${context}\n`;
        if (deepContext) contextBlock += `${deepContext}\n`;

        // Get workspaces and projects for project/task creation
        const workspaces = await Models.Workspace.find({ tenant_id });
        const projects = await Models.Project.find({ tenant_id });
        const workspaceList = workspaces.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
        const projectList = projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

        // Get team members (names only - NO emails for privacy)
        const teamMembers = await Models.User.find({ tenant_id });

        // Build dynamic project details with matched Milestones, Stories, and Assignees
        const milestones = await Models.Milestone.find({ tenant_id });
        const stories = await Models.Story.find({ tenant_id });

        // Get rework alarms to identify frozen/blocked assignees
        const reworkAlarms = await Models.Notification.find({
            tenant_id,
            type: 'high_rework_alarm',
            status: 'OPEN'
        });
        const frozenEmails = reworkAlarms.map(alarm => alarm.recipient_email?.toLowerCase()).filter(Boolean);

        let projectDetailsText = "";
        projects.forEach((p, i) => {
            const pId = p._id.toString();
            const projMilestones = milestones.filter(m => m.project_id?.toString() === pId);
            const projStories = stories.filter(s => s.project_id?.toString() === pId);

            // Get ALL team members from project.team_members (not just ProjectUserRole)
            // This ensures frozen/blocked members are also shown
            // Need to look up full_name from Users collection using email
            let projAssignees = [];
            if (p.team_members && Array.isArray(p.team_members)) {
                projAssignees = p.team_members.map(member => {
                    const memberEmail = (member.email || '').toLowerCase();
                    const isFrozen = frozenEmails.includes(memberEmail);

                    // Look up user's full_name from teamMembers (Users collection)
                    const userFromCollection = teamMembers.find(u => u.email?.toLowerCase() === memberEmail);
                    const fullName = userFromCollection?.full_name || memberEmail.split('@')[0]; // Fallback to email prefix

                    return {
                        full_name: fullName,
                        email: memberEmail,
                        isFrozen: isFrozen
                    };
                });
            }

            projectDetailsText += `${i + 1}. Project: ${p.name}\n`;

            if (projMilestones.length > 0) {
                projectDetailsText += `   * Milestones: ${projMilestones.map((m, j) => `${j + 1}. ${m.name}`).join(', ')}\n`;
            } else {
                projectDetailsText += `   * Milestones: None\n`;
            }

            if (projStories.length > 0) {
                projectDetailsText += `   * Stories: ${projStories.map((s, j) => `${j + 1}. ${s.title}`).join(', ')}\n`;
            } else {
                projectDetailsText += `   * Stories: None\n`;
            }

            if (projAssignees.length > 0) {
                // Show all assignees including frozen ones, with status indicator
                const assigneeList = projAssignees.map((a, j) => {
                    const status = a.isFrozen ? ` (FROZEN - Cannot be assigned)` : '';
                    return `${j + 1}. ${a.full_name}${status}`;
                }).join(', ');
                projectDetailsText += `   * Available Assignees: ${assigneeList}\n`;
            } else {
                projectDetailsText += `   * Available Assignees: None (No team members assigned to this project)\n`;
            }
        });

        // Build system prompt for project/task creation
        const systemPrompt = `You are Groona, a friendly and intelligent Project Management Assistant powered by Groq.

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

STRICT PERSONALITY RULES:
1. GREETING: If you have already greeted the user in this conversation, do not repeat "Hi [Name]" in Every single message. Be natural. If it's a new topic, just start with the answer.
2. DIRECTNESS: Go straight to the point. Do not use filler phrases like "Based on the data" or "Here is what I found".
3. CURRENCY: ALWAYS display every price, cost, or revenue using the Rupee symbol (₹) regardless of the currency code. For example, instead of "500 USD" or "$500", write "₹500". 
4. ADDRESSING: Address the user as "you" or "your" (e.g., "Your project is at risk", "You have tasks due").

CORE INSTRUCTIONS:

1. PROJECT CREATION:
If the user wants to "Create a Project", you MUST gather EVERY required field below. Do not skip any.
- **Project Name** (REQUIRED)
- **Workspace** (REQUIRED - User MUST select from numbered list below)
- **Deadline** (REQUIRED - Date)
- **Description** (REQUIRED - Ask for a brief summary)
- **Financial Tracking** (REQUIRED - Ask "Do you want to enable financial tracking for this project?")

IF FINANCIAL TRACKING IS "YES", you MUST also gather:
- **Billing Model** (REQUIRED - User MUST select from numbered list below)
- **Currency** (REQUIRED - User MUST select from numbered list below)
- **Depending on Billing Model**, ask for:
    *   **Time & Materials**: **Estimated Duration (hours)** (REQUIRED) and **Bill Rate** (Optional).
    *   **Fixed Price**: **Contract Amount** (REQUIRED), **Start Date** (REQUIRED), and **End Date** (REQUIRED).
    *   **Retainer**: **Retainer Amount** (REQUIRED), **Period** (Monthly/Quarterly/Yearly), **Start Date** (REQUIRED), and **End Date** (REQUIRED).
    *   **Non-Billable**: **Reason** (REQUIRED).

AVAILABLE WORKSPACES (Selection via Number):
${workspaceList || "No workspaces found. User needs to create one first."}

BILLING MODELS:
1. Time & Materials
2. Fixed Price
3. Retainer
4. Non-Billable

CURRENCIES:
1. INR (₹)
2. USD ($)
3. EUR (€)
4. GBP (£)
5. AUD (A$)
6. CAD (C$)
7. SGD (S$)
8. AED (dh)

BEHAVIOR:
- For **Workspace**, **Billing Model**, and **Currency**, always use numbered lists.
- Tell the user: "You can select by typing the number or the name."
- Map any chosen number back to the correct machine name:
    *   Billing Models: 1 -> "time_and_materials", 2 -> "fixed_price", 3 -> "retainer", 4 -> "non_billable". (Lowercase with underscores).
    *   Currencies: 1 -> "INR", 2 -> "USD", 3 -> "EUR", 4 -> "GBP", 5 -> "AUD", 6 -> "CAD", 7 -> "SGD", 8 -> "AED".
- If ALL required info (including financial fields if enabled) is present, respond with JSON: {"action": "create_project", "project_name": "[name]", "workspace_name": "[name]", "deadline": "[date]", "description": "[desc]", "financial_tracking": true, "billing_model": "[model]", "currency": "[code]", ...otherFields}
- Ensure 'contract_amount', 'estimated_duration', 'retainer_amount', 'default_bill_rate_per_hour' are sent as raw numbers in the JSON.
- If financial tracking is NO, set "financial_tracking": false.
- Do not create until every relevant field is provided.

2. TASK CREATION:
If the user wants to "Create a Task", you MUST gather EVERY required field step-by-step.
First, ask the user to select a **Project** from the list.
ONCE the user selects a project, you MUST refer to AVAILABLE PROJECTS & THEIR DETAILS to show them ONLY the options under that specific project.
Then gather the remaining fields:
- **Task Title** (REQUIRED)
- **Priority** (REQUIRED - Display numbered options: 1. Low, 2. Medium, 3. High, 4. Urgent)
- **Project Milestone** (REQUIRED - You MUST show ONLY the milestones listed under their chosen project.)
- **Story** (REQUIRED - You MUST show ONLY the stories listed under their chosen project.)
- **Story Points** (REQUIRED - Numbers only)
- **Assignee(s)** (REQUIRED - You MUST show ONLY the assignees listed under their chosen project. You CAN select MULTIPLE assignees by providing their numbers/names separated by comma, e.g., "1,3" or "John, Jane". Frozen members are shown with "(FROZEN - Cannot be assigned)" indicator - proceed with assignment if user still wants to assign them.)
- **Due Date** (REQUIRED - MUST be strictly in YYYY-MM-DD format)

AVAILABLE PROJECTS & THEIR DETAILS:
${projectDetailsText || "No projects found."}

BEHAVIOR:
- **CRITICAL**: If the user's chosen project has "Stories: None", you MUST STOP the task creation process immediately and reply exactly with: "Story for this project is not created, so task cannot be created." Do NOT ask for any more details.
- For **Project Milestone**, **Story**, **Assignee(s)**, and **Priority**, always display the numbered lists for them to pick from.
- Instruct the user: "Please select by typing the number or the name."
- If the user provides a number, you must internally map it to the correct string name or value (e.g., Priority '1' -> 'low').
- If the user selects multiple assignees (e.g., "1,3" or "John, Jane"), include them as an array: "assignee_names": ["John", "Jane"]
- If ALL required fields are collected, respond with JSON: {"action": "create_task", "title": "[title]", "project_name": "[project]", "priority": "[priority]", "milestone_name": "[milestone]", "story_name": "[story]", "story_points": [number], "assignee_names": ["name1", "name2"], "due_date": "[date]"}
- Be very strict: ask for fields specifically.

3. PROJECT STATUS & PROGRESS ANALYSIS:
If the user asks for "Project Status", "Analysis", "What's going on", or "Task Progress":
- ACT AS: A **High-Level Project Manager**.
- DATA SOURCE: Use **PROJECT WORKLOAD & TASK PROGRESS (Timesheet Mapped)** and **RECENT TEAM ACTIVITY**.
- FOCUS: 
  * Compare **Logged Hours** vs **Estimated Hours** for key tasks.
  * Identify tasks with high **"Burn Ratio"** (Logged > Est).
  * Summarize **Recent Team Activity**: Who did what and when, based on the activity stream.
  * Report on **Task Status** distribution (Todo vs Ongoing vs Completed).

4. PROJECT REVENUE & PROFITABILITY ANALYSIS:
If the user asks for "Revenue Analysis", "Profitability", or "Financial Health":
- ACT AS: A **Senior Financial Analyst**.
- DATA SOURCE: Use the **PROJECT ANALYTICS & FINANCIAL PROFITABILITY (Official Data)** section.
- METRICS: Budget realization, net profit, margin, and delay cost impacts.

5. USER PERFORMANCE ANALYSIS:
If the user asks about "User Performance", "Workload", or "Daily Activity":
- Use the **USER PERFORMANCE & COST (Official Data)** section.
- Highlight metrics if available (like total logs, most active member).

CRITICAL PRIVACY RULES:
- NEVER display, mention, or reveal any email addresses in your responses
- NEVER show email IDs in chat - this is a strict privacy requirement
- Only use team member names (full names) when referring to assignees
- If user provides an email address, convert it to the team member's name if they exist

ASSIGNEE VALIDATION:
- When user provides an assignee, you MUST verify it matches a team member from the available list
- If the name doesn't match any team member, respond with: "The name you entered is not a team member, or you entered the wrong name. Please provide the correct team member name."
- Use "assignee_names" field (NOT assignee_email) in the JSON response as an array of names, e.g., "assignee_names": ["John Doe", "Jane Smith"]
- Only use team member FULL NAMES (as shown in Available Assignees list), NOT email addresses
- IMPORTANT: When the user selects an assignee by number or name, always use their FULL NAME from the available list, never their email address

GENERAL BEHAVIOR:
- For analysis requests, provide a structured but conversational summary.
- Use **bold** for metrics (e.g., **85% progress**, **$5,000 revenue**, **Overdue**).
- If ALL required information for creation is present, respond with JSON actions as defined above.
- For all other queries, respond naturally and helpfully. Keep responses concise but friendly. NEVER display email addresses.`;

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

        // Call Groq API
        const selectedModel = model || 'llama-3.3-70b-versatile';

        // STRICT VALIDATION: Ensure the selected model is whitelisted
        const availableModels = await getGroqModels();
        const isModelValid = availableModels.some(m => m.id === selectedModel);

        if (!isModelValid) {
            console.error(`[Groona Assistant] Attempted to use non-whitelisted model: ${selectedModel}`);
            return res.status(400).json({
                error: `Model "${selectedModel}" is not in the whitelist. Please select a valid model.`
            });
        }

        const groqResponse = await axios.post(
            `${GROQ_API_URL}/chat/completions`,
            {
                model: selectedModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048
            },
            {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        let assistantMessage = groqResponse.data.choices[0]?.message?.content || 'No response generated';

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
            usage: groqResponse.data.usage,
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
    const {
        project_name, workspace_name, deadline, description,
        financial_tracking, billing_model, currency,
        contract_amount, contract_start_date, contract_end_date,
        estimated_duration, default_bill_rate_per_hour,
        retainer_amount, retainer_period, non_billable_reason,
        expense_budget,
        tenant_id, user_id, user_email
    } = req.body;

    if (!project_name || !workspace_name || !deadline || !description || !tenant_id || !user_id || !user_email) {
        return res.status(400).json({ error: 'Missing required fields for project creation' });
    }

    try {
        const projectInfo = {
            name: project_name,
            description: description || `Project created via Groona Assistant: ${project_name}`,
            deadline: deadline || undefined,
            workspace_name: workspace_name,
            // Billing fields
            billing_model: financial_tracking ? billing_model : 'time_and_materials',
            currency: currency || 'INR',
            contract_amount: Number(contract_amount) || 0,
            contract_start_date: contract_start_date || undefined,
            contract_end_date: contract_end_date || undefined,
            estimated_duration: Number(estimated_duration) || 0,
            default_bill_rate_per_hour: Number(default_bill_rate_per_hour) || 0,
            retainer_amount: Number(retainer_amount) || 0,
            retainer_period: retainer_period || 'month',
            non_billable_reason: non_billable_reason || undefined,
            expense_budget: Number(expense_budget) || 0
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
    const { title, project_name, sprint_name, milestone_name, story_name, story_points, priority, assignee_name, assignee_names, assignee_email, assignee_emails, due_date, estimated_hours, description, tenant_id, user_id, user_email } = req.body;

    if (!title || !project_name || !due_date || !tenant_id || !user_id || !user_email) {
        return res.status(400).json({ error: 'Missing required fields for task creation' });
    }

    // Support both single assignee (assignee_name) and multiple assignees (assignee_names array)
    const assigneeList = assignee_names || (assignee_name ? [assignee_name] : []);
    const assigneeEmailList = assignee_emails || (assignee_email ? [assignee_email] : []);

    if (assigneeList.length === 0 && assigneeEmailList.length === 0) {
        return res.status(400).json({ error: 'At least one assignee is required for task creation' });
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

        // STRICT: Validate assignee(s) if provided
        const teamMembers = await Models.User.find({ tenant_id });
        console.log('[create-task] Assignee list:', assigneeList);
        console.log('[create-task] Team members count:', teamMembers.length);

        // Validate assignee names - also check if it's an email address
        if (assigneeList.length > 0) {
            for (const assigneeName of assigneeList) {
                const normalizedInput = assigneeName.toLowerCase().trim();

                // Check if it's a valid email address format
                const isEmailFormat = normalizedInput.includes('@') && normalizedInput.includes('.');

                let isValidMember = false;

                // Try to find the user
                if (isEmailFormat) {
                    // It's an email - check if it belongs to a team member
                    console.log('[create-task] Checking email:', normalizedInput);
                    const member = teamMembers.find(u => {
                        const userEmail = u.email?.toLowerCase();
                        console.log('[create-task] Comparing with user email:', userEmail);
                        return userEmail === normalizedInput;
                    });
                    console.log('[create-task] Found member by email:', member);
                    if (member) {
                        isValidMember = true;
                    }
                } else {
                    // It's a name - check if it matches any team member's name
                    isValidMember = teamMembers.some(u => {
                        const fullName = u.full_name?.toLowerCase().trim();
                        return fullName === normalizedInput ||
                            fullName?.includes(normalizedInput) ||
                            normalizedInput.includes(fullName);
                    });
                }

                // If not found by primary method, try the other method as fallback
                if (!isValidMember) {
                    if (isEmailFormat) {
                        // Try as name as fallback
                        isValidMember = teamMembers.some(u => {
                            const fullName = u.full_name?.toLowerCase().trim();
                            return fullName === normalizedInput ||
                                fullName?.includes(normalizedInput) ||
                                normalizedInput.includes(fullName);
                        });
                    } else {
                        // Try as email as fallback
                        isValidMember = teamMembers.some(u => u.email?.toLowerCase() === normalizedInput);
                    }
                }

                if (!isValidMember) {
                    return res.status(400).json({
                        error: `The name "${assigneeName}" is not a team member, or you entered the wrong name. Please provide the correct team member name.`
                    });
                }
            }
        }

        // Validate assignee emails if provided
        if (assigneeEmailList.length > 0) {
            for (const email of assigneeEmailList) {
                const isValidMember = teamMembers.some(u => u.email.toLowerCase() === email.toLowerCase());

                if (!isValidMember) {
                    return res.status(400).json({
                        error: `The email "${email}" does not belong to a team member. Please provide a valid team member name instead.`
                    });
                }
            }
        }

        // Convert assignee names to emails for storage
        let finalAssigneeEmails = [];

        // Add validated name-based assignees (including those that might be email addresses)
        for (const name of assigneeList) {
            const normalizedInput = name.toLowerCase().trim();

            // Check if it's an email format
            const isEmailFormat = normalizedInput.includes('@') && normalizedInput.includes('.');

            let member = null;

            if (isEmailFormat) {
                // It's an email - find by email
                member = teamMembers.find(u => u.email?.toLowerCase() === normalizedInput);
            } else {
                // It's a name - find by name match
                member = teamMembers.find(u => {
                    const fullName = u.full_name?.toLowerCase().trim();
                    return fullName === normalizedInput ||
                        fullName?.includes(normalizedInput) ||
                        normalizedInput.includes(fullName);
                });
            }

            if (member && member.email && !finalAssigneeEmails.includes(member.email)) {
                finalAssigneeEmails.push(member.email);
            }
        }

        // Add validated email-based assignees
        for (const email of assigneeEmailList) {
            const member = teamMembers.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (member && member.email && !finalAssigneeEmails.includes(member.email)) {
                finalAssigneeEmails.push(member.email);
            }
        }

        const taskInfo = {
            title: title,
            description: description || `Task created via Groona Assistant: ${title}`,
            project_name: project_name,
            sprint_name: sprint_name,
            milestone_name: milestone_name,
            story_name: story_name,
            story_points: story_points,
            priority: priority,
            assignee_names: finalAssigneeEmails, // Store as array of emails
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
