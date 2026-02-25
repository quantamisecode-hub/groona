const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');

// --- CONFIGURATION ---
// USES THE NEW SPECIFIC API KEY
const API_KEY = process.env.GEMINI_API_KEY_2; 
const DEFAULT_MODEL = "gemini-2.5-flash";

// --- FALLBACK CHAIN ---
// Only allowed models: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-robotics-er-1.5-preview,
// gemma-3-12b, gemma-3-1b, gemma-3-27b, gemma-3-4b, gemini-2.5-flash-tts, gemini-3-flash,
// gemma-3-2b, gemini-embedding-1.0, gemini-2.5-flash-native-audio-dialog
const FALLBACK_CHAIN = {
    "gemini-2.5-flash": "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite": "gemini-3-flash",
    "gemini-3-flash": "gemma-3-12b",
    "gemini-2.5-flash-native-audio-dialog": "gemini-2.5-flash",
    "gemini-2.5-flash-tts": "gemini-2.5-flash",
};

// --- HELPER: FILE PROCESSING ---
function findFileLocally(filename) { 
    const cleanName = path.basename(filename); 
    const possiblePaths = [path.join(__dirname, '..', 'uploads', cleanName), path.join(process.cwd(), 'uploads', cleanName), path.join(process.cwd(), 'public', 'uploads', cleanName), path.join(__dirname, 'uploads', cleanName)]; 
    for (const p of possiblePaths) { if (fs.existsSync(p)) return p; } 
    return null; 
}

function getFileHandler(filePath) { 
    const ext = path.extname(filePath).toLowerCase(); 
    const mediaTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' }; 
    const textTypes = ['.txt', '.md', '.csv', '.json', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.env']; 
    if (mediaTypes[ext]) return { type: 'media', mimeType: mediaTypes[ext] }; 
    if (textTypes.includes(ext)) return { type: 'text' }; 
    return { type: 'unsupported' }; 
}

async function processFilesForGemini(fileUrls, req) { 
    const parts = []; 
    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0) return parts; 
    
    for (const url of fileUrls) { 
        try { 
            const cleanUrl = decodeURIComponent(url); 
            const filename = cleanUrl.split('/').pop(); 
            const handler = getFileHandler(filename); 
            if (handler.type === 'unsupported') continue; 
            
            let processed = false; 
            const localPath = findFileLocally(filename); 
            
            if (localPath) { 
                try { 
                    if (handler.type === 'text') { 
                        const textContent = fs.readFileSync(localPath, 'utf8'); 
                        parts.push({ text: `\n\n--- FILE START: ${filename} ---\n${textContent}\n--- FILE END ---\n` }); 
                        processed = true; 
                    } else if (handler.type === 'media') { 
                        const fileBuffer = fs.readFileSync(localPath); 
                        parts.push({ inlineData: { data: fileBuffer.toString('base64'), mimeType: handler.mimeType } }); 
                        processed = true; 
                    } 
                } catch (e) { console.error("Local file read error:", e); } 
            } 
            
            if (!processed) { 
                let downloadUrl = url; 
                if (url.startsWith('/')) { 
                    const protocol = req.protocol || 'http'; 
                    const host = req.get('host'); 
                    downloadUrl = `${protocol}://${host}${url}`; 
                } 
                const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' }); 
                if (handler.type === 'text') { 
                    parts.push({ text: `\n\n--- FILE START: ${filename} ---\n${Buffer.from(response.data).toString('utf8')}\n--- FILE END ---\n` }); 
                } else { 
                    parts.push({ inlineData: { data: Buffer.from(response.data).toString('base64'), mimeType: response.headers['content-type'] || handler.mimeType } }); 
                } 
            } 
        } catch (fileError) { console.error("Attachment Error:", fileError.message); } 
    } 
    return parts; 
}

