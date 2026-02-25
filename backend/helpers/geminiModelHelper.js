/**
 * Gemini Model Helper
 * Centralized helper for managing Gemini model selection
 * 
 * Only allowed models: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-robotics-er-1.5-preview,
 * gemma-3-12b, gemma-3-1b, gemma-3-27b, gemma-3-4b, gemini-2.5-flash-tts, gemini-3-flash,
 * gemma-3-2b, gemini-embedding-1.0, gemini-2.5-flash-native-audio-dialog
 */

// Primary model - gemini-2.5-flash
const DEFAULT_MODEL = "gemini-2.5-flash";

// Fallback chain using only allowed models
// Chain should eventually lead to a working model (gemini-2.5-flash or gemini-3-flash)
const FALLBACK_CHAIN = {
    "gemini-2.5-flash": "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite": "gemini-3-flash",
    "gemini-3-flash": "gemma-3-12b",
    "gemma-3-12b": "gemma-3-27b",
    "gemma-3-27b": "gemma-3-4b",
    "gemma-3-4b": "gemma-3-2b",
    "gemma-3-2b": "gemma-3-1b",
    "gemma-3-1b": "gemini-2.5-flash", // Loop back to main model if all gemma models fail
    "gemini-2.5-flash-native-audio-dialog": "gemini-2.5-flash",
    "gemini-2.5-flash-tts": "gemini-2.5-flash",
    "gemini-robotics-er-1.5-preview": "gemini-2.5-flash",
    "gemini-embedding-1.0": null,  // No fallback - user explicitly selected this model, must use it
};

// Model priority list - all allowed models
const MODEL_PRIORITY_LIST = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-flash",
    "gemini-2.5-flash-native-audio-dialog",
    "gemini-2.5-flash-tts",
    "gemini-robotics-er-1.5-preview",
    "gemma-3-12b",
    "gemma-3-27b",
    "gemma-3-4b",
    "gemma-3-2b",
    "gemma-3-1b",
    "gemini-embedding-1.0",
];

/**
 * Get the default model (primary choice)
 */
function getDefaultModel() {
    return DEFAULT_MODEL;
}

/**
 * Check if model is a live/native-audio model (requires WebSocket)
 * gemini-2.5-flash-native-audio-dialog MUST use WebSocket (doesn't work with HTTP API)
 */
function isLiveModel(model) {
    if (!model) return false;
    // Models that require WebSocket/Live API
    return model.includes("live") || 
           model.includes("native-audio-dialog") ||
           model.includes("native-audio") ||
           model === "gemini-2.5-flash-native-audio-dialog";
}

/**
 * Get fallback model if available
 * Returns null if no fallback exists
 * Uses both explicit fallback chain and priority list
 */
function getFallbackModel(model) {
    if (!model) return null;
    
    // First check explicit fallback chain
    if (FALLBACK_CHAIN[model]) {
        return FALLBACK_CHAIN[model];
    }
    
    // Then check priority list
    return getNextModelInPriorityList(model);
}

/**
 * Determine if error warrants a fallback
 * Only fallback to allowed models from the FALLBACK_CHAIN
 */
function shouldFallback(error, model) {
    if (!error) return false;
    
    // Check if fallback exists for this model
    if (!FALLBACK_CHAIN[model] || FALLBACK_CHAIN[model] === null) {
        return false;
    }
    
    // Note: gemini-embedding-1.0 has null fallback - when explicitly selected, no fallback should occur
    
    // Check for quota errors
    const isQuotaError = error.status === 429 || 
                       error.message?.includes('quota') || 
                       error.message?.includes('rate limit') ||
                       error.message?.includes('Too Many Requests') ||
                       error.message?.includes('RPD') ||
                       error.message?.includes('RPM') ||
                       error.message?.includes('exceeded');
    
    // Check for technical errors
    const isTechnicalError = error.status === 400 || 
                            error.status === 404 ||
                            error.status === 503 ||
                            error.message?.includes('not found') ||
                            error.message?.includes('not supported') ||
                            error.message?.includes('connection') ||
                            error.message?.includes('timeout') ||
                            error.message?.includes('socket') ||
                            error.message?.includes('WebSocket');
    
    // Fallback if error occurs and fallback model exists
    return (isQuotaError || isTechnicalError);
}

/**
 * Get next model from priority list if current one fails
 */
function getNextModelInPriorityList(currentModel) {
    const currentIndex = MODEL_PRIORITY_LIST.indexOf(currentModel);
    if (currentIndex >= 0 && currentIndex < MODEL_PRIORITY_LIST.length - 1) {
        return MODEL_PRIORITY_LIST[currentIndex + 1];
    }
    return null;
}

/**
 * Get model with smart selection
 * Always returns default model unless explicitly overridden
 */
function getModel(requestedModel) {
    // Always use default model if none requested or if requested is invalid
    if (!requestedModel || requestedModel === 'default') {
        return DEFAULT_MODEL;
    }
    
    // If requested model is valid, use it (but default is preferred)
    return requestedModel;
}

/**
 * Create model configuration for API calls
 */
function createModelConfig(model) {
    const selectedModel = getModel(model);
    return {
        model: selectedModel,
        isLive: isLiveModel(selectedModel),
        fallback: getFallbackModel(selectedModel),
        supportsSystemInstructions: !isLiveModel(selectedModel), // Live models handle system instructions differently
    };
}

module.exports = {
    DEFAULT_MODEL,
    FALLBACK_CHAIN,
    MODEL_PRIORITY_LIST,
    getDefaultModel,
    isLiveModel,
    getFallbackModel,
    shouldFallback,
    getModel,
    createModelConfig,
    getNextModelInPriorityList,
};
