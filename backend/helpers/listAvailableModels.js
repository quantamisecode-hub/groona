/**
 * Helper to list available models for debugging
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

async function listAvailableModels(apiKey) {
    try {
        console.log('\n=== LISTING AVAILABLE MODELS ===');
        
        // Method 1: Direct REST API call
        try {
            const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (response.data && response.data.models) {
                console.log('\n📋 Available Models (via REST API):');
                const generativeModels = response.data.models
                    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));
                
                generativeModels.forEach(name => console.log(`  ✓ ${name}`));
                
                // Check if our target models exist
                if (generativeModels.includes('gemini-2.5-flash-native-audio-dialog')) {
                    console.log('\n✅ gemini-2.5-flash-native-audio-dialog IS AVAILABLE');
                } else {
                    console.log('\n❌ gemini-2.5-flash-native-audio-dialog NOT FOUND');
                }
                
                if (generativeModels.includes('gemini-embedding-1.0')) {
                    console.log('✅ gemini-embedding-1.0 IS AVAILABLE');
                } else {
                    console.log('❌ gemini-embedding-1.0 NOT FOUND');
                }
                
                // Suggest alternatives
                if (generativeModels.length > 0) {
                    console.log('\n💡 Suggested alternatives with good quotas:');
                    generativeModels.filter(m => 
                        m.includes('flash') || m.includes('exp') || m.includes('2.5') || m.includes('2.0')
                    ).slice(0, 5).forEach(name => console.log(`  → ${name}`));
                }
                
                return generativeModels;
            }
        } catch (restError) {
            console.error('❌ REST API error:', restError.message);
        }
        
        // Method 2: Try SDK method
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            // Note: SDK doesn't expose listModels easily, but we can try a simple call
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] });
            console.log('\n✅ API Key is valid and can access models');
        } catch (sdkError) {
            console.error('❌ SDK test error:', sdkError.message);
        }
        
    } catch (error) {
        console.error('Error listing models:', error.message);
    }
}

module.exports = { listAvailableModels };
