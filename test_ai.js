const axios = require('axios');

async function test() {
    const prompt = `You are a project management expert. Based on the task title "Build a landing page for marketing campaign", generate comprehensive task details.
      
      Output JSON strictly.
      1. title: A concise, refined task title based on the user's input
      2. description (2-3 sentences)
      3. priority (low/medium/high/urgent)
      4. story_points (Fibonacci: 1, 2, 3, 5, 8, 13)
      5. due_date: (YYYY-MM-DD format, estimate a reasonable deadline if not obvious)
      6. labels (array of strings)
      7. acceptance_criteria (plain text bullet points, DO NOT use bolding or markdown stars like **text**)
      8. subtasks (array of strings)
      
      CRITICAL: Return ONLY valid JSON. Do NOT wrap the response in \`\`\`json blocks or any other markdown.
      
      Context: Software development task.`;

    const response_json_schema = {
        type: "object",
        properties: {
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string" },
            story_points: { type: "number" },
            due_date: { type: "string" },
            labels: { type: "array", items: { type: "string" } },
            acceptance_criteria: { type: "string" },
            subtasks: { type: "array", items: { type: "string" } }
        },
        required: ["title", "description", "priority", "story_points", "due_date", "labels", "acceptance_criteria", "subtasks"]
    };

    try {
        const res = await axios.post('http://localhost:5000/api/integrations/llm', {
            prompt,
            response_json_schema
        });
        console.log("RESPONSE:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}

test();
