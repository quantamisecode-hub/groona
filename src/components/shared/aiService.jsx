import { groonabackend } from "@/api/groonabackend";

/**
 * AI Service - Centralized abstraction layer for all AI interactions
 * Handles LLM calls, agent orchestration, conversation management, and streaming
 */

class AIService {
  constructor() {
    this.conversationCache = new Map();
    this.activeStreams = new Map();
  }

  /**
   * Send a prompt to an AI agent with streaming support
   * @param {string} agentName - Name of the agent to use
   * @param {object} conversation - Conversation object from agents SDK
   * @param {string} message - User message
   * @param {function} onToken - Callback for streaming tokens
   * @param {array} fileUrls - Optional file attachments
   * @returns {Promise<object>} - Complete AI response
   */
  async sendMessageToAgent(agentName, conversation, message, onToken = null, fileUrls = null) {
    try {
      console.log('[AIService] Sending message to agent:', agentName);
      
      const messageData = {
        role: 'user',
        content: message,
      };

      if (fileUrls && fileUrls.length > 0) {
        messageData.file_urls = fileUrls;
      }

      // Add message and get response
      const response = await groonabackend.agents.addMessage(conversation, messageData);
      
      // If streaming callback provided, simulate streaming (groonabackend doesn't support true streaming yet)
      if (onToken && response.content) {
        await this.simulateStreaming(response.content, onToken);
      }

      return response;
    } catch (error) {
      console.error('[AIService] Agent message failed:', error);
      throw error;
    }
  }

  /**
   * Direct LLM call with advanced options
   * @param {string} prompt - The prompt to send
   * @param {object} options - Options for the LLM call
   * @returns {Promise<any>} - LLM response
   */
  async invokeLLM(prompt, options = {}) {
    const {
      addContextFromInternet = false,
      responseJsonSchema = null,
      fileUrls = null,
      onToken = null,
      temperature = 0.7,
    } = options;

    try {
      console.log('[AIService] Invoking LLM with prompt:', prompt.substring(0, 100));

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: addContextFromInternet,
        response_json_schema: responseJsonSchema,
        file_urls: fileUrls,
      });

      // Simulate streaming if callback provided
      if (onToken && typeof response === 'string') {
        await this.simulateStreaming(response, onToken);
      }

