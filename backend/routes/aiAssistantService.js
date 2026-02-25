const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');
const aiProjectService = require('../services/aiProjectService');
const aiTaskService = require('../services/aiTaskService');
const modelHelper = require('../helpers/geminiModelHelper');

// --- CONFIGURATION ---
// USES THE SPECIFIC API KEY FOR AI ASSISTANT
const API_KEY = process.env.GEMINI_API_KEY_2; 
// Use helper to get default model (gemini-2.5-flash-native-audio-dialog)
const DEFAULT_MODEL = modelHelper.getDefaultModel();

// --- HELPER: FILE PROCESSING ---
function findFileLocally(filename) { 
    const cleanName = path.basename(filename); 
    const possiblePaths = [
        path.join(__dirname, '..', 'uploads', cleanName), 
        path.join(process.cwd(), 'uploads', cleanName), 
        path.join(process.cwd(), 'public', 'uploads', cleanName), 
        path.join(__dirname, 'uploads', cleanName)
    ]; 
    for (const p of possiblePaths) { 
        if (fs.existsSync(p)) return p; 
    } 
    return null; 
}

function getFileHandler(filePath) { 
    const ext = path.extname(filePath).toLowerCase(); 
    const mediaTypes = { 
        '.jpg': 'image/jpeg', 
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png', 
        '.webp': 'image/webp', 
        '.pdf': 'application/pdf' 
    }; 
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
                } catch (e) { 
                    console.error("Local file read error:", e); 
                } 
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
        } catch (fileError) { 
            console.error("Attachment Error:", fileError.message); 
        } 
    } 
    return parts; 
}

// ==========================================
// WEBSOCKET WRAPPER (Live API)
// ==========================================
async function generateViaSocket(apiKey, model, fullPrompt) {
    if (!apiKey) {
        throw new Error("Live API key is not configured. Please set GEMINI_API_KEY_2.");
    }
    
    const host = "generativelanguage.googleapis.com";
    let cleanModel = model.startsWith('models/') ? model.replace('models/', '') : model;
    
    // Try multiple WebSocket endpoint formats
    // Different models might use different endpoint formats
    const endpointFormats = [
        // Standard format
        { version: 'v1beta', format: 'BidiGenerateContent' },
        { version: 'v1alpha', format: 'BidiGenerateContent' },
        // Alternative formats (some models might use different service names)
        { version: 'v1beta', format: 'GenerateContent' },
        { version: 'v1alpha', format: 'GenerateContent' },
    ];
    
    let lastError = null;
    
    for (const { version, format } of endpointFormats) {
        const url = `wss://${host}/ws/google.ai.generativelanguage.${version}.GenerativeService/${format}?key=${apiKey}`;
        console.log(`[Live API] Trying ${version}/${format} WebSocket endpoint for model: ${cleanModel}`);
        
        try {
            return await attemptWebSocketConnection(url, apiKey, cleanModel, fullPrompt);
        } catch (error) {
            lastError = error;
            const is404 = error.message?.includes('404') || error.message?.includes('Unexpected server response: 404');
            if (is404) {
                console.warn(`[Live API] ${version}/${format} returned 404 - endpoint may not exist for this model`);
            } else {
                console.warn(`[Live API] ${version}/${format} failed: ${error.message}`);
            }
            // Continue to next endpoint format
        }
    }
    
    // If all WebSocket endpoints failed, try REST API as last resort for live models
    console.warn('[Live API] All WebSocket endpoints failed, attempting REST API fallback...');
    try {
        const axios = require('axios');
        const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
        
        const contents = [{ parts: [{ text: fullPrompt }] }];
        const payload = {
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40
            }
        };
        
        const response = await axios.post(restUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });
        
        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
            console.log('[Live API] REST API fallback succeeded!');
            return { text, usedModel: `models/${cleanModel}` };
        }
    } catch (restError) {
        console.error('[Live API] REST API fallback also failed:', restError.message);
    }
    
    // If all methods failed, throw last error
    throw lastError || new Error('All WebSocket API endpoints and REST fallback failed');
}

// Helper function to attempt WebSocket connection
async function attemptWebSocketConnection(url, apiKey, cleanModel, fullPrompt) {
    return new Promise((resolve, reject) => {
        
        console.log('[Live API] Connecting to model:', cleanModel);
        console.log('[Live API] WebSocket URL (key hidden):', url.replace(apiKey, 'API_KEY_HIDDEN'));
        console.log('[Live API] API Key present:', !!apiKey, 'Length:', apiKey?.length || 0);
        const ws = new WebSocket(url);
        let responseText = "";
        let hasResolved = false;

        const timeout = setTimeout(() => {
            if (!hasResolved) { 
                ws.terminate(); 
                reject(new Error("Live API Timeout after 60 seconds")); 
            }
        }, 60000); // Increased timeout for longer responses

        ws.on('open', () => {
            console.log('[Live API] WebSocket connected successfully, sending setup for model:', cleanModel);
            // Ensure model name is correct format (with models/ prefix for setup)
            const modelForSetup = cleanModel.startsWith('models/') ? cleanModel : `models/${cleanModel}`;
            const setupMessage = { 
                setup: { 
                    model: modelForSetup, 
                    generation_config: { 
                        response_modalities: ["TEXT"],
                        temperature: 0.7,
                        top_p: 0.95,
                        top_k: 40
                    } 
                } 
            };
            console.log('[Live API] Sending setup message with model:', modelForSetup);
            console.log('[Live API] Setup message:', JSON.stringify(setupMessage, null, 2));
            ws.send(JSON.stringify(setupMessage));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                console.log('[Live API] Received message type:', Object.keys(msg)[0] || 'unknown');
                
                // Handle setup completion
                if (msg.setupComplete) {
                    console.log('[Live API] Setup complete, sending prompt (length:', fullPrompt.length, 'chars)...');
                    ws.send(JSON.stringify({ 
                        client_content: { 
                            turns: [{ 
                                role: "user", 
                                parts: [{ text: fullPrompt }] 
                            }], 
                            turn_complete: true 
                        } 
                    }));
                    return;
                }
                
                // Handle error messages from server
                if (msg.error) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    ws.close();
                    console.error('[Live API] Server error:', msg.error);
                    reject(new Error(`Live API server error: ${JSON.stringify(msg.error)}`));
                    return;
                }
                
                // Handle model response parts
                if (msg.serverContent?.modelTurn?.parts) {
                    for (const part of msg.serverContent.modelTurn.parts) { 
                        if (part.text) {
                            responseText += part.text;
                            // Log streaming progress (optional, can be removed for production)
                            if (responseText.length % 100 === 0) {
                                console.log('[Live API] Streaming...', responseText.length, 'chars');
                            }
                        }
                    }
                }
                
                // Handle turn completion
                if (msg.serverContent?.turnComplete) {
                    hasResolved = true; 
                    clearTimeout(timeout); 
                    ws.close(); 
                    console.log('[Live API] Response complete, total length:', responseText.length);
                    if (!responseText || responseText.trim() === '') {
                        console.warn('[Live API] Warning: Empty response received');
                    }
                    resolve({ text: responseText || 'No response generated', usedModel: `models/${cleanModel}` });
                }
                
                // Handle error messages from server
                if (msg.error) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    ws.close();
                    console.error('[Live API] Server error:', msg.error);
                    reject(new Error(`Live API server error: ${JSON.stringify(msg.error)}`));
                }
            } catch (e) { 
                console.error("[Live API] Socket Parse Error:", e);
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    reject(new Error(`Live API parse error: ${e.message}`));
                }
            }
        });
        
        ws.on('error', (err) => {
            console.error('[Live API] WebSocket error:', err);
            if (!hasResolved) {
                hasResolved = true;
                clearTimeout(timeout);
                reject(new Error(`Live API connection error: ${err.message || err}`));
            }
        });
        
        ws.on('close', (code, reason) => {
            console.log('[Live API] WebSocket closed:', code, reason?.toString());
            if (!hasResolved && responseText) {
                hasResolved = true;
                clearTimeout(timeout);
                resolve({ text: responseText, usedModel: cleanModel });
            } else if (!hasResolved && code !== 1000) {
                hasResolved = true;
                clearTimeout(timeout);
                reject(new Error(`Live API connection closed unexpectedly: ${code} ${reason?.toString() || ''}`));
            }
        });
    });
}