// ==========================================
// 1. WEBSOCKET WRAPPER (Live API)
// ==========================================
async function generateViaSocket(apiKey, model, fullPrompt) {
    return new Promise((resolve, reject) => {
        const host = "generativelanguage.googleapis.com";
        let cleanModel = model.startsWith('models/') ? model : `models/${model}`;
        const url = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        
        const ws = new WebSocket(url);
        let responseText = "";
        let hasResolved = false;

        const timeout = setTimeout(() => {
            if (!hasResolved) { ws.terminate(); reject(new Error("Live API Timeout")); }
        }, 30000);

        ws.on('open', () => {
            ws.send(JSON.stringify({ setup: { model: cleanModel, generation_config: { response_modalities: ["TEXT"] } } }));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.setupComplete) {
                    ws.send(JSON.stringify({ client_content: { turns: [{ role: "user", parts: [{ text: fullPrompt }] }], turn_complete: true } }));
                    return;
                }
                if (msg.serverContent?.modelTurn?.parts) {
                    for (const part of msg.serverContent.modelTurn.parts) { if (part.text) responseText += part.text; }
                }
                if (msg.serverContent?.turnComplete) {
                    hasResolved = true; clearTimeout(timeout); ws.close(); 
                    resolve({ text: responseText, usedModel: cleanModel });
                }
            } catch (e) { console.error("Socket Parse Error:", e); }
        });
        
        ws.on('error', (err) => { if (!hasResolved) reject(err); });
        ws.on('close', () => { if (!hasResolved && responseText) resolve({ text: responseText, usedModel: cleanModel }); });
    });
}

// ==========================================
// 2. RETRY LOGIC (Standard HTTP Models)
// ==========================================
async function generateStandardWithRetry(genAI, params, modelName) {
    let cleanName = modelName.replace('models/', '');
    const model = genAI.getGenerativeModel({ 
        model: cleanName, 
        systemInstruction: params.systemInstruction,
        generationConfig: params.generationConfig 
    });

    const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];

    if (params.history) {
        const chat = model.startChat({ history: params.history, safetySettings });
        return { text: (await chat.sendMessage(params.content)).response.text(), model: cleanName };
    } else {
        const result = await model.generateContent({ contents: [{ role: 'user', parts: Array.isArray(params.content) ? params.content : [{ text: params.content }] }], safetySettings });
        return { text: result.response.text(), model: cleanName };
    }
}

async function generateController(genAI, params, requestedModel, retryCount = 0) {
    let targetModel = requestedModel || DEFAULT_MODEL;
    const isLiveModel = targetModel.includes("live");

    try {
        if (isLiveModel) {
            let fullPrompt = "";
            if (params.systemInstruction?.parts?.[0]?.text) fullPrompt += `SYSTEM: ${params.systemInstruction.parts[0].text}\n`;
            if (params.history) params.history.forEach(h => fullPrompt += `${h.role}: ${h.parts[0].text}\n`);
            let currentText = Array.isArray(params.content) ? params.content.map(p => p.text).join('\n') : params.content;
            fullPrompt += `User: ${currentText}`;
            return await generateViaSocket(API_KEY, targetModel, fullPrompt);
        } else {
            return await generateStandardWithRetry(genAI, params, targetModel);
        }
    } catch (error) {
        if (FALLBACK_CHAIN[targetModel] && retryCount < 3) {
            return await generateController(genAI, params, FALLBACK_CHAIN[targetModel], retryCount + 1);
        }
        throw error;
    }
}

