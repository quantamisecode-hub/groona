/**
 * Script to check available Gemini models with your API key
 * Run: node backend/scripts/checkModels.js
 */
require('dotenv').config();
const axios = require('axios');

async function checkAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('❌ No API key found. Set GEMINI_API_KEY_2 or GEMINI_API_KEY in .env');
        return;
    }
    
    console.log('\n🔍 Checking available Gemini models...\n');
    
    try {
        // List all models
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (response.data && response.data.models) {
            const allModels = response.data.models;
            
            // Filter models that support text generation
            const generativeModels = allModels
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => ({
                    name: m.name.replace('models/', ''),
                    displayName: m.displayName || m.name,
                    description: m.description || '',
                    supportedMethods: m.supportedGenerationMethods || []
                }));
            
            console.log('✅ AVAILABLE TEXT GENERATION MODELS:');
            console.log('='.repeat(80));
            generativeModels.forEach((m, i) => {
                console.log(`${i + 1}. ${m.name}`);
                if (m.displayName !== m.name) console.log(`   Display: ${m.displayName}`);
                if (m.description) console.log(`   ${m.description.substring(0, 100)}...`);
                console.log(`   Methods: ${m.supportedMethods.join(', ')}`);
                console.log('');
            });
            
            // Check for specific models
            console.log('\n🎯 CHECKING YOUR REQUESTED MODELS:');
            console.log('='.repeat(80));
            
            const requestedModels = ['gemini-2.5-flash-native-audio-dialog', 'gemini-embedding-1.0'];
            
            requestedModels.forEach(modelName => {
                const found = generativeModels.find(m => m.name === modelName || m.name.includes(modelName));
                if (found) {
                    console.log(`✅ ${modelName} - FOUND`);
                    console.log(`   Full name: ${found.name}`);
                } else {
                    // Try partial matches
                    const partial = generativeModels.find(m => 
                        m.name.toLowerCase().includes(modelName.split('-').pop()) ||
                        m.displayName?.toLowerCase().includes(modelName.split('-').pop())
                    );
                    if (partial) {
                        console.log(`⚠️  ${modelName} - NOT FOUND, but found similar: ${partial.name}`);
                    } else {
                        console.log(`❌ ${modelName} - NOT FOUND`);
                    }
                }
            });
            
            // Suggest alternatives
            console.log('\n💡 SUGGESTED ALTERNATIVES (if your models are unavailable):');
            console.log('='.repeat(80));
            const alternatives = generativeModels.filter(m => 
                m.name.includes('flash') || 
                m.name.includes('2.5') || 
                m.name.includes('2.0') ||
                m.name.includes('exp')
            );
            
            if (alternatives.length > 0) {
                alternatives.slice(0, 5).forEach((m, i) => {
                    console.log(`${i + 1}. ${m.name}${m.displayName !== m.name ? ` (${m.displayName})` : ''}`);
                });
            } else {
                console.log('No alternative models found.');
            }
            
        } else {
            console.log('⚠️  No models found in response');
        }
        
    } catch (error) {
        console.error('❌ Error checking models:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkAvailableModels();