// ==========================================
// RETRY LOGIC (Standard HTTP Models)
// ==========================================
/**
 * Robust helper function specifically for gemini-embedding-1.0
 * Tries multiple approaches to use the embedding model for text generation
 */
async function generateWithEmbeddingModel(genAI, params, apiKey) {
    const modelName = 'gemini-embedding-1.0';
    const axios = require('axios');
    
    console.log('[AI Assistant] Using gemini-embedding-1.0 with robust helper function');
    
    // Prepare content
    const contents = Array.isArray(params.content) 
        ? params.content.map(p => ({ parts: [{ text: p.text || p }] }))
        : [{ parts: [{ text: params.content }] }];
    
    // Build payload
    const payload = {
        contents: contents,
        generationConfig: params.generationConfig || {},
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    };
    
    // Add system instruction if present
    if (params.systemInstruction?.parts) {
        payload.systemInstruction = {
            parts: params.systemInstruction.parts
        };
    }
    
    // Add history if present
    if (params.history && params.history.length > 0) {
        payload.contents = params.history.map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: h.parts || [{ text: '' }]
        })).concat(contents);
    }
    
    // Try multiple API endpoints and model name variations
    const apiVersions = ['v1beta', 'v1', 'v1alpha'];
    const modelVariations = [
        'gemini-embedding-1.0',
        'models/gemini-embedding-1.0',
        'embedding-001', // Alternative name
        'text-embedding-004' // Another possible variation
    ];
    
    let lastError = null;
    
    for (const apiVersion of apiVersions) {
        for (const modelVariation of modelVariations) {
            const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelVariation.replace('models/', '')}:generateContent?key=${apiKey}`;
            
            try {
                console.log(`[AI Assistant] Trying ${apiVersion}/${modelVariation} for embedding model`);
                
                const response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                });
                
                if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const text = response.data.candidates[0].content.parts[0].text;
                    console.log(`[AI Assistant] ✅ Successfully used ${modelVariation} via ${apiVersion}`);
                    return { text, model: modelName };
                }
            } catch (error) {
                lastError = error;
                // Continue trying other variations
                continue;
            }
        }
    }
    
    // If all REST API attempts failed, try SDK approach
    try {
        console.log('[AI Assistant] Trying SDK approach for embedding model');
        const model = genAI.getGenerativeModel({ 
            model: modelName, 
            systemInstruction: params.systemInstruction,
            generationConfig: params.generationConfig 
        });
        
        return await attemptModelGeneration(model, params, modelName);
    } catch (sdkError) {
        // If SDK also fails, throw the last REST API error with more context
        throw new Error(`Failed to use gemini-embedding-1.0: ${lastError?.message || sdkError.message}. Tried multiple API endpoints and model variations.`);
    }
}

async function generateStandardWithRetry(genAI, params, modelName) {
    let cleanName = modelName.replace('models/', '');
    
    // Special handling for embedding model - use robust helper
    if (cleanName === 'gemini-embedding-1.0') {
        return await generateWithEmbeddingModel(genAI, params, API_KEY);
    }
    
    // Try SDK first (uses v1beta by default)
    try {
        const model = genAI.getGenerativeModel({ 
            model: cleanName, 
            systemInstruction: params.systemInstruction,
            generationConfig: params.generationConfig 
        });
        
        return await attemptModelGeneration(model, params, cleanName);
    } catch (sdkError) {
        // If SDK fails with 404, try direct REST API with v1 and v1beta endpoints
        const is404 = sdkError.message?.includes('404') || sdkError.status === 404 || sdkError.message?.includes('not found');
        if (is404) {
            console.log('[AI Assistant] SDK failed with 404, trying direct REST API with multiple endpoints...');
            try {
                return await tryRestAPIDirectly(cleanName, params, API_KEY);
            } catch (restError) {
                console.error('[AI Assistant] Direct REST API also failed:', restError.message);
                throw sdkError; // Throw original SDK error
            }
        }
        throw sdkError;
    }
}

async function attemptModelGeneration(model, params, cleanName) {
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

async function tryRestAPIDirectly(modelName, params, apiKey) {
    const axios = require('axios');
    
    // Try different model name formats (with/without models/ prefix, different variations)
    const modelVariations = [
        modelName,
        modelName.replace('models/', ''),
        `models/${modelName.replace('models/', '')}`,
    ];
    
    // Remove duplicates
    const uniqueVariations = [...new Set(modelVariations)];
    
    // Convert params to API format
    const contents = Array.isArray(params.content) 
        ? params.content.map(p => ({ parts: [{ text: p.text || p }] }))
        : [{ parts: [{ text: params.content }] }];
    
    const payload = {
        contents: contents,
        generationConfig: params.generationConfig || {},
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    };
    
    if (params.systemInstruction?.parts) {
        payload.systemInstruction = {
            parts: params.systemInstruction.parts
        };
    }
    
    // Try v1 endpoint first, then v1beta for each model variation
    const apiVersions = ['v1', 'v1beta'];
    let lastError = null;
    
    for (const modelVariation of uniqueVariations) {
        for (const apiVersion of apiVersions) {
            const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelVariation.replace('models/', '')}:generateContent?key=${apiKey}`;
            
            try {
                console.log(`[AI Assistant] Trying direct REST API: ${apiVersion}/${modelVariation}`);
                
                // Add history if present
                if (params.history && params.history.length > 0) {
                    payload.contents = params.history.map(h => ({
                        role: h.role === 'model' ? 'model' : 'user',
                        parts: h.parts || [{ text: '' }]
                    })).concat(contents);
                }
                
                const response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                });
                
                const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (!text) {
                    throw new Error('Empty response from API');
                }
                
                console.log(`[AI Assistant] Direct REST API success with ${apiVersion}/${modelVariation}!`);
                return { text, model: modelName };
            } catch (error) {
                lastError = error;
                // Continue to next variation/version
                const isLast = (apiVersion === apiVersions[apiVersions.length - 1] && 
                               modelVariation === uniqueVariations[uniqueVariations.length - 1]);
                if (!isLast) {
                    console.warn(`[AI Assistant] ${apiVersion}/${modelVariation} failed: ${error.message?.substring(0, 100)}`);
                }
            }
        }
    }
    
    // If all attempts failed, throw last error
    throw lastError || new Error(`All REST API endpoint variations failed for model: ${modelName}`);
}

