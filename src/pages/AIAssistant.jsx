import React, { useState, useEffect, useRef } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Loader2,
  Plus,
  Sparkles,
  MessageSquare,
  Trash2,
  Menu,
  X,
  Zap,
  ChevronDown,
  Square,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { aiService } from "../components/shared/aiService";
import EnhancedMessageBubble from "../components/ai/EnhancedMessageBubble";
import ConversationSuggestions from "../components/ai/ConversationSuggestions";
import FileUploadButton from "../components/ai/FileUploadButton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useHasPermission } from "../components/shared/usePermissions";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import { createProjectFromAI, parseProjectCreationResponse } from "../services/aiProjectService";
import { createTaskFromAI } from "../services/aiTaskService";

export default function AIAssistantPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [appContext, setAppContext] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const canUseAI = useHasPermission('can_use_ai_assistant');

  // Fetch available Gemini models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await groonabackend.agents.listModels();
        if (response.success && response.models && response.models.length > 0) {
          setAvailableModels(response.models);
          // Set default model if not already set (prefer gemini-2.5-flash)
          if (!selectedModel) {
            const defaultModel = response.models.find(m => m.id === 'gemini-2.5-flash') || response.models[0];
            setSelectedModel(defaultModel.id);
          }
        }
      } catch (error) {
        console.error('[AIAssistant] Error fetching models:', error);
      }
    };
    
    fetchModels();
  }, []);

  // Determine user role for onboarding
  const isProjectManager = currentUser?.custom_role === 'project_manager';
  const userRole = currentUser?.is_super_admin || currentUser?.role === 'admin' ? 'admin' : 
                   (isProjectManager ? 'project_manager' : 'user');

  // CRITICAL FIX: Remove setTimeout and handle permission check properly
  useEffect(() => {
    groonabackend.auth.me()
      .then(user => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AIAssistant] Current user loaded:', user);
        }
        setCurrentUser(user);
        setPermissionChecked(true);
      })
      .catch(() => {
        setCurrentUser(null);
        setPermissionChecked(true);
      });
  }, []);

  useEffect(() => {
    if (permissionChecked && currentUser) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AIAssistant] Permission check:', {
          canUseAI,
          isAdmin: currentUser.role === 'admin',
          isSuperAdmin: currentUser.is_super_admin,
          tenantId: currentUser.tenant_id
        });
      }

      if (!currentUser.is_super_admin && !canUseAI) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AIAssistant] ❌ Access denied - redirecting to dashboard');
        }
        toast.error('You do not have permission to use AI Assistant');
        navigate(createPageUrl("Dashboard"));
      }
    }
  }, [permissionChecked, currentUser, canUseAI, navigate]);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }) || [];
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date', 20) || [];
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId) || [];
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  useEffect(() => {
    if (currentUser && projects && tasks && teamMembers) {
      setAppContext({
        currentUser,
        projects,
        recentTasks: tasks,
        teamMembers
      });
    }
  }, [currentUser, projects, tasks, teamMembers]);

  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AIAssistant] Fetching conversations...');
      }
      try {
        const convos = await groonabackend.agents.listConversations();
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AIAssistant] Conversations loaded:', convos?.length || 0);
        }
        return convos || [];
      } catch (error) {
        console.error('[AIAssistant] Failed to load conversations:', error);
        toast.error('Failed to load conversations. The AI Agent may need to redeploy.');
        return [];
      }
    },
    enabled: !!currentUser,
    retry: 2,
  });

  // Poll for conversation updates instead of subscription
  useEffect(() => {
    if (!activeConversationId) return;

    const pollInterval = setInterval(async () => {
      try {
        const conversation = await groonabackend.agents.getConversation(activeConversationId);
        if (conversation && conversation.messages) {
          setMessages(conversation.messages || []);
        }
      } catch (error) {
        console.error('[AIAssistant] Failed to poll conversation:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Monitor messages for project and task creation actions
  useEffect(() => {
    if (!messages || messages.length === 0 || !currentUser) return;

    // Get the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage || !lastAssistantMessage.content) return;

    // Check if this message contains a creation action
    const actionData = parseProjectCreationResponse(lastAssistantMessage.content);
    
    if (actionData && actionData.action === 'create_project') {
      // Check if we've already processed this message (avoid duplicate creation)
      const messageId = lastAssistantMessage.id || lastAssistantMessage._id || lastAssistantMessage.content.substring(0, 50);
      const processedKey = `project_created_${activeConversationId}_${messageId}`;
      
      if (sessionStorage.getItem(processedKey)) {
        return; // Already processed
      }

      // Mark as processing
      sessionStorage.setItem(processedKey, 'true');

      // Create the project
      const createProject = async () => {
        try {
          setIsStreaming(true);
          
          const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
            ? currentUser.active_tenant_id 
            : currentUser?.tenant_id;

          const createdProject = await createProjectFromAI(
            actionData,
            effectiveTenantId,
            currentUser.id,
            currentUser.email
          );

          // Invalidate queries to refresh project list
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          toast.success(`Project "${createdProject.name}" created successfully!`);
          
          // Navigate to project detail page
          setTimeout(() => {
            navigate(createPageUrl("ProjectDetail") + `?id=${createdProject._id || createdProject.id}`);
          }, 1500);

        } catch (error) {
          console.error('[AIAssistant] Project creation error:', error);
          toast.error(error.message || 'Failed to create project. Please try again.');
        } finally {
          setIsStreaming(false);
        }
      };

      createProject();
    } else if (actionData && actionData.action === 'create_task') {
      // Check if we've already processed this message (avoid duplicate creation)
      const messageId = lastAssistantMessage.id || lastAssistantMessage._id || lastAssistantMessage.content.substring(0, 50);
      const processedKey = `task_created_${activeConversationId}_${messageId}`;
      
      if (sessionStorage.getItem(processedKey)) {
        return; // Already processed
      }

      // Mark as processing
      sessionStorage.setItem(processedKey, 'true');

      // Create the task
      const createTask = async () => {
        try {
          setIsStreaming(true);
          
          const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
            ? currentUser.active_tenant_id 
            : currentUser?.tenant_id;

          const createdTask = await createTaskFromAI(
            actionData,
            effectiveTenantId,
            currentUser.id,
            currentUser.email
          );

          // Invalidate queries to refresh task list
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });

          toast.success(`Task "${createdTask.title}" created successfully!`);
          
          // Navigate to task detail or project page
          if (createdTask.project_id) {
            setTimeout(() => {
              navigate(createPageUrl("ProjectDetail") + `?id=${createdTask.project_id}`);
            }, 1500);
          }

        } catch (error) {
          console.error('[AIAssistant] Task creation error:', error);
          toast.error(error.message || 'Failed to create task. Please try again.');
        } finally {
          setIsStreaming(false);
        }
      };

      createTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, activeConversationId]); // Only depend on messages length to avoid infinite loops

  useEffect(() => {
    if (activeConversationId) {
      const loadConversation = async () => {
        try {
          const conversation = await groonabackend.agents.getConversation(activeConversationId);
          if (conversation) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('[AIAssistant] Loading conversation:', conversation.id);
            }
            setActiveConversation(conversation);
            setMessages(conversation.messages || []);
          } else {
            // Fallback: try to find in conversations list
            const found = conversations.find(c => c.id === activeConversationId || c._id === activeConversationId);
            if (found) {
              setActiveConversation(found);
              setMessages(found.messages || []);
            }
          }
        } catch (error) {
          console.error('[AIAssistant] Failed to load conversation:', error);
          // Fallback: try to find in conversations list
          const found = conversations.find(c => c.id === activeConversationId || c._id === activeConversationId);
          if (found) {
            setActiveConversation(found);
            setMessages(found.messages || []);
          }
        }
      };
      loadConversation();
    }
  }, [activeConversationId, conversations.length]); // Only depend on conversations.length to avoid loops

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AIAssistant] Creating new conversation...');
      }
      try {
        const conversation = await groonabackend.agents.createConversation({
          agent_name: 'project_assistant',
          metadata: {
            name: `Conversation ${new Date().toLocaleString()}`,
            created_at: new Date().toISOString(),
          }
        });
        
        if (!conversation.messages) {
          conversation.messages = [];
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AIAssistant] Conversation created:', conversation.id);
        }
        return conversation;
      } catch (error) {
        console.error('[AIAssistant] Create conversation error details:', error);
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          throw new Error('AI Agent not available. It may need to redeploy after configuration changes.');
        }
        throw error;
      }
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setActiveConversationId(conversation.id);
      setActiveConversation(conversation);
      setMessages([]);
      toast.success('New conversation started');
    },
    onError: (error) => {
      console.error('[AIAssistant] Failed to create conversation:', error);
      toast.error(error.message || 'Failed to create conversation. The AI Agent may need time to redeploy.');
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AIAssistant] Deleting conversation:', conversationId);
      }
      
      try {
        // Try to delete via API
        const response = await fetch(`${API_BASE}/api/ai-assistant/conversations/${conversationId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error('Failed to delete conversation');
        }
        
        return conversationId;
      } catch (error) {
        console.error('[AIAssistant] Delete API call failed, removing locally:', error);
        // Fallback: just remove locally
        return conversationId;
      }
    },
    onSuccess: (deletedId) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AIAssistant] Conversation deleted:', deletedId);
      }
      
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setActiveConversation(null);
        setMessages([]);
      }
      
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      refetchConversations();
      
      toast.success('Conversation deleted');
    },
    onError: (error) => {
      console.error('[AIAssistant] Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  });

  // Add ref for abort controller to stop requests
  const abortControllerRef = useRef(null);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, fileUrls }) => {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AIAssistant] Sending message to agent...');
      }
      
      try {
        let conversation = activeConversation;
        
        if (!conversation || !conversation.id) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[AIAssistant] No active conversation, creating new one...');
          }
          
          try {
            conversation = await groonabackend.agents.createConversation({
              agent_name: 'project_assistant',
              metadata: {
                name: message.substring(0, 50),
                created_at: new Date().toISOString(),
              }
            });
          } catch (createError) {
            console.error('[AIAssistant] Failed to create conversation:', createError);
            throw new Error('Could not create conversation. The AI Agent may be redeploying. Please wait a moment and try again.');
          }
          
          // CRITICAL: Initialize messages array
          conversation.messages = conversation.messages || [];
          
          setActiveConversation(conversation);
          setActiveConversationId(conversation.id);
          await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
          
          // Small delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // CRITICAL FIX: Ensure conversation has all required properties
        const safeConversation = {
          ...conversation,
          id: conversation.id,
          messages: Array.isArray(conversation.messages) ? conversation.messages : [],
          metadata: conversation.metadata || {}
        };

        if (process.env.NODE_ENV !== 'production') {
          console.log('[AIAssistant] Sending message to conversation:', {
            id: safeConversation.id,
            messagesCount: safeConversation.messages.length,
            hasMetadata: !!safeConversation.metadata
          });
        }
        
        // Use sendMessage with selected model and abort signal
        const response = await groonabackend.agents.sendMessage(
          safeConversation.id,
          {
            content: message,
            file_urls: fileUrls || undefined
          },
          selectedModel || undefined, // Pass selected model
          abortControllerRef.current?.signal // Pass abort signal
        );
        
        // Update messages from response or fetch conversation
        if (response.conversation && response.conversation.messages) {
          setMessages(response.conversation.messages);
        } else {
          // Fallback: fetch updated conversation to get messages
          const updatedConversation = await groonabackend.agents.getConversation(safeConversation.id);
          if (updatedConversation && updatedConversation.messages) {
            setMessages(updatedConversation.messages);
          }
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AIAssistant] Message sent successfully');
        }
        
        // Check if response indicates an error (quota/token exhaustion)
        if (response.error) {
          // Create error object that will be caught by onError
          const errorObj = new Error(response.message || 'Model error occurred');
          errorObj.response = { data: response }; // Structure it like axios error
          throw errorObj;
        }
        
        return { message: response.message || response.text || response };
      } catch (error) {
        console.error('[AIAssistant] Send message error details:', error);
        
        // Check if backend returned error in response (200 status with error flag)
        if (error.response?.data?.error === true || error.response?.data?.code === 'TOKENS_EXPIRED') {
          // Backend returned graceful error, re-throw so onError can handle it
          throw error;
        }
        
        // Provide user-friendly error messages for other errors
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          throw new Error('AI Agent is not available. It may be redeploying after recent updates. Please wait 30 seconds and refresh the page.');
        } else if (error.message?.includes('Network Error') || error.message?.includes('network')) {
          throw new Error('Network connection issue. Please check your connection and try again.');
        } else if (error.message?.includes('conversation')) {
          throw error; // Already has a good message
        } else {
          throw new Error(error.message || 'Failed to send message. Please try again.');
        }
      }
    },
    onSuccess: async () => {
      setIsStreaming(false);
      abortControllerRef.current = null;
      // Refresh conversations and messages
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (activeConversationId) {
        const conversation = await groonabackend.agents.getConversation(activeConversationId);
        if (conversation && conversation.messages) {
          setMessages(conversation.messages);
        }
      }
    },
    onError: (error) => {
      console.error('[AIAssistant] Send message error:', error);
      
      // Don't show error if request was aborted
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setIsStreaming(false);
        abortControllerRef.current = null;
        return;
      }
      
      // Check if response contains error flag (backend returns 200 with error flag for graceful handling)
      const errorData = error.response?.data;
      const isQuotaError = errorData?.code === 'QUOTA_EXCEEDED' || 
                          errorData?.code === 'TOKENS_EXPIRED' ||
                          errorData?.error === true ||
                          error.message?.includes('quota') ||
                          error.message?.includes('rate limit') ||
                          error.message?.includes('exceeded') ||
                          error.message?.includes('tokens');
      
      if (isQuotaError) {
        // Show toast with model name and token expiration message
        const modelName = errorData?.model || selectedModel || 'selected model';
        const displayName = availableModels.find(m => m.id === modelName)?.name || modelName;
        toast.error(`Tokens expired for ${displayName}. Please try a different model.`, {
          duration: 5000,
        });
      } else {
        toast.error(error.message || errorData?.message || 'Failed to send message. Please try again.');
      }
      
      setIsStreaming(false);
      abortControllerRef.current = null;
      
      setMessages(prev => {
        if (!Array.isArray(prev) || prev.length < 2) return prev || [];
        return prev.slice(0, -2);
      });
    }
  });

  const handleSendMessage = () => {
    const message = inputMessage.trim();
    if (!message) return;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[AIAssistant] User sending message');
    }
    
    const files = [...attachedFiles];

    setInputMessage("");
    setAttachedFiles([]);
    setIsStreaming(true);

    sendMessageMutation.mutate({ 
      message, 
      fileUrls: files.length > 0 ? files : null 
    });
  };

  const handleSuggestionClick = (text) => {
    setInputMessage(text);
  };

  const handleAction = async (actionType, data) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AIAssistant] Executing action:', actionType);
    }
    
    try {
      if (actionType === 'create_task') {
        navigate(createPageUrl("Projects"));
        toast.info('Navigate to Projects page to create the task');
      } else if (actionType === 'view_project') {
        navigate(createPageUrl("ProjectDetail") + `?id=${data.id}`);
      }
    } catch (error) {
      console.error('[AIAssistant] Action error:', error);
      toast.error('Failed to execute action');
    }
  };

  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };

  const handleDeleteConversation = (conversationId, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (!confirm('Delete this conversation? This action cannot be undone.')) {
      return;
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AIAssistant] Delete conversation requested:', conversationId);
    }
    deleteConversationMutation.mutate(conversationId);
  };

  useEffect(() => {
    if (appContext.currentUser) {
      aiService.generateSuggestions(appContext)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }
  }, [appContext]);

  if (!currentUser || !permissionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading AI Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="ai_assistant">
      <FeatureOnboarding 
        currentUser={currentUser} 
        featureArea="ai_assistant"
        userRole={userRole}
      />
      <div className="h-[calc(100vh-4rem)] flex relative overflow-hidden" data-onboarding="ai-chat">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-64 sm:w-72 md:w-80 border-r border-slate-200 bg-white/95 backdrop-blur-xl flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        max-h-[calc(100vh-4rem)]
      `}>
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-2">
          <Button
            onClick={handleNewConversation}
            disabled={createConversationMutation.isPending}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {createConversationMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            <span className="hidden sm:inline">New Conversation</span>
            <span className="sm:hidden">New</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-slate-300" />
              <p>No conversations yet</p>
              <p className="text-xs mt-1">Start a new one!</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const convId = conv.id || conv._id;
              return (
                <div
                  key={convId}
                  className={`group p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all ${
                    activeConversationId === convId
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  onClick={() => {
                    setActiveConversationId(convId);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {conv.metadata?.name || conv.title || 'Untitled Conversation'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {conv.messages?.length || 0} messages
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(convId, e);
                      }}
                      disabled={deleteConversationMutation.isPending}
                    >
                      {deleteConversationMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin text-red-600" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-red-600 hover:text-red-700" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 min-w-0 overflow-hidden max-h-[calc(100vh-4rem)]">
        <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 truncate">
                AI Assistant
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 hidden sm:block">
                Your intelligent project management companion
              </p>
            </div>
            {conversations.length === 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 hidden md:flex">
                Agent may be redeploying...
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto">
              <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 mb-4 sm:mb-6">
                <CardContent className="p-4 sm:p-6 md:p-8 text-center">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-blue-500/25">
                    <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
                    Welcome to AI Assistant
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">
                    I can help you manage projects, analyze data, create tasks, and much more. 
                    Ask me anything or try one of the suggestions below!
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500">
                    <Badge variant="outline" className="text-xs">Project Management</Badge>
                    <Badge variant="outline" className="text-xs">Task Creation</Badge>
                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">Analytics</Badge>
                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">Team Insights</Badge>
                  </div>
                </CardContent>
              </Card>

              <ConversationSuggestions
                suggestions={suggestions}
                onSelect={handleSuggestionClick}
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
              {messages.map((message, idx) => {
                // Only show streaming indicator if this is the last message, it's an assistant message, and we're streaming
                const isLastMessage = idx === messages.length - 1;
                const isStreamingThisMessage = isStreaming && isLastMessage && message.role === 'assistant';
                return (
                  <EnhancedMessageBubble
                    key={`${message.id || idx}-${message.content?.substring(0, 20)}`}
                    message={message}
                    onAction={handleAction}
                    isStreaming={isStreamingThisMessage}
                  />
                );
              })}
              {/* Show separate loading indicator when waiting for assistant response (last message is user) */}
              {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3 justify-start">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[85%] min-w-0">
                    <div className="rounded-2xl px-4 py-2.5 bg-white border border-slate-200">
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 md:p-6 border-t border-slate-200 bg-white/80 backdrop-blur-xl flex-shrink-0">
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 space-y-2 min-w-0 w-full sm:w-auto">
                <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all w-full min-h-[48px] sm:min-h-[52px]">
                  {/* Model Selection - Integrated in input container */}
                  {availableModels.length > 0 && (
                    <div className="pl-2 sm:pl-3 flex-shrink-0 border-r border-slate-200 pr-2 sm:pr-3">
                      <Select
                        value={selectedModel || availableModels[0]?.id}
                        onValueChange={(value) => setSelectedModel(value)}
                        disabled={sendMessageMutation.isPending || isStreaming}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 focus:ring-0 focus:ring-offset-0 w-[110px] sm:w-[130px] font-medium text-slate-700 hover:text-slate-900 [&>svg]:h-3 [&>svg]:w-3">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {availableModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <span className="text-xs font-medium">{model.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask me anything..."
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base flex-1 min-w-0 py-3"
                    disabled={sendMessageMutation.isPending || isStreaming}
                  />
                  <div className="pr-1 sm:pr-2 flex-shrink-0">
                    <FileUploadButton 
                      onFilesUploaded={setAttachedFiles}
                      disabled={sendMessageMutation.isPending || isStreaming}
                    />
                  </div>
                </div>
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {attachedFiles.map((url, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        File {idx + 1}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {sendMessageMutation.isPending || isStreaming ? (
                <Button
                  onClick={() => {
                    // Stop the request
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                      abortControllerRef.current = null;
                    }
                    setIsStreaming(false);
                    sendMessageMutation.reset();
                  }}
                  className="bg-red-500 hover:bg-red-600 h-10 sm:h-12 px-3 sm:px-6 flex-shrink-0 w-full sm:w-auto"
                >
                  <Square className="h-4 w-4 sm:h-5 sm:w-5 fill-white" />
                  <span className="hidden sm:inline ml-2">Stop</span>
                </Button>
              ) : (
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-10 sm:h-12 px-3 sm:px-6 flex-shrink-0 w-full sm:w-auto"
                >
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline ml-2">Send</span>
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center hidden sm:block break-words">
              AI Assistant can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
      </div>
    </OnboardingProvider>
  );
}