async function buildDeepContext(tenant_id, user_id, content) {
    let contextStr = "";
    if (!content) return contextStr;
    const lowerQ = content.toLowerCase();
    
    // CHANGED: Always fetch workspaces and users so the AI knows them in every turn
    // (This fixes the issue where responding "Marketing" failed because AI forgot the list)
    try {
        const workspaces = await Models.Workspace.find({ tenant_id });
        const users = await Models.User.find({ tenant_id });
        
        contextStr += `\n=== AVAILABLE WORKSPACES ===\n`;
        if (workspaces.length > 0) {
            contextStr += workspaces.map(w => `- Name: "${w.name}" (ID: ${w._id})`).join('\n');
        } else {
            contextStr += "No workspaces found. (User needs to create one first)\n";
        }
        
        contextStr += `\n=== AVAILABLE TEAM MEMBERS ===\n`;
        contextStr += users.map(u => `- Name: ${u.full_name}, Email: ${u.email}`).join('\n');
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

// --- ROUTES ---

// 1. Get Conversations
router.get('/conversations', async (req, res) => { 
    const { user_id, tenant_id } = req.query; 
    try { 
        const conversations = await Models.Conversation.find({ user_id, tenant_id, is_active: true }).sort({ updated_date: -1 }).limit(20); 
        res.json(conversations); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

// 2. Create Conversation
router.post('/conversations', async (req, res) => { 
    try { 
        const convo = new Models.Conversation({ ...req.body, messages: [] }); 
        await convo.save(); 
        res.json(convo); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

// 3. Usage Stats
router.get('/usage/stats', async (req, res) => { 
    const { user_id, tenant_id } = req.query; 
    try { 
        const usage = await Models.TokenUsage.aggregate([{ $match: { user_id, tenant_id } }, { $group: { _id: null, total_tokens: { $sum: "$total_tokens" } } }]); 
        res.json(usage[0] || { total_tokens: 0 }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

// 4. MAIN CHAT ROUTE (With "Create Project" Prompt Logic)
router.post('/chat', async (req, res) => {
    const { conversation_id, content, file_urls, context, model, user_id, tenant_id } = req.body;
    
    if (!API_KEY) return res.status(500).json({ error: "AI Assistant (Key 2) Not Configured" });

    try {
        const conversation = await Models.Conversation.findById(conversation_id);
        if (!conversation) return res.status(404).json({ error: "Conversation not found" });

        const userMsg = { role: 'user', content: content, file_urls, created_at: new Date() };
        conversation.messages.push(userMsg);
        conversation.updated_date = new Date(); 
        await conversation.save();

        const genAI = new GoogleGenerativeAI(API_KEY);
        
        const deepContext = await buildDeepContext(tenant_id, user_id, content);
        const fileParts = await processFilesForGemini(file_urls, req);
        
        let contextBlock = "";
        if (context) contextBlock += `${context}\n`;
        if (deepContext) contextBlock += `${deepContext}\n`;

        const finalParts = [
            ...fileParts, 
            { text: contextBlock ? `SYSTEM DATA:\n${contextBlock}\n\nUSER QUERY: ${content}` : content }
        ];

        // --- SPECIFIC PROMPT LOGIC FOR PROJECT CREATION ---
        const systemPrompt = `You are Aivora, a professional Project Management Assistant.
        
        CORE INSTRUCTION:
        If the user wants to "Create a Project", you MUST follow this strict interview process. Do NOT create the project immediately. Gather these 4 pieces of information if missing:
        
        1. Project Name
        2. Workspace (User MUST select from 'AVAILABLE WORKSPACES'. If they type a name loosely matching one, accept it.)
        3. Deadline (Date)
        4. Team Members to Invite (Optional)
        
        BEHAVIOR:
        - Check if the user's message contains the required info.
        - If 'Project Name' is missing, ask: "I can help with that. What is the name of the project?"
        - If 'Workspace' is missing, ask: "Which workspace should this project belong to?" (You can list the Available Workspaces).
        - If the user provides a workspace name like "Marketing" and it matches "Marketing Team" or similar in the list, accept it.
        - Only when ALL 4 are gathered (or skipped for optional), produce a final summary confirmation.
        
        For all other queries, answer normally, concisely, and professionally.`;

        const systemInstruction = { parts: [{ text: systemPrompt }] };

        // --- CRITICAL FIX: EXCLUDE CURRENT MESSAGE FROM HISTORY ---
        // We exclude the last message (slice(0, -1)) because we are passing it explicitly in 'finalParts'.
        // This prevents the "MarketingMarketing" duplication error.
        const historyForAI = conversation.messages.slice(0, -1).slice(-6).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || (m.file_urls?.length ? "File" : "") }]
        }));

        const result = await generateController(genAI, {
            content: finalParts,
            history: historyForAI,
            systemInstruction: systemInstruction
        }, model);

        conversation.messages.push({ role: 'assistant', content: result.text, created_at: new Date() });
        await conversation.save();

        // Track usage (optional)
        if (result.usage?.totalTokenCount > 0) {
            await Models.TokenUsage.create({
                tenant_id, user_id, model: result.model,
                total_tokens: result.usage.totalTokenCount,
                created_date: new Date()
            });
        }

        res.json({ message: result.text, usage: result.usage, model: result.model });

    } catch (err) {
        console.error("AI Assistant Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;