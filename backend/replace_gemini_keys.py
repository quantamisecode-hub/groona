import os
import re

files = [
    r"c:\Users\abdul\Downloads\Groona\backend\routes\aiAssistant.js",
    r"c:\Users\abdul\Downloads\Groona\backend\routes\aiAssistantService.js",
    r"c:\Users\abdul\Downloads\Groona\backend\routes\api.js",
    r"c:\Users\abdul\Downloads\Groona\backend\routes\functions.js"
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('process.env.GEMINI_API_KEY_2', 'process.env.GROQ_AI_API')
    content = content.replace('process.env.GEMINI_API_KEY', 'process.env.GROQ_AI_API')
    content = content.replace('GEMINI_API_KEY_2', 'GROQ_AI_API')
    content = content.replace('GEMINI_API_KEY', 'GROQ_AI_API')
    content = re.sub(r'new\s+GoogleGenerativeAI\([^)]*\)', 'null', content)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print('Replaced GEMINI_API_KEY with GROQ_AI_API and removed GoogleGenerativeAI instantiations successfully.')