async function generateController(genAI, params, requestedModel, retryCount = 0, attemptedModels = []) {
    // Use requested model directly (user-selected), or default if not specified
    let targetModel = requestedModel || modelHelper.getDefaultModel();
    const modelConfig = modelHelper.createModelConfig(targetModel);
    
    // Track attempted models to prevent loops and provide better error messages
    if (!attemptedModels.includes(targetModel)) {
        attemptedModels.push(targetModel);
    }
    
    console.log('[generateController] Requested:', requestedModel, 'Using:', targetModel, 'Default:', DEFAULT_MODEL);
    console.log('[generateController] Model config:', {
        isLive: modelConfig.isLive,
        hasFallback: !!modelConfig.fallback
    });

    try {
        // Use standard HTTP API for all models (most reliable)
        // Only use WebSocket for specific live models if needed
        if (modelConfig.isLive) {
            // Build full prompt with system instructions and history for live API
            let fullPrompt = "";
            
            // Add system instruction if present
            if (params.systemInstruction?.parts) {
                const systemText = params.systemInstruction.parts.map(p => p.text).join('\n');
                fullPrompt += `SYSTEM INSTRUCTIONS:\n${systemText}\n\n`;
            }
            
            // Add conversation history if present
            if (params.history && params.history.length > 0) {
                fullPrompt += "CONVERSATION HISTORY:\n";
                params.history.forEach(h => {
                    const role = h.role === 'model' ? 'Assistant' : 'User';
                    const text = h.parts?.map(p => p.text).join('\n') || '';
                    fullPrompt += `${role}: ${text}\n`;
                });
                fullPrompt += "\n";
            }
            
            // Add current user message
            let currentText = Array.isArray(params.content) 
                ? params.content.map(p => p.text).join('\n') 
                : params.content;
            fullPrompt += `USER: ${currentText}`;
            
            console.log('[AI Assistant] Attempting WebSocket Live API for model:', targetModel);
            try {
                const result = await generateViaSocket(API_KEY, targetModel, fullPrompt);
                console.log('[AI Assistant] Live API WebSocket success, response length:', result.text?.length || 0);
                return result;
            } catch (liveError) {
                // WebSocket already tried REST fallback internally
                // If it still failed, throw to trigger model fallback
                console.error('[AI Assistant] All Live API methods (WebSocket + REST) failed for:', targetModel);
                throw liveError;
            }
        } else {
            // Use standard HTTP API for all models
            console.log('[AI Assistant] Using standard HTTP API model:', targetModel);
            
            // Special handling for embedding model - use robust helper, NO FALLBACK when explicitly selected
            if (targetModel === 'gemini-embedding-1.0' && requestedModel === 'gemini-embedding-1.0') {
                // User explicitly selected embedding model - use it strictly without fallback
                console.log('[AI Assistant] User explicitly selected gemini-embedding-1.0 - using robust helper, NO FALLBACK');
                return await generateStandardWithRetry(genAI, params, targetModel);
            }
            
            return await generateStandardWithRetry(genAI, params, targetModel);
        }
    } catch (error) {
        console.log('[AI Assistant] generateController error:', {
            targetModel,
            retryCount,
            errorMessage: error.message,
            errorStatus: error.status
        });
        
        // NO FALLBACK if user explicitly selected gemini-embedding-1.0
        if (requestedModel === 'gemini-embedding-1.0' && targetModel === 'gemini-embedding-1.0') {
            console.error(`[AI Assistant] ❌ gemini-embedding-1.0 failed. User explicitly selected this model, so no fallback will occur.`);
            throw new Error(`Failed to use gemini-embedding-1.0: ${error.message}. This model was explicitly selected and cannot be replaced with a fallback.`);
        }
        
        // Use fallback chain to try other allowed models
        const shouldTryFallback = modelHelper.shouldFallback(error, targetModel);
        const fallbackModel = modelHelper.getFallbackModel(targetModel);
        
        // Determine error type for better messaging
        const isQuotaError = error.status === 429 || 
                           error.message?.includes('quota') || 
                           error.message?.includes('rate limit') ||
                           error.message?.includes('Too Many Requests') ||
                           error.message?.includes('exceeded');
        
        const isModelNotFound = error.status === 404 || 
                               error.message?.includes('not found') ||
                               error.message?.includes('not supported') ||
                               error.message?.includes('generateContent') && error.message?.includes('not supported');
        
        // Try fallback models (up to 5 attempts to go through the chain)
        // Auto-fallback when no specific model was requested OR when quota/model not found
        const maxRetries = 5; // Allow going through multiple fallback models
        if (shouldTryFallback && fallbackModel && retryCount < maxRetries) {
            // Always try fallback for quota/model errors, or if no specific model requested
            if (isQuotaError || isModelNotFound || !requestedModel) {
                if (isQuotaError) {
                    console.warn(`[AI Assistant] ⚠️ Quota exceeded for ${targetModel}. Falling back to ${fallbackModel}`);
                } else if (isModelNotFound) {
                    console.warn(`[AI Assistant] ⚠️ Model ${targetModel} not found. Falling back to ${fallbackModel}`);
                } else {
                    console.warn(`[AI Assistant] ⚠️ Model ${targetModel} failed. Falling back to ${fallbackModel}`);
                }
                console.warn(`[AI Assistant] Error details: ${error.message?.substring(0, 200)}`);
                
                // Retry with fallback model (pass along attempted models list)
                return await generateController(genAI, params, fallbackModel, retryCount + 1, attemptedModels);
            }
        }
        
        // If no fallback available or exhausted all retries
        if (!fallbackModel || retryCount >= maxRetries) {
            const triedModelsList = attemptedModels.length > 0 ? attemptedModels.join(', ') : targetModel;
            console.error(`[AI Assistant] ❌ No more fallback models available. Tried ${attemptedModels.length || 1} model(s): ${triedModelsList}`);
            
            // Provide helpful error message with suggestions
            if (isModelNotFound) {
                const errorMsg = `⚠️ MODEL NOT FOUND: ${targetModel}\n\n` +
                    `Attempted models: ${triedModelsList}\n\n` +
                    `The model(s) are not available or not supported for generateContent.\n\n` +
                    `Possible reasons:\n` +
                    `1. Model names may be incorrect or not yet available\n` +
                    `2. Your API key may not have access to these models\n` +
                    `3. Models may require special access/permissions\n\n` +
                    `To check available models, run: node backend/scripts/checkModels.js\n\n` +
                    `Your API key: GEMINI_API_KEY_2 (length: ${API_KEY?.length || 0})`;
                throw new Error(errorMsg);
            } else if (isQuotaError) {
                throw new Error(`Quota exceeded. Tried models: ${triedModelsList}. All available models have been attempted. Please try again later or contact support.`);
            }
        }
        
        throw error;
    }
}