      return response;
    } catch (error) {
      console.error('[AIService] LLM invocation failed:', error);
      throw error;
    }
  }

  /**
   * Simulate streaming by breaking text into chunks
   * (Until true streaming is supported by groonabackend)
   */
  async simulateStreaming(text, onToken) {
    const words = text.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + words[i];
      onToken(accumulated);
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  /**
   * Intelligent agent routing based on query intent
   * @param {string} query - User query
   * @param {object} context - Current app context (project, user, etc.)
   * @returns {string} - Recommended agent name
   */
  async routeToAgent(query, context = {}) {
    const queryLower = query.toLowerCase();

    // Simple keyword-based routing (can be enhanced with ML in future)
    const routingRules = [
      {
        keywords: ['project', 'task', 'sprint', 'deadline', 'milestone', 'team', 'assign'],
        agent: 'project_assistant',
        confidence: 0.8
      },
      {
        keywords: ['report', 'analytics', 'insights', 'data', 'chart', 'metrics'],
        agent: 'analytics_assistant',
        confidence: 0.7
      },
      {
        keywords: ['code', 'review', 'bug', 'technical', 'deploy', 'git'],
        agent: 'code_assistant',
        confidence: 0.75
      },
      {
        keywords: ['help', 'how', 'what', 'guide', 'tutorial'],
        agent: 'general_assistant',
        confidence: 0.6
      }
    ];

    let bestMatch = { agent: 'project_assistant', confidence: 0.5 }; // Default

    for (const rule of routingRules) {
      const matchCount = rule.keywords.filter(keyword => queryLower.includes(keyword)).length;
      const confidence = (matchCount / rule.keywords.length) * rule.confidence;

      if (confidence > bestMatch.confidence) {
        bestMatch = { agent: rule.agent, confidence };
      }
    }

    console.log('[AIService] Routed to agent:', bestMatch.agent, 'confidence:', bestMatch.confidence);
    return bestMatch.agent;
  }

  /**
   * Generate contextual suggestions based on current state
   * @param {object} context - Current app context
   * @returns {array} - Array of suggestion objects
   */
  async generateSuggestions(context = {}) {
    const suggestions = [];

    // Primary suggestions for creating projects and tasks
    suggestions.push(
      {
        text: 'Create a project',
        icon: 'Plus',
        category: 'action',
        description: 'Start a new project with AI assistance'
      },
      {
        text: 'Create a task',
        icon: 'Target',
        category: 'action',
        description: 'Create a task with all details automatically'
      }
    );

    // Additional contextual suggestions
    if (context.currentProject) {
      suggestions.push({
        text: `Summarize project ${context.currentProject.name}`,
        icon: 'FileText',
        category: 'project'
      });
    }

    return suggestions;
  }

  /**
   * Cache conversation for quick access
   */
  cacheConversation(conversationId, conversation) {
    this.conversationCache.set(conversationId, {
      conversation,
      timestamp: Date.now()
    });

    // Clear old cache entries (older than 30 minutes)
    for (const [id, entry] of this.conversationCache.entries()) {
      if (Date.now() - entry.timestamp > 30 * 60 * 1000) {
        this.conversationCache.delete(id);
      }
    }
  }

  /**
   * Get cached conversation
   */
  getCachedConversation(conversationId) {
    return this.conversationCache.get(conversationId)?.conversation;
  }

  /**
   * Clear conversation cache
   */
  clearCache() {
    this.conversationCache.clear();
  }

  /**
   * Process and validate agent response for security
   * Ensures agent actions respect user permissions
   */
  async validateAgentAction(action, userPermissions) {
    const { type, entityType, operation } = action;

    // Map action types to permission checks
    const permissionMap = {
      create_task: 'can_create_task',
      update_task: 'can_edit_task',
      delete_task: 'can_delete_task',
      create_project: 'can_create_project',
      update_project: 'can_edit_project',
    };

    const requiredPermission = permissionMap[`${operation}_${entityType}`];

    if (requiredPermission && !userPermissions[requiredPermission]) {
      throw new Error(`Permission denied: ${requiredPermission}`);
    }

    return true;
  }

  /**
   * Extract actionable items from AI response
   * @param {string} response - AI response text
   * @returns {array} - Array of actionable items
   */
  extractActions(response) {
    const actions = [];

    // Pattern matching for common actions
    const patterns = [
      {
        regex: /create (?:a |an )?task[:\s]+["']?([^"'\n]+)["']?/gi,
        action: 'create_task',
        extract: (match) => ({ title: match[1] })
      },
      {
        regex: /assign task[:\s]+["']?([^"'\n]+)["']?\s+to\s+([^\n]+)/gi,
        action: 'assign_task',
        extract: (match) => ({ task: match[1], assignee: match[2] })
      },
      {
        regex: /schedule (?:a )?meeting[:\s]+["']?([^"'\n]+)["']?/gi,
        action: 'schedule_meeting',
        extract: (match) => ({ title: match[1] })
      }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(response)) !== null) {
        actions.push({
          type: pattern.action,
          data: pattern.extract(match),
          confidence: 0.8
        });
      }
    }

    return actions;
  }

  /**
   * Format context for AI prompts
   * @param {object} appContext - Current application context
   * @returns {string} - Formatted context string
   */
  formatContext(appContext) {
    const parts = [];

    if (appContext.currentUser) {
      parts.push(`Current user: ${appContext.currentUser.full_name} (${appContext.currentUser.email})`);
      parts.push(`Role: ${appContext.currentUser.role}`);
    }

    if (appContext.currentProject) {
      parts.push(`\nCurrent project: ${appContext.currentProject.name}`);
      parts.push(`Status: ${appContext.currentProject.status}`);
      parts.push(`Progress: ${appContext.currentProject.progress}%`);
    }

    if (appContext.recentTasks && appContext.recentTasks.length > 0) {
      parts.push(`\nRecent tasks (${appContext.recentTasks.length}):`);
      appContext.recentTasks.slice(0, 5).forEach(task => {
        parts.push(`- ${task.title} (${task.status})`);
      });
    }

    if (appContext.teamMembers && appContext.teamMembers.length > 0) {
      parts.push(`\nTeam members: ${appContext.teamMembers.map(m => m.full_name).join(', ')}`);
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;