async function buildDeepContext(tenant_id, user_id, content) {
    let contextStr = "";
    if (!content) return contextStr;
    const lowerQ = content.toLowerCase();
    
    // Always fetch workspaces and users for project creation
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
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
});

// 2. Create Conversation
router.post('/conversations', async (req, res) => { 
    try { 
        const convo = new Models.Conversation({ ...req.body, messages: [] }); 
        await convo.save(); 
        res.json(convo); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
});

// 2.5. Get Single Conversation
router.get('/conversations/:id', async (req, res) => { 
    try { 
        const conversation = await Models.Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json(conversation); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
});

// 2.6. Delete Conversation
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

// 3. Usage Stats
router.get('/usage/stats', async (req, res) => { 
    const { user_id, tenant_id } = req.query; 
    try { 
        const usage = await Models.TokenUsage.aggregate([
            { $match: { user_id, tenant_id } }, 
            { $group: { _id: null, total_tokens: { $sum: "$total_tokens" } } }
        ]); 
        res.json(usage[0] || { total_tokens: 0 }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
});

// 3.5. Get Available Gemini Models
// Only allowed models: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-robotics-er-1.5-preview,
// gemma-3-12b, gemma-3-1b, gemma-3-27b, gemma-3-4b, gemini-2.5-flash-tts, gemini-3-flash,
// gemma-3-2b, gemini-embedding-1.0, gemini-2.5-flash-native-audio-dialog
const ALLOWED_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-robotics-er-1.5-preview',
    'gemma-3-12b',
    'gemma-3-1b',
    'gemma-3-27b',
    'gemma-3-4b',
    'gemini-2.5-flash-tts',
    'gemini-3-flash',
    'gemma-3-2b',
    'gemini-embedding-1.0',
    'gemini-2.5-flash-native-audio-dialog'
];

router.get('/models', async (req, res) => {
    // Always return all 12 allowed models since user only has access to these
    // The backend will validate model availability when actually using them
    const modelDisplayNames = {
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
        'gemini-robotics-er-1.5-preview': 'Gemini Robotics ER 1.5 Preview',
        'gemma-3-12b': 'Gemma 3 12B',
        'gemma-3-1b': 'Gemma 3 1B',
        'gemma-3-27b': 'Gemma 3 27B',
        'gemma-3-4b': 'Gemma 3 4B',
        'gemini-2.5-flash-tts': 'Gemini 2.5 Flash TTS',
        'gemini-3-flash': 'Gemini 3 Flash',
        'gemma-3-2b': 'Gemma 3 2B',
        'gemini-embedding-1.0': 'Gemini Embedding 1.0',
        'gemini-2.5-flash-native-audio-dialog': 'Gemini 2.5 Flash Native Audio Dialog'
    };
    
    // Try to get model info from API if available, but always return all allowed models
    let apiModels = {};
    if (API_KEY) {
        try {
            const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
            if (response.data && response.data.models) {
                response.data.models.forEach(m => {
                    const modelId = m.name.replace('models/', '');
                    if (ALLOWED_MODELS.includes(modelId)) {
                        apiModels[modelId] = {
                            displayName: m.displayName || modelDisplayNames[modelId] || modelId,
                            description: m.description || `Gemini model: ${modelId}`
                        };
                    }
                });
            }
        } catch (err) {
            console.error('[AI Assistant] Error fetching model info from API:', err.message);
            // Continue to return all models even if API call fails
        }
    }
    
    // Return all 12 allowed models with API info if available
    const models = ALLOWED_MODELS.map(id => ({
        id,
        name: apiModels[id]?.displayName || modelDisplayNames[id] || id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: apiModels[id]?.description || `Gemini model: ${id}`
    }));
    
    return res.json({
        success: true,
        models: models,
        usingAPI: Object.keys(apiModels).length > 0,
        totalAvailable: models.length
    });
});

// 3.5. Check Available Models (Diagnostic)
router.get('/check-models', async (req, res) => {
    if (!API_KEY) {
        return res.status(500).json({ error: "API key not configured" });
    }
    
    try {
        const axios = require('axios');
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        
        if (response.data && response.data.models) {
            const allModels = response.data.models;
            // Include both generative and embedding models
            const generativeModels = allModels
                .filter(m => {
                    const methods = m.supportedGenerationMethods || [];
                    return methods.includes('generateContent') || methods.includes('embedContent');
                })
                .map(m => ({
                    name: m.name.replace('models/', ''),
                    displayName: m.displayName || m.name,
                    description: m.description || '',
                    supportedMethods: m.supportedGenerationMethods || []
                }));
            
            // Check for all allowed models
            const found = {};
            ALLOWED_MODELS.forEach(modelName => {
                found[modelName] = generativeModels.find(m => m.name === modelName);
            });
            
            return res.json({
                success: true,
                availableModels: generativeModels.filter(m => ALLOWED_MODELS.includes(m.name)),
                requestedModels: found,
                totalAvailable: Object.values(found).filter(m => m).length,
                allowedModels: ALLOWED_MODELS
            });
        }
        
        res.json({ success: false, error: "No models found" });
    } catch (err) {
        res.status(500).json({ error: err.message, details: err.response?.data });
    }
});

// 4. MAIN CHAT ROUTE (With Project Creation Logic)
router.post('/chat', async (req, res) => {
    const { conversation_id, content, file_urls, context, model, user_id, tenant_id } = req.body;
    
    if (!API_KEY) {
        console.error('[AI Assistant] GEMINI_API_KEY_2 is not set in environment variables');
        return res.status(500).json({ 
            error: "AI Assistant API key is not configured. Please set GEMINI_API_KEY_2 in your environment variables.",
            code: "API_KEY_MISSING"
        });
    }

    try {
        const conversation = await Models.Conversation.findById(conversation_id);
        if (!conversation) return res.status(404).json({ error: "Conversation not found" });

        // Ensure messages array exists
        if (!conversation.messages) {
            conversation.messages = [];
        }

        const userMsg = { role: 'user', content: content, file_urls, created_at: new Date() };
        conversation.messages.push(userMsg);
        conversation.updated_date = new Date(); 
        await conversation.save();

        const genAI = new GoogleGenerativeAI(API_KEY);
        
        // Build context with error handling
        let deepContext = '';
        try {
            deepContext = await buildDeepContext(tenant_id, user_id, content);
        } catch (contextError) {
            console.error('[AI Assistant] Error building context:', contextError);
            // Continue without context if it fails
        }
        
        // Process files with error handling
        let fileParts = [];
        try {
            fileParts = await processFilesForGemini(file_urls || [], req);
        } catch (fileError) {
            console.error('[AI Assistant] Error processing files:', fileError);
            // Continue without files if processing fails
        }
        
        let contextBlock = "";
        if (context) contextBlock += `${context}\n`;
        if (deepContext) contextBlock += `${deepContext}\n`;

        const finalParts = [
            ...fileParts, 
            { text: contextBlock ? `SYSTEM DATA:\n${contextBlock}\n\nUSER QUERY: ${content}` : content }
        ];

        // Check if this is a project creation conversation (with error handling)
        let isProjectCreation = false;
        let projectInfo = {};
        let infoStatus = { isComplete: false, missing: [] };
        let workspaceList = "No workspaces found. User needs to create one first.";
        
        // Check if this is a task creation conversation
        let isTaskCreation = false;
        let taskInfo = {};
        let taskInfoStatus = { isComplete: false, missing: [] };
        let projectsList = "No projects found. User needs to create one first.";
        let sprintsList = "";
        
        try {
            isProjectCreation = aiProjectService.isProjectCreationConversation(conversation.messages);
            projectInfo = aiProjectService.extractProjectInfo(conversation.messages);
            
            // Get workspaces for validation
            const workspaces = await Models.Workspace.find({ tenant_id });
            workspaceList = workspaces.map(w => `- "${w.name}"`).join('\n');
            
            // Check if project info is complete
            infoStatus = aiProjectService.checkProjectInfoComplete(projectInfo, workspaces);
            
            // Validate workspace_name is not a placeholder or invalid value
            const hasValidWorkspace = projectInfo.workspace_name && 
                typeof projectInfo.workspace_name === 'string' &&
                projectInfo.workspace_name.trim() !== '' &&
                !projectInfo.workspace_name.startsWith('_') && // Reject placeholders like "_name"
                projectInfo.workspace_name.toLowerCase() !== 'workspace' &&
                projectInfo.workspace_name.toLowerCase() !== 'name';
            
            console.log('[AI Assistant] Project extraction result:', {
                isProjectCreation,
                projectInfo,
                infoStatus,
                hasName: !!projectInfo.name && typeof projectInfo.name === 'string' && projectInfo.name.trim() !== '',
                hasWorkspace: hasValidWorkspace,
                hasDeadline: !!projectInfo.deadline && (typeof projectInfo.deadline === 'string' ? projectInfo.deadline.trim() !== '' : true)
            });
            
            // If all info is complete, immediately create the project without asking
            // Accept deadline as string (will be parsed during creation)
            const hasValidDeadline = projectInfo.deadline && 
                (typeof projectInfo.deadline === 'string' ? projectInfo.deadline.trim() !== '' : true);
            
            // Validate project name is not empty
            const hasValidName = projectInfo.name && 
                typeof projectInfo.name === 'string' &&
                projectInfo.name.trim() !== '';
            
            if (isProjectCreation && hasValidName && hasValidWorkspace && hasValidDeadline) {
                console.log('[AI Assistant] All project info complete, creating immediately:', {
                    name: projectInfo.name,
                    workspace: projectInfo.workspace_name,
                    deadline: projectInfo.deadline,
                    infoStatus
                });
                
                // Final parse of deadline if it's still a raw string
                let finalDeadline = projectInfo.deadline;
                if (typeof finalDeadline === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(finalDeadline)) {
                    // Try to parse using the parseDate function from the service
                    const { parseDate } = require('../services/aiProjectService');
                    const parsed = parseDate(finalDeadline);
                    if (parsed) {
                        finalDeadline = parsed;
                        console.log('[AI Assistant] Parsed deadline:', finalDeadline);
                    } else {
                        console.warn('[AI Assistant] Could not parse deadline, will parse during creation:', finalDeadline);
                    }
                }
                
                // Generate project description using AI (quick generation)
                let description = `Project created via AI Assistant: ${projectInfo.name}`;
                try {
                    const descriptionPrompt = `Generate a brief professional description (2-3 sentences) for a project named "${projectInfo.name}" with deadline ${finalDeadline || projectInfo.deadline || 'TBD'}.`;
                    const descResult = await generateController(genAI, {
                        content: descriptionPrompt,
                        systemInstruction: { parts: [{ text: "You are a professional project manager. Generate concise project descriptions." }] }
                    }, modelHelper.getDefaultModel());
                    description = descResult.text || description;
                } catch (descError) {
                    console.error('[AI Assistant] Description generation failed, using default:', descError);
                }
                
                projectInfo.description = description;
                projectInfo.deadline = finalDeadline || projectInfo.deadline;
                
                // Return special response to trigger project creation immediately
                conversation.messages.push({ 
                    role: 'assistant', 
                    content: JSON.stringify({
                        action: "create_project",
                        project_name: projectInfo.name,
                        workspace_name: projectInfo.workspace_name,
                        deadline: projectInfo.deadline,
                        description: projectInfo.description
                    }), 
                    created_at: new Date() 
                });
                await conversation.save();
                
                return res.json({ 
                    message: JSON.stringify({
                        action: "create_project",
                        project_name: projectInfo.name,
                        workspace_name: projectInfo.workspace_name,
                        deadline: projectInfo.deadline,
                        description: projectInfo.description
                    }),
                    action: "create_project",
                    project_data: projectInfo
                });
            }
        } catch (serviceError) {
            console.error('[AI Assistant] Error in project service:', serviceError);
        }
        
        try {
            isTaskCreation = aiTaskService.isTaskCreationConversation(conversation.messages);
            taskInfo = aiTaskService.extractTaskInfo(conversation.messages);
            
            // Get projects and sprints for validation with error handling
            let projects = [];
            try {
                projects = await Models.Project.find({ tenant_id });
                projectsList = projects.map(p => `- "${p.name}"`).join('\n');
            } catch (projectError) {
                console.error('[AI Assistant] Error fetching projects:', projectError);
                projectsList = "Unable to load projects. Please try again.";
            }
            
            if (taskInfo.project_id || taskInfo.project_name) {
                const projectId = taskInfo.project_id || (projects.find(p => 
                    p.name.toLowerCase().includes(taskInfo.project_name?.toLowerCase() || '') ||
                    (taskInfo.project_name?.toLowerCase() || '').includes(p.name.toLowerCase())
                )?._id?.toString());
                
                if (projectId) {
                    const sprints = await Models.Sprint.find({ tenant_id, project_id: projectId });
                    sprintsList = sprints.map(s => `- "${s.name}"`).join('\n') || "No sprints found for this project.";
                }
            }
            
            // Check if task info is complete
            taskInfoStatus = aiTaskService.checkTaskInfoComplete(taskInfo, projects);
            
            // If all required info is complete, immediately create the task without asking
            const hasValidProject = taskInfo.project_id || 
                (taskInfo.project_name && typeof taskInfo.project_name === 'string' && taskInfo.project_name.trim() !== '');
            const hasValidTitle = taskInfo.title && 
                (typeof taskInfo.title === 'string' ? taskInfo.title.trim() !== '' : true);
            
            if (isTaskCreation && taskInfoStatus.isComplete && hasValidTitle && hasValidProject) {
                console.log('[AI Assistant] All task info complete, creating immediately:', {
                    title: taskInfo.title,
                    project: taskInfo.project_name,
                    sprint: taskInfo.sprint_name
                });
                
                // Generate task description using AI
                let description = `Task created via AI Assistant: ${taskInfo.title}`;
                try {
                    const descriptionPrompt = `Generate a brief professional description (2-3 sentences) for a task titled "${taskInfo.title}" in project "${taskInfo.project_name || 'the project'}" with due date ${taskInfo.due_date || 'TBD'}.`;
                    const descResult = await generateController(genAI, {
                        content: descriptionPrompt,
                        systemInstruction: { parts: [{ text: "You are a professional project manager. Generate concise task descriptions." }] }
                    }, modelHelper.getDefaultModel());
                    description = descResult.text || description;
                } catch (descError) {
                    console.error('[AI Assistant] Description generation failed, using default:', descError);
                }
                
                taskInfo.description = description;
                
                // Return special response to trigger task creation immediately
                conversation.messages.push({ 
                    role: 'assistant', 
                    content: JSON.stringify({
                        action: "create_task",
                        title: taskInfo.title,
                        project_name: taskInfo.project_name,
                        sprint_name: taskInfo.sprint_name,
                        assignee_email: taskInfo.assignee_email,
                        assignee_name: taskInfo.assignee_name,
                        due_date: taskInfo.due_date,
                        estimated_hours: taskInfo.estimated_hours,
                        description: taskInfo.description
                    }), 
                    created_at: new Date() 
                });
                await conversation.save();
                
                return res.json({ 
                    message: JSON.stringify({
                        action: "create_task",
                        title: taskInfo.title,
                        project_name: taskInfo.project_name,
                        sprint_name: taskInfo.sprint_name,
                        assignee_email: taskInfo.assignee_email,
                        assignee_name: taskInfo.assignee_name,
                        due_date: taskInfo.due_date,
                        estimated_hours: taskInfo.estimated_hours,
                        description: taskInfo.description
                    }),
                    action: "create_task",
                    task_data: taskInfo
                });
            }
        } catch (serviceError) {
            console.error('[AI Assistant] Error in task service:', serviceError);
        }
        
        // Build system prompt with project and task creation logic
        // Include extracted information so AI knows what we already have
        const extractedProjectInfo = isProjectCreation ? `
CURRENTLY EXTRACTED PROJECT INFORMATION:
- Project Name: ${projectInfo.name || 'NOT YET PROVIDED'}
- Workspace: ${projectInfo.workspace_name || 'NOT YET PROVIDED'}
- Deadline: ${projectInfo.deadline || 'NOT YET PROVIDED'}

IMPORTANT: If any field above shows a value (not "NOT YET PROVIDED"), that information HAS BEEN PROVIDED by the user. Use it immediately and only ask for missing fields.
` : '';
        
        let systemPrompt = `You are Aivora, a professional Project Management Assistant.

CORE INSTRUCTIONS:

1. PROJECT CREATION:
If the user wants to "Create a Project", you MUST follow this strict interview process. Do NOT create the project immediately. Gather these required pieces of information:

1. Project Name (REQUIRED)
2. Workspace (REQUIRED - User MUST select from 'AVAILABLE WORKSPACES' below. If they type a name loosely matching one, accept it.)
3. Deadline (REQUIRED - Date)
4. Team Members to Invite (Optional)

${extractedProjectInfo}

AVAILABLE WORKSPACES:
${workspaceList || "No workspaces found. User needs to create one first."}

2. TASK CREATION:
If the user wants to "Create a Task", you MUST follow this strict interview process. Do NOT create the task immediately. Gather these required pieces of information IN THIS ORDER:

1. Project (REQUIRED - Ask FIRST: "Which project should this task belong to?" - User MUST select from 'AVAILABLE PROJECTS' below)
2. Sprint (Ask SECOND: "Which sprint should this task be in?" - List available sprints for the selected project)
3. Task Title (REQUIRED - Ask THIRD: "What is the title of the task?")
4. Assignee (Optional - Ask: "Who should be assigned to this task?")
5. Due Date (Optional - Ask: "What is the due date?")
6. Estimated Hours (Optional - Ask: "What is the estimated time in hours?")

AVAILABLE PROJECTS:
${projectsList}

AVAILABLE SPRINTS:
${sprintsList || "No sprints available yet."}

BEHAVIOR FOR PROJECTS:
- CRITICAL RULE: If the user provides ALL required information (project name, workspace, deadline) in ANY message, you MUST immediately respond with the create_project JSON action WITHOUT asking any questions or for confirmation.
- FIRST, check the ENTIRE conversation history - look at ALL user messages, not just the current one. The user might have provided information in previous messages.
- Check if the user's CURRENT message is a simple response to your question (like "ai project" after you asked for the name) - if so, treat it as the missing information you asked for.
- Check if the user's message contains information in parentheses format like "Create a project (name,deadline,workspace)" - if so, extract and use that information.
- Also check for comma-separated format like "Create a project name,deadline,workspace".
- Check if the user's message contains the required info (name, workspace, deadline).
- If ALL required information is present (name, workspace, deadline), respond IMMEDIATELY with: {"action": "create_project", "project_name": "[name]", "workspace_name": "[workspace]", "deadline": "[date]", "description": "[generated description]"} - DO NOT ask questions, DO NOT ask for confirmation, just create it.
- ONLY ask questions if information is ACTUALLY MISSING:
  - If 'Project Name' is missing AND you haven't asked for it yet in this conversation, ask: "I can help you create a project! What would you like to name this project?"
  - If 'Workspace' is missing AND you haven't asked for it yet, ask: "Which workspace should this project belong to? Please select from the available workspaces below:\n\n${workspaceList || "No workspaces found. User needs to create one first."}\n\nJust type the workspace name."
  - If 'Deadline' is missing AND you haven't asked for it yet, ask: "What is the deadline for this project? (Please provide a date, e.g., '10th January 2026' or '2026-01-10')"
- IMPORTANT: Check the "CURRENTLY EXTRACTED PROJECT INFORMATION" section above - if any field shows a value, that information HAS BEEN PROVIDED and you should use it.
- IMPORTANT: If you just asked for the project name and the user responds with simple text (like "ai project"), that IS the project name - use it immediately and proceed to ask for the next missing piece if needed.
- IMPORTANT: NEVER ask for the same information twice. If the extracted information shows a value, DO NOT ask for it again.
- IMPORTANT: NEVER use placeholder values like "_name", "_workspace", or "_deadline". If information is missing, ASK the user for it instead of creating with placeholders.
- IMPORTANT: When checking if information is missing, ALWAYS check the "CURRENTLY EXTRACTED PROJECT INFORMATION" section first. Only ask for fields that show "NOT YET PROVIDED".
- When the user provides missing information in a follow-up message, check again if ALL info is now present, and if so, create immediately without asking.

BEHAVIOR FOR TASKS:
- CRITICAL RULE: If the user provides ALL required information (project, title) in ANY message, you MUST immediately respond with the create_task JSON action WITHOUT asking any questions or for confirmation.
- FIRST, check if the user's message contains information in parentheses format like "Create a task (project,sprint,title,assignee,due date,estimate)" - if so, extract and use that information.
- Also check for comma-separated format like "Create a task project,sprint,title,assignee,due date,estimate".
- Check if the user's message contains the required info (project, title).
- If ALL required information is present (project, title), respond IMMEDIATELY with: {"action": "create_task", "title": "[title]", "project_name": "[project]", "sprint_name": "[sprint]", "assignee_email": "[email]", "due_date": "[date]", "estimated_hours": [hours], "description": "[generated description]"} - DO NOT ask questions, DO NOT ask for confirmation, just create it.
- ONLY ask questions if information is ACTUALLY MISSING - ASK IN THIS ORDER:
  - If 'Project' is missing, ask FIRST: "I can help you create a task! Which project should this task belong to?" (List the Available Projects).
  - If 'Sprint' is missing (and project is selected), ask SECOND: "Which sprint should this task be in?" (List available sprints for the selected project).
  - If 'Task Title' is missing, ask THIRD: "What is the title of the task?"
- When the user provides missing information in a follow-up message, check again if ALL info is now present, and if so, create immediately without asking.

For all other queries, answer normally, concisely, and professionally.`;

        // Note: Project and task creation with all info is handled above before AI generation
        // This section continues only if creation didn't happen (info was incomplete)

        // Only proceed with AI generation if we haven't already created the project/task
        // (The creation would have returned early above)
        
        const systemInstruction = { parts: [{ text: systemPrompt }] };

        // Exclude current message from history - ensure messages is an array
        const messagesForHistory = Array.isArray(conversation.messages) ? conversation.messages : [];
        const historyForAI = messagesForHistory.slice(0, -1).slice(-6).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || (m.file_urls?.length ? "File" : "") }]
        }));

        // Generate AI response with error handling
        let result;
        // Use user-selected model or default from helper
        const modelToUse = model || modelHelper.getDefaultModel();
        console.log('[AI Assistant] Starting AI generation with model:', modelToUse);
        console.log('[AI Assistant] Requested model:', model, 'Using:', modelToUse);
        
        try {
            result = await generateController(genAI, {
                content: finalParts,
                history: historyForAI,
                systemInstruction: systemInstruction
            }, modelToUse);
        } catch (genError) {
            console.error('[AI Assistant] Error generating response:', genError);
            console.error('[AI Assistant] Generation error details:', {
                message: genError.message,
                code: genError.code,
                status: genError.status,
                response: genError.response?.data
            });
            
        // Check for specific API errors
        if (genError.message?.includes('API_KEY') || genError.message?.includes('API key')) {
            return res.status(500).json({ 
                error: 'AI API key is invalid or expired. Please check your GEMINI_API_KEY_2 configuration.',
                code: 'API_KEY_INVALID'
            });
        }
        // Handle quota/token exhaustion errors - return graceful response for frontend toast
        if (genError.message?.includes('quota') || genError.message?.includes('rate limit') || 
            genError.message?.includes('exceeded') || genError.message?.includes('RPD') || 
            genError.message?.includes('RPM') || genError.status === 429) {
            const retryAfter = genError.message?.match(/retry in ([\d.]+)s/i)?.[1] || '60';
            console.warn('[AI Assistant] Quota/token exhaustion detected for model:', modelToUse);
            return res.status(200).json({ // Return 200 so frontend can handle gracefully
                message: '',
                error: true,
                code: 'TOKENS_EXPIRED',
                model: modelToUse,
                message: `Tokens expired for ${modelToUse}. Please try a different model.`,
                retryAfter: Math.ceil(parseFloat(retryAfter))
            });
        }
        if (genError.status === 404 || genError.message?.includes('not found')) {
            return res.status(200).json({ // Return 200 for graceful handling
                error: true,
                code: 'MODEL_NOT_FOUND',
                model: modelToUse,
                message: `Model ${modelToUse} is not available. Please try a different model.`
            });
        }
            
            throw genError; // Re-throw to be caught by outer catch
        }

        // Ensure result has text property
        const responseText = result.text || result.message || 'No response generated';
        
        try {
            conversation.messages.push({ role: 'assistant', content: responseText, created_at: new Date() });
            await conversation.save();
        } catch (saveError) {
            console.error('[AI Assistant] Error saving conversation:', saveError);
            // Continue even if save fails - at least return the response
        }

        // Track usage (optional)
        if (result.usage?.totalTokenCount > 0) {
            try {
                await Models.TokenUsage.create({
                    tenant_id, user_id, model: result.model || result.usedModel || DEFAULT_MODEL,
                    total_tokens: result.usage.totalTokenCount,
                    created_date: new Date()
                });
            } catch (usageError) {
                console.error('[AI Assistant] Failed to track usage:', usageError);
                // Continue even if usage tracking fails
            }
        }

        // Return conversation with messages for frontend
        const updatedConversation = await Models.Conversation.findById(conversation_id);
        res.json({ 
            message: responseText, 
            text: responseText, // Also include as 'text' for compatibility
            usage: result.usage, 
                    model: result.model || result.usedModel || modelHelper.getDefaultModel(),
            conversation: updatedConversation // Include full conversation with messages
        });

    } catch (err) {
        console.error("AI Assistant Error:", err);
        console.error("Error stack:", err.stack);
        console.error("Error details:", {
            message: err.message,
            name: err.name,
            code: err.code,
            status: err.status,
            response: err.response?.data
        });
        
        // Provide more helpful error messages
        let errorMessage = err.message || 'Internal server error';
        if (err.message?.includes('API_KEY') || err.message?.includes('API key')) {
            errorMessage = 'AI API key is missing or invalid. Please check your GEMINI_API_KEY_2 environment variable.';
        } else if (err.message?.includes('quota') || err.message?.includes('rate limit')) {
            errorMessage = 'API quota exceeded or rate limit reached. Please try again later.';
        } else if (err.message?.includes('network') || err.code === 'ECONNREFUSED') {
            errorMessage = 'Network error. Please check your internet connection.';
        }
        
        res.status(500).json({ 
            error: errorMessage, 
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            type: err.name || 'UnknownError'
        });
    }
});

// 5. CREATE PROJECT ENDPOINT (Called when AI confirms project creation)
router.post('/create-project', async (req, res) => {
    const { project_name, workspace_name, deadline, description, tenant_id, user_id, user_email } = req.body;
    
    if (!project_name || !tenant_id || !user_id || !user_email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const projectInfo = {
            name: project_name,
            description: description || `Project created via AI Assistant: ${project_name}`,
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

// 6. CREATE TASK ENDPOINT (Called when AI confirms task creation)
router.post('/create-task', async (req, res) => {
    const { title, project_name, sprint_name, assignee_email, assignee_name, due_date, estimated_hours, description, tenant_id, user_id, user_email } = req.body;
    
    if (!title || !tenant_id || !user_id || !user_email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const taskInfo = {
            title: title,
            description: description || `Task created via AI Assistant: ${title}`,
            project_name: project_name,
            sprint_name: sprint_name,
            assignee_email: assignee_email,
            assignee_name: assignee_name,
            due_date: due_date || undefined,
            estimated_hours: estimated_hours || 0
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
