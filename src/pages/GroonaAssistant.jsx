import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import EnhancedMessageBubble from "../components/ai/EnhancedMessageBubble";
import ConversationSuggestions from "../components/ai/ConversationSuggestions";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useHasPermission } from "../components/shared/usePermissions";
import { createProjectFromAI, parseProjectCreationResponse } from "../services/aiProjectService";
import { createTaskFromAI } from "../services/aiTaskService";
import { API_BASE } from "../api/groonabackend";

const API_URL = `${API_BASE}/api`;

// Whitelist of working models - STRICT matching patterns (case-insensitive)
// These patterns must appear in the model name or ID
const WORKING_MODELS_PATTERNS = [
  'devstral-2-2512',
  'devstral 2 2512',
  'mimo-v2',
  'mimo v2',
  'kat-coder-pro',
  'kat coder pro',
  'deepseek-r1-0528',
  'deepseek r1 0528',
  'deepseek-r1t-chimera',
  'deepseek r1t chimera',
  'deepseek-r1t2-chimera',
  'deepseek r1t2 chimera',
  'r1t-chimera',
  'r1t chimera',
  'trinity-mini',
  'trinity mini',
  'gemma-3-27b',
  'gemma 3 27b',
  'llama-3.2-3b-instruct',
  'llama 3.2 3b instruct',
  'llama-3.3-70b-instruct',
  'llama 3.3 70b instruct',
  'hermes-3-405b-instruct',
  'hermes 3 405b instruct',
  'glm-4.5-air',
  'glm 4.5 air',
  'mistral-small-3.1-24b',
  'mistral small 3.1 24b',
  'nemotron-nano-12b-2-vl',
  'nemotron nano 12b 2 vl',
  'qwen3-4b',
  'qwen3 4b',
  'mistral-7b-instruct',
  'mistral 7b instruct',
  'venice-uncensored',
  'venice uncensored'
];

// Helper function to check if a model matches the whitelist (STRICT matching)
const isModelWhitelisted = (model) => {
  if (!model || !model.name || !model.id) return false;
  
  const modelNameLower = model.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
  const modelIdLower = model.id.toLowerCase();
  
  // STRICT: Check if model name or ID contains EXACT pattern match
  // Must match one of the patterns exactly (allowing for variations in separators)
  return WORKING_MODELS_PATTERNS.some(pattern => {
    const patternLower = pattern.toLowerCase();
    // Normalize separators for comparison
    const normalizedName = modelNameLower.replace(/[-_\s]+/g, ' ');
    const normalizedId = modelIdLower.replace(/[-_\s]+/g, ' ');
    const normalizedPattern = patternLower.replace(/[-_\s]+/g, ' ');
    
    // Check if normalized strings contain the pattern
    return normalizedName.includes(normalizedPattern) || normalizedId.includes(normalizedPattern);
  });
};

// Helper to get auth token
const getToken = () => localStorage.getItem('auth_token');

// Helper to create fetch options with auth
const getFetchOptions = (method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  };
  
  const token = getToken();
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return options;
};

export default function GroonaAssistant() {
  const [currentUser, setCurrentUser] = useState(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [appContext, setAppContext] = useState({});
  const [suggestions, setSuggestions] = useState([
    { text: "Create a new project", icon: "Plus" },
    { text: "Create a task", icon: "Target" }
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const processingTaskRef = useRef(false);
  const processingProjectRef = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const justAddedMessageRef = useRef(false); // Track if we just added a message ourselves
  const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll

  const canUseAI = useHasPermission('can_use_ai_assistant');

  // Fetch available OpenRouter models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_URL}/groona-assistant/models`, getFetchOptions());
        const data = await response.json();
        if (data.success && data.models && data.models.length > 0) {
          // STRICT FILTER: Only show whitelisted working models (backend should already filter, but double-check)
          const filteredModels = data.models.filter(m => {
            // Additional frontend filter for safety
            if (!m || !m.id || !m.name) return false;
            return isModelWhitelisted(m);
          });
          
          console.log(`[GroonaAssistant] Filtered ${filteredModels.length} whitelisted models from ${data.models.length} received`);
          
          setAvailableModels(filteredModels);
          // Set default model if not already set
          if (!selectedModel && filteredModels.length > 0) {
            const defaultModel = filteredModels.find(m => 
              m.id.toLowerCase().includes('llama-3.2') || 
              m.name.toLowerCase().includes('llama 3.2')
            ) || filteredModels[0];
            setSelectedModel(defaultModel.id);
          }
        } else {
          // No models returned - clear the list
          setAvailableModels([]);
          console.warn('[GroonaAssistant] No models returned from backend');
        }
      } catch (error) {
        console.error('[GroonaAssistant] Error fetching models:', error);
        toast.error('Failed to load models');
        setAvailableModels([]);
      }
    };
    
    fetchModels();
  }, []);

  useEffect(() => {
    // Set permission checked immediately to show page structure
    setPermissionChecked(true);
    
    groonabackend.auth.me()
      .then(user => {
        setCurrentUser(user);
        // Restore last active conversation from localStorage
        const savedConversationId = localStorage.getItem(`groona_active_conversation_${user.id}`);
        if (savedConversationId) {
          setActiveConversationId(savedConversationId);
        }
      })
      .catch(() => {
        setCurrentUser(null);
      });
  }, []);

  useEffect(() => {
    if (permissionChecked && currentUser) {
      if (!currentUser.is_super_admin && !canUseAI) {
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
    placeholderData: (previousData) => previousData,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date', 20) || [];
    },
    enabled: !!currentUser && !!effectiveTenantId,
    placeholderData: (previousData) => previousData,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId) || [];
    },
    enabled: !!currentUser && !!effectiveTenantId,
    placeholderData: (previousData) => previousData,
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

  // Fetch conversations
  const { data: conversations = [], refetch: refetchConversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['groona-conversations'],
    queryFn: async () => {
      try {
        const user = await groonabackend.auth.me();
        const tenantQuery = user.tenant_id ? `&tenant_id=${user.tenant_id}` : '';
        const res = await fetch(`${API_URL}/groona-assistant/conversations?user_id=${user.id}${tenantQuery}`, getFetchOptions());
        const convos = await res.json();
        return convos || [];
      } catch (error) {
        console.error('[GroonaAssistant] Failed to load conversations:', error);
        return [];
      }
    },
    enabled: !!currentUser,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });

  // Save active conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (currentUser && activeConversationId) {
      localStorage.setItem(`groona_active_conversation_${currentUser.id}`, activeConversationId);
    }
  }, [activeConversationId, currentUser]);

  // Load conversation messages and restore project IDs from localStorage
  useEffect(() => {
    if (activeConversationId && conversations.length > 0) {
      const loadConversation = async () => {
        try {
          const found = conversations.find(c => c.id === activeConversationId || c._id === activeConversationId);
          if (found) {
            setActiveConversation(found);
            let conversationMessages = found.messages || [];
            
            // Restore project IDs and task IDs from localStorage for messages that created projects/tasks
            conversationMessages = conversationMessages.map(msg => {
              if (msg.role === 'assistant' && msg.content) {
                try {
                  const parsed = JSON.parse(msg.content);
                  const conversationKey = activeConversationId || 'new';
                  
                  if (parsed.action === 'create_project') {
                    const messageId = msg.id || msg._id;
                    const projectNameHash = parsed.project_name ? 
                      btoa(parsed.project_name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : '';
                    
                    // Try multiple keys for redundancy
                    const processedKey = `groona_project_created_${conversationKey}_${messageId || 'no_id'}_${projectNameHash}`;
                    const projectNameKey = `groona_project_name_${conversationKey}_${projectNameHash}`;
                    
                    // Check both keys
                    let storedData = localStorage.getItem(processedKey);
                    if (!storedData) {
                      storedData = localStorage.getItem(projectNameKey);
                    }
                    
                    if (storedData) {
                      try {
                        const data = JSON.parse(storedData);
                        // Only use if it has a valid projectId (not just "processing")
                        if (data.projectId && data.projectId !== 'processing') {
                          return { ...msg, createdProjectId: data.projectId };
                        }
                      } catch (e) {
                        console.error('[GroonaAssistant] Error parsing stored project data:', e);
                      }
                    }
                  } else if (parsed.action === 'create_task') {
                    const messageId = msg.id || msg._id;
                    const taskTitleHash = parsed.title ? 
                      btoa(parsed.title).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : '';
                    const taskProjectHash = parsed.project_name ? 
                      btoa(parsed.project_name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) : '';
                    
                    // Try multiple keys for redundancy
                    const processedKey = `groona_task_created_${conversationKey}_${messageId || 'no_id'}_${taskTitleHash}_${taskProjectHash}`;
                    const taskTitleKey = `groona_task_title_${conversationKey}_${taskTitleHash}`;
                    
                    // Check both keys
                    let storedData = localStorage.getItem(processedKey);
                    if (!storedData) {
                      storedData = localStorage.getItem(taskTitleKey);
                    }
                    
                    if (storedData) {
                      try {
                        const data = JSON.parse(storedData);
                        // Only use if it has a valid taskId (not just "processing")
                        if (data.taskId && data.taskId !== 'processing') {
                          return { 
                            ...msg, 
                            createdTaskId: data.taskId,
                            createdTaskProjectId: data.projectId || data.project_id || null
                          };
                        }
                      } catch (e) {
                        console.error('[GroonaAssistant] Error parsing stored task data:', e);
                      }
                    }
                  }
                } catch (e) {
                  // Not JSON, continue
                }
              }
              return msg;
            });
            
            // CRITICAL: Always preserve user messages from current state, even during refetches
            // Only update messages if we're not currently streaming and we didn't just add a message ourselves
            if (!isStreaming && !justAddedMessageRef.current) {
              setMessages(prev => {
                console.log('[GroonaAssistant] Loading conversation messages. Prev count:', prev.length, 'Conversation count:', conversationMessages.length);
                
                // CRITICAL: ALWAYS preserve ALL user messages from prev
                // User messages are added optimistically and might not be in backend yet
                const allUserMessagesFromPrev = prev.filter(msg => msg.role === 'user');
                console.log('[GroonaAssistant] User messages in prev:', allUserMessagesFromPrev.length);
                
                // Find user messages in prev that are NOT in conversationMessages (pending messages)
                const pendingUserMessages = allUserMessagesFromPrev.filter(prevUserMsg => {
                  const existsInConversation = conversationMessages.some(convMsg => 
                    convMsg.role === 'user' && 
                    convMsg.content === prevUserMsg.content &&
                    Math.abs(new Date(convMsg.created_at || 0) - new Date(prevUserMsg.created_at || 0)) < 10000 // Within 10 seconds
                  );
                  return !existsInConversation;
                });
                
                console.log('[GroonaAssistant] Pending user messages (not in conversation yet):', pendingUserMessages.length);
                
                // ALWAYS merge conversation messages with pending user messages
                // This ensures user messages are never lost
                const allMessages = [...conversationMessages];
                
                // Add pending user messages, maintaining chronological order
                pendingUserMessages.forEach(pendingMsg => {
                  // Find the right position to insert (before its corresponding assistant response if exists)
                  const pendingTime = new Date(pendingMsg.created_at || 0).getTime();
                  let insertIndex = allMessages.length;
                  
                  for (let i = 0; i < allMessages.length; i++) {
                    const msgTime = new Date(allMessages[i].created_at || 0).getTime();
                    if (msgTime > pendingTime && allMessages[i].role === 'assistant') {
                      insertIndex = i;
                      break;
                    }
                  }
                  
                  allMessages.splice(insertIndex, 0, pendingMsg);
                });
                
                // Sort all messages by timestamp to ensure correct order
                allMessages.sort((a, b) => {
                  const timeA = new Date(a.created_at || 0).getTime();
                  const timeB = new Date(b.created_at || 0).getTime();
                  return timeA - timeB;
                });
                
                // Preserve local properties from prev (like createdProjectId, createdTaskId, _isPending)
                const merged = allMessages.map(msg => {
                  const prevMsg = prev.find(p => 
                    p.role === msg.role && 
                    p.content === msg.content &&
                    Math.abs(new Date(p.created_at || 0) - new Date(msg.created_at || 0)) < 10000
                  );
                  if (prevMsg) {
                    // Preserve all local properties
                    return { ...msg, ...prevMsg };
                  }
                  return msg;
                });
                
                console.log('[GroonaAssistant] Final merged messages count:', merged.length, merged.map(m => ({ role: m.role, content: m.content?.substring(0, 30) })));
                return merged;
              });
            } else {
              console.log('[GroonaAssistant] Skipping message update - isStreaming:', isStreaming, 'justAddedMessage:', justAddedMessageRef.current);
            }
            // If conversation has messages, mark as started
            if (conversationMessages.length > 0) {
              setHasStartedConversation(true);
            }
          } else {
            // Conversation not found - might have been deleted, clear from localStorage
            if (currentUser) {
              localStorage.removeItem(`groona_active_conversation_${currentUser.id}`);
            }
          }
        } catch (error) {
          console.error('[GroonaAssistant] Failed to load conversation:', error);
        }
      };
      loadConversation();
    } else if (!activeConversationId && conversations.length > 0) {
      // No active conversation, but we have conversations - try to restore last one
      const savedConversationId = currentUser ? localStorage.getItem(`groona_active_conversation_${currentUser.id}`) : null;
      if (savedConversationId) {
        const found = conversations.find(c => c.id === savedConversationId || c._id === savedConversationId);
        if (found) {
          setActiveConversationId(savedConversationId);
        }
      }
    } else if (!activeConversationId) {
      // Reset when no active conversation and no saved conversation
      setHasStartedConversation(false);
    }
  }, [activeConversationId, conversations, isStreaming, currentUser]);

  // Auto-scroll function - checks if user is near bottom before scrolling
  const scrollToBottom = (force = false) => {
    if (!chatContainerRef.current || !messagesEndRef.current) return;
    
    const container = chatContainerRef.current;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    
    // Check if user is near bottom (within 200px) or if forced
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    
    if (force || isNearBottom || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      shouldAutoScrollRef.current = true;
    }
  };

  // Scroll when messages change (triggers when new messages are added)
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Scroll when streaming state changes and continuously during typewriter effect
  useEffect(() => {
    if (isStreaming || messages.length > 0) {
      // Scroll continuously when streaming or when we have messages (to catch typewriter effect)
      const interval = setInterval(() => {
        scrollToBottom();
      }, 250); // Scroll every 250ms for smooth typewriter scrolling
      
      // Also scroll immediately when streaming starts
      if (isStreaming) {
        setTimeout(() => scrollToBottom(true), 50);
      }
      
      return () => clearInterval(interval);
    }
  }, [isStreaming, messages.length]);

  // Track user scroll to detect manual scrolling
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      
      // Update shouldAutoScroll based on scroll position
      shouldAutoScrollRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Monitor messages for project and task creation actions
  useEffect(() => {
    if (!messages || messages.length === 0 || !currentUser) return;
    if (isStreaming) return; // Don't process while streaming

    // Get the last assistant message (must be the absolute last message in the array)
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.content) return;
    
    const lastAssistantMessage = lastMessage;

    const actionData = parseProjectCreationResponse(lastAssistantMessage.content);
    
    if (actionData && actionData.action === 'create_project') {
      // STRICT DUPLICATE PREVENTION - Multiple layers of protection
      
      // Layer 1: Check if project creation is already in progress
      if (processingProjectRef.current) {
        console.log('[GroonaAssistant] Project creation already in progress, skipping...');
        return;
      }

      // Layer 2: Create highly unique key using conversation ID + message ID + project name hash
      const messageId = lastAssistantMessage.id || lastAssistantMessage._id;
      const projectNameHash = actionData.project_name ? 
        btoa(actionData.project_name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : '';
      const conversationKey = activeConversationId || 'new';
      
      // Create multiple keys for redundancy
      const processedKey = `groona_project_created_${conversationKey}_${messageId || 'no_id'}_${projectNameHash}`;
      const projectNameKey = `groona_project_name_${conversationKey}_${projectNameHash}`;
      
      // Layer 3: Check localStorage for existing project (persists across sessions)
      const existingProjectData = localStorage.getItem(processedKey);
      const existingProjectByName = localStorage.getItem(projectNameKey);
      
      if (existingProjectData || existingProjectByName) {
        try {
          const storedData = existingProjectData ? JSON.parse(existingProjectData) : 
                           (existingProjectByName ? JSON.parse(existingProjectByName) : null);
          
          if (storedData && storedData.projectId) {
            const { projectId, projectName } = storedData;
            console.log('[GroonaAssistant] Project already created (from storage):', projectName, 'ID:', projectId);
            
            // Update message with project ID for button display
            if (!lastAssistantMessage.createdProjectId) {
              setMessages(prev => prev.map(msg => 
                (msg.id === lastAssistantMessage.id || msg._id === lastAssistantMessage._id) 
                  ? { ...msg, createdProjectId: projectId }
                  : msg
              ));
            }
          }
        } catch (e) {
          console.error('[GroonaAssistant] Error parsing stored project data:', e);
        }
        return; // STRICTLY prevent duplicate creation
      }
      
      // Layer 4: Check if project with same name already exists in database
      const checkExistingProject = async () => {
        try {
          const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
            ? currentUser.active_tenant_id 
            : currentUser?.tenant_id;
          
          if (!effectiveTenantId || !actionData.project_name) return false;
          
          // Check if project with same name exists
          const existingProjects = await groonabackend.entities.Project.filter({
            tenant_id: effectiveTenantId,
            name: actionData.project_name
          });
          
          if (existingProjects && existingProjects.length > 0) {
            const existingProject = existingProjects[0];
            const projectId = existingProject.id || existingProject._id;
            console.log('[GroonaAssistant] Project with same name already exists in database:', projectId);
            
            // Store in localStorage to prevent future attempts
            localStorage.setItem(processedKey, JSON.stringify({
              projectId,
              projectName: existingProject.name,
              timestamp: Date.now(),
              source: 'database_check'
            }));
            localStorage.setItem(projectNameKey, JSON.stringify({
              projectId,
              projectName: existingProject.name,
              timestamp: Date.now()
            }));
            
            // Update message with project ID
            setMessages(prev => prev.map(msg => 
              (msg.id === lastAssistantMessage.id || msg._id === lastAssistantMessage._id) 
                ? { ...msg, createdProjectId: projectId }
                : msg
            ));
            
            return true; // Project exists
          }
          return false; // Project doesn't exist
        } catch (error) {
          console.error('[GroonaAssistant] Error checking existing project:', error);
          return false; // Continue with creation if check fails
        }
      };
      
      // Mark as processing IMMEDIATELY (before any async operations)
      processingProjectRef.current = true;
      localStorage.setItem(processedKey, JSON.stringify({ processing: true, timestamp: Date.now() }));

      const createProject = async () => {
        try {
          // First check if project already exists
          const projectExists = await checkExistingProject();
          if (projectExists) {
            console.log('[GroonaAssistant] Project already exists, skipping creation');
            toast.info('Project already exists. Use "View Project" button to access it.');
            return;
          }
          
          setIsStreaming(true);
          const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
            ? currentUser.active_tenant_id 
            : currentUser?.tenant_id;

          console.log('[GroonaAssistant] Creating new project:', actionData.project_name);
          const createdProject = await createProjectFromAI(
            actionData,
            effectiveTenantId,
            currentUser.id,
            currentUser.email
          );

          const projectId = createdProject._id || createdProject.id;
          
          // Store project ID in localStorage with multiple keys (persists across sessions)
          const projectData = {
            projectId,
            projectName: createdProject.name,
            timestamp: Date.now(),
            source: 'newly_created'
          };
          
          localStorage.setItem(processedKey, JSON.stringify(projectData));
          localStorage.setItem(projectNameKey, JSON.stringify(projectData));

          // Update message with project ID for button display
          setMessages(prev => prev.map(msg => 
            (msg.id === lastAssistantMessage.id || msg._id === lastAssistantMessage._id) 
              ? { ...msg, createdProjectId: projectId }
              : msg
          ));

          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          toast.success(`Project "${createdProject.name}" created successfully!`);
          // NO AUTO-REDIRECT - user can click "View Project" button instead

        } catch (error) {
          console.error('[GroonaAssistant] Project creation error:', error);
          toast.error(error.message || 'Failed to create project. Please try again.');
          // Remove processing flag on error
          localStorage.removeItem(processedKey);
          localStorage.removeItem(projectNameKey);
        } finally {
          setIsStreaming(false);
          processingProjectRef.current = false;
        }
      };

      createProject();
    } else if (actionData && actionData.action === 'create_task') {
      // STRICT DUPLICATE PREVENTION - Multiple layers of protection (same as projects)
      
      // Layer 1: Check if task creation is already in progress
      if (processingTaskRef.current) {
        console.log('[GroonaAssistant] Task creation already in progress, skipping...');
        return;
      }

      // Layer 2: Create highly unique key using conversation ID + message ID + task details hash
      const messageId = lastAssistantMessage.id || lastAssistantMessage._id;
      const taskTitleHash = actionData.title ? 
        btoa(actionData.title).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : '';
      const taskProjectHash = actionData.project_name ? 
        btoa(actionData.project_name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) : '';
      const conversationKey = activeConversationId || 'new';
      
      // Create multiple keys for redundancy
      const processedKey = `groona_task_created_${conversationKey}_${messageId || 'no_id'}_${taskTitleHash}_${taskProjectHash}`;
      const taskTitleKey = `groona_task_title_${conversationKey}_${taskTitleHash}`;
      
      // Layer 3: Check localStorage for existing task (persists across sessions)
      const existingTaskData = localStorage.getItem(processedKey);
      const existingTaskByTitle = localStorage.getItem(taskTitleKey);
      
      if (existingTaskData || existingTaskByTitle) {
        try {
          const storedData = existingTaskData ? JSON.parse(existingTaskData) : 
                           (existingTaskByTitle ? JSON.parse(existingTaskByTitle) : null);
          
          if (storedData && storedData.taskId) {
            const { taskId, taskTitle } = storedData;
            console.log('[GroonaAssistant] Task already created (from storage):', taskTitle, 'ID:', taskId);
            
            // Update message with task ID for button display (try to get project ID)
            if (!lastAssistantMessage.createdTaskId) {
              // Try to get project ID from the stored task data
              let taskProjectId = null;
              try {
                const storedData = existingTaskData ? JSON.parse(existingTaskData) : 
                                 (existingTaskByTitle ? JSON.parse(existingTaskByTitle) : null);
                taskProjectId = storedData?.projectId || storedData?.project_id || null;
              } catch (e) {
                // Ignore parsing errors
              }
              
              setMessages(prev => prev.map(msg => 
                (msg.id === lastAssistantMessage.id || msg._id === lastAssistantMessage._id) 
                  ? { 
                      ...msg, 
                      createdTaskId: taskId,
                      createdTaskProjectId: taskProjectId
                    }
                  : msg
              ));
            }
          }
        } catch (e) {
          console.error('[GroonaAssistant] Error parsing stored task data:', e);
        }
        return; // STRICTLY prevent duplicate creation
      }
      
      // Layer 4: Check if task with same title and project already exists in database
      const checkExistingTask = async () => {
        try {
          const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
            ? currentUser.active_tenant_id 
            : currentUser?.tenant_id;
          
          if (!effectiveTenantId || !actionData.title) return false;
          
          // Get project ID if project name is provided
          let projectId = null;
          if (actionData.project_name) {
            const projects = await groonabackend.entities.Project.filter({
              tenant_id: effectiveTenantId,
              name: actionData.project_name
            });
            if (projects && projects.length > 0) {
              projectId = projects[0].id || projects[0]._id;
            }
          }
          
          // Check if task with same title exists in the same project
          const taskFilter = {
            tenant_id: effectiveTenantId,
            title: actionData.title
          };
          if (projectId) {
            taskFilter.project_id = projectId;
          }
          
          const existingTasks = await groonabackend.entities.Task.filter(taskFilter);
          
          if (existingTasks && existingTasks.length > 0) {
            const existingTask = existingTasks[0];
            const taskId = existingTask.id || existingTask._id;
            console.log('[GroonaAssistant] Task with same title already exists in database:', taskId);
            
            // Store in localStorage to prevent future attempts
            localStorage.setItem(processedKey, JSON.stringify({
              taskId,
              taskTitle: existingTask.title,
              timestamp: Date.now(),
              source: 'database_check'
            }));
            localStorage.setItem(taskTitleKey, JSON.stringify({
              taskId,
              taskTitle: existingTask.title,
              timestamp: Date.now()
            }));
            
            // Update message with task ID (try to get project ID from task)
            const taskProjectId = existingTask.project_id || existingTask.projectId || null;
            setMessages(prev => prev.map(msg => 
              (msg.id === lastAssistantMessage.id || msg._id === lastAssistantMessage._id) 
                ? { 
                    ...msg, 
                    createdTaskId: taskId,
                    createdTaskProjectId: taskProjectId
                  }
                : msg
            ));
            
            return true; // Task exists
          }
          return false; // Task doesn't exist
        } catch (error) {
          console.error('[GroonaAssistant] Error checking existing task:', error);
          return false; // Continue with creation if check fails
        }
      };
      
      // Mark as processing IMMEDIATELY (before any async operations)
      processingTaskRef.current = true;
      localStorage.setItem(processedKey, JSON.stringify({ processing: true, timestamp: Date.now() }));

      const createTask = async () => {
        try {
          // First check if task already exists
          const taskExists = await checkExistingTask();
          if (taskExists) {
            console.log('[GroonaAssistant] Task already exists, skipping creation');
            toast.info('Task already exists. Use "View Task" button to access it.');
            return;
          }
          
          setIsStreaming(true);
          const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
            ? currentUser.active_tenant_id 
            : currentUser?.tenant_id;

          console.log('[GroonaAssistant] Creating new task:', actionData.title);
          const createdTask = await createTaskFromAI(
            actionData,
            effectiveTenantId,
            currentUser.id,
            currentUser.email
          );

          const taskId = createdTask._id || createdTask.id;
          const projectId = createdTask.project_id || createdTask.projectId || null;
          
          // Store task ID in localStorage with multiple keys (persists across sessions)
          const taskData = {
            taskId,
            taskTitle: createdTask.title,
            projectId: projectId,
            project_id: projectId, // Store both formats for compatibility
            timestamp: Date.now(),
            source: 'newly_created'
          };
          
          localStorage.setItem(processedKey, JSON.stringify(taskData));
          localStorage.setItem(taskTitleKey, JSON.stringify(taskData));

          // Update message with task ID and project ID for button display
          setMessages(prev => prev.map(msg => 
            (msg.id === lastAssistantMessage.id || msg._id === lastAssistantMessage._id) 
              ? { 
                  ...msg, 
                  createdTaskId: taskId,
                  createdTaskProjectId: projectId
                }
              : msg
          ));

          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });

          toast.success(`Task "${createdTask.title}" created successfully!`);
          // NO AUTO-REDIRECT - user can click "View Task" button instead

        } catch (error) {
          console.error('[GroonaAssistant] Task creation error:', error);
          toast.error(error.message || 'Failed to create task. Please try again.');
          // Remove processing flag on error
          localStorage.removeItem(processedKey);
          localStorage.removeItem(taskTitleKey);
        } finally {
          setIsStreaming(false);
          processingTaskRef.current = false;
        }
      };

      createTask();
    }
  }, [messages.length, activeConversationId, currentUser, navigate, queryClient]);

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      try {
        const user = await groonabackend.auth.me();
        const response = await fetch(`${API_URL}/groona-assistant/conversations`, getFetchOptions('POST', {
          user_id: user.id,
          tenant_id: user.tenant_id,
          title: `Groona Conversation ${new Date().toLocaleString()}`,
          metadata: {
            name: `Conversation ${new Date().toLocaleString()}`,
            created_at: new Date().toISOString(),
          }
        }));
        const conversation = await response.json();
        if (!conversation.messages) {
          conversation.messages = [];
        }
        return conversation;
      } catch (error) {
        console.error('[GroonaAssistant] Create conversation error:', error);
        throw error;
      }
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['groona-conversations'] });
      const newConversationId = conversation.id || conversation._id;
      setActiveConversationId(newConversationId);
      setActiveConversation(conversation);
      setMessages([]);
      setHasStartedConversation(false); // Reset when creating new conversation
      // Save new conversation to localStorage
      if (currentUser) {
        localStorage.setItem(`groona_active_conversation_${currentUser.id}`, newConversationId);
      }
      toast.success('New conversation started');
    },
    onError: (error) => {
      console.error('[GroonaAssistant] Failed to create conversation:', error);
      toast.error(error.message || 'Failed to create conversation');
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message }) => {
      // Mark conversation as started
      setHasStartedConversation(true);
      
      // CRITICAL: Add user message IMMEDIATELY and ensure it stays visible
      // Use a synchronous state update to ensure it renders immediately
      const userMessage = { 
        role: 'user', 
        content: message, 
        created_at: new Date(),
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique ID to prevent overwrites
        _isPending: true // Flag to mark as pending (not yet saved to backend)
      };
      
      // CRITICAL: Add user message IMMEDIATELY using flushSync for synchronous update
      // This ensures the message appears in the UI before any async operations
      setMessages(prev => {
        // Check if this exact message already exists to prevent duplicates
        const alreadyExists = prev.some(msg => 
          msg.role === 'user' && 
          msg.content === message && 
          Math.abs(new Date(msg.created_at || 0) - new Date(userMessage.created_at || 0)) < 1000 // Within 1 second
        );
        if (alreadyExists) {
          console.log('[GroonaAssistant] User message already exists, skipping duplicate');
          return prev; // Don't add duplicate
        }
        console.log('[GroonaAssistant] Adding user message immediately:', message);
        const updated = [...prev, userMessage];
        console.log('[GroonaAssistant] Total messages after adding user:', updated.length, updated.map(m => ({ role: m.role, content: m.content?.substring(0, 30) })));
        return updated;
      });
      
      // Set streaming state AFTER user message is added to state
      // This ensures user message renders before floating dots appear
      setIsStreaming(true);
      
      // Set flag to prevent message overwrite
      justAddedMessageRef.current = true;
      
      let conversation = activeConversation;
      let conversationId = activeConversationId;
      
      // Check if we have an active conversation ID first
      if (conversationId && !conversation) {
        // Try to find the conversation from the list
        const user = await groonabackend.auth.me();
        const tenantQuery = user.tenant_id ? `&tenant_id=${user.tenant_id}` : '';
        const convosRes = await fetch(`${API_URL}/groona-assistant/conversations?user_id=${user.id}${tenantQuery}`, getFetchOptions());
        const convos = await convosRes.json();
        conversation = convos.find(c => (c.id === conversationId || c._id === conversationId));
      }
      
      // Only create a new conversation if we don't have one
      if (!conversationId && (!conversation || !(conversation.id || conversation._id))) {
        const user = await groonabackend.auth.me();
        const response = await fetch(`${API_URL}/groona-assistant/conversations`, getFetchOptions('POST', {
          user_id: user.id,
          tenant_id: user.tenant_id,
          title: message.substring(0, 50),
          metadata: {
            name: message.substring(0, 50),
            created_at: new Date().toISOString(),
          }
        }));
        conversation = await response.json();
        conversation.messages = conversation.messages || [];
        conversationId = conversation.id || conversation._id;
        setActiveConversation(conversation);
        setActiveConversationId(conversationId);
        setHasStartedConversation(true); // Mark as started when creating new conversation during send
        await queryClient.invalidateQueries({ queryKey: ['groona-conversations'] });
      } else if (conversationId && !conversation) {
        // If we have an ID but couldn't find the conversation, use the ID directly
        conversation = { id: conversationId, _id: conversationId };
      } else if (conversation) {
        // Ensure we have the conversation ID
        conversationId = conversation.id || conversation._id || conversationId;
      }

      const user = await groonabackend.auth.me();
      const response = await fetch(`${API_URL}/groona-assistant/chat`, getFetchOptions('POST', {
        conversation_id: conversationId,
        content: message,
        model: selectedModel || availableModels[0]?.id,
        user_id: user.id,
        tenant_id: user.tenant_id
      }));

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const result = await response.json();
      
      // Check if response contains action data (from backend)
      const actionData = result.action || null;
      
      // Add assistant response to messages (user message already added above)
      setMessages(prev => {
        console.log('[GroonaAssistant] Adding assistant response. Current messages:', prev.length, prev.map(m => ({ role: m.role, content: m.content?.substring(0, 30) })));
        
        // Check if assistant message already exists to prevent duplicates
        const assistantMessage = { 
          role: 'assistant', 
          content: result.message, // Clean message from backend
          created_at: new Date(), // Fresh timestamp for new messages
          action: actionData, // Action data for rendering custom UI
          id: `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Unique ID
        };
        
        // Check if this exact assistant message already exists (check last few messages)
        const recentMessages = prev.slice(-5); // Check last 5 messages
        const alreadyExists = recentMessages.some(msg => 
          msg.role === 'assistant' && 
          msg.content === result.message &&
          Math.abs(new Date(msg.created_at || 0) - new Date(assistantMessage.created_at || 0)) < 2000 // Within 2 seconds
        );
        
        if (alreadyExists) {
          // Message already exists, don't add again
          console.log('[GroonaAssistant] Assistant message already exists, skipping duplicate');
          return prev;
        }
        
        // CRITICAL: Ensure user message is in the list before adding assistant response
        // Check if user message exists
        const userMessageExists = prev.some(msg => 
          msg.role === 'user' && 
          msg.content === message &&
          Math.abs(new Date(msg.created_at || 0) - new Date(userMessage.created_at || 0)) < 10000 // Within 10 seconds
        );
        
        let updatedMessages;
        if (userMessageExists) {
          // User message already there, just add assistant response
          console.log('[GroonaAssistant] User message exists, adding assistant response');
          updatedMessages = [...prev, assistantMessage];
        } else {
          // User message missing (shouldn't happen, but safety check), add both
          console.warn('[GroonaAssistant] User message missing, adding both user and assistant messages');
          updatedMessages = [...prev, userMessage, assistantMessage];
        }
        
        // Sort by timestamp to ensure correct order
        updatedMessages.sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeA - timeB;
        });
        
        console.log('[GroonaAssistant] Final messages after adding assistant:', updatedMessages.length, updatedMessages.map(m => ({ role: m.role, content: m.content?.substring(0, 30) })));
        
        // Mark that we just added a message
        justAddedMessageRef.current = true;
        setTimeout(() => {
          justAddedMessageRef.current = false;
        }, 3000); // Reset after 3 seconds
        
        return updatedMessages;
      });

      // Update active conversation - we'll let the useEffect handle this after messages are set
      // Just update the conversation ID if needed
      if (conversation) {
        setActiveConversationId(conversationId || conversation.id || conversation._id);
      }

      // Refresh conversation (but prevent useEffect from reloading messages immediately)
      // Set a flag to prevent message overwrite during refetch
      justAddedMessageRef.current = true;
      await queryClient.invalidateQueries({ queryKey: ['groona-conversations'] });
      
      // Keep the flag for a bit longer to prevent overwrite
      setTimeout(() => {
        justAddedMessageRef.current = false;
      }, 5000); // Extended to 5 seconds to ensure backend has saved the message
      
      // Return result with action data for processing
      return { ...result, action: actionData };
    },
    onSuccess: async (result) => {
      setIsStreaming(false);
      // Clear input field after successful send
      setInputMessage("");
      
      // Keep the flag set longer to prevent message overwrite during refetch
      justAddedMessageRef.current = true;
      
      // Invalidate queries but delay to ensure messages are stable
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ['groona-conversations'] });
        // Reset flag after a delay to allow refetch
        setTimeout(() => {
          justAddedMessageRef.current = false;
        }, 3000);
      }, 1000);
      
      // Process action if present in response
      if (result && result.action) {
        const actionData = result.action;
        if (!currentUser) return;
        
        const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
          ? currentUser.active_tenant_id 
          : currentUser?.tenant_id;
        
        // Create unique key to prevent duplicate processing
        const actionKey = `groona_action_${activeConversationId || 'new'}_${actionData.action}_${JSON.stringify(actionData).substring(0, 100)}`;
        
        if (sessionStorage.getItem(actionKey)) {
          console.log('[GroonaAssistant] Action already processed');
          return;
        }
        
        sessionStorage.setItem(actionKey, 'true');
        
        try {
          setIsStreaming(true);
          
          if (actionData.action === 'create_project') {
            const createdProject = await createProjectFromAI(
              actionData,
              effectiveTenantId,
              currentUser.id,
              currentUser.email
            );
            
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            
            toast.success(`Project "${createdProject.name}" created successfully!`);
            
            setTimeout(() => {
              navigate(createPageUrl("ProjectDetail") + `?id=${createdProject._id || createdProject.id}`);
            }, 1500);
          } else if (actionData.action === 'create_task') {
            const createdTask = await createTaskFromAI(
              actionData,
              effectiveTenantId,
              currentUser.id,
              currentUser.email
            );
            
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            
            toast.success(`Task "${createdTask.title}" created successfully!`);
            
            if (createdTask.project_id) {
              setTimeout(() => {
                navigate(createPageUrl("ProjectDetail") + `?id=${createdTask.project_id}`);
              }, 1500);
            }
          }
        } catch (error) {
          console.error('[GroonaAssistant] Action execution error:', error);
          toast.error(error.message || 'Failed to execute action. Please try again.');
          sessionStorage.removeItem(actionKey);
        } finally {
          setIsStreaming(false);
        }
      }
    },
    onError: (error, variables) => {
      console.error('[GroonaAssistant] Send message error:', error);
      toast.error(error.message || 'Failed to send message. Please try again.');
      setIsStreaming(false);
      // Remove the user message that was optimistically added if the request failed
      setMessages(prev => {
        const lastUserIdx = prev.findLastIndex(m => m.role === 'user' && m.content === variables.message);
        if (lastUserIdx !== -1) {
          return prev.filter((_, idx) => idx !== lastUserIdx);
        }
        return prev;
      });
    }
  });

  const handleSendMessage = () => {
    const message = inputMessage.trim();
    if (!message) return;

    // Clear input immediately for better UX
    setInputMessage("");

    // Send message (user message will be added immediately in mutationFn)
    sendMessageMutation.mutate({ message });
  };

  const handleSuggestionClick = (text) => {
    if (!text || !text.trim()) return;
    
    // Clear input immediately
    setInputMessage("");
    
    // Automatically send the message
    setIsStreaming(true);
    sendMessageMutation.mutate({ message: text.trim() });
  };

  const handleNewConversation = () => {
    // Clear saved conversation when starting new one
    if (currentUser) {
      localStorage.removeItem(`groona_active_conversation_${currentUser.id}`);
    }
    createConversationMutation.mutate();
  };

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      const response = await fetch(`${API_URL}/groona-assistant/conversations/${conversationId}`, getFetchOptions('DELETE'));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete conversation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groona-conversations'] });
      if (activeConversationId) {
        // Clear from localStorage if this was the active conversation
        if (currentUser) {
          const savedId = localStorage.getItem(`groona_active_conversation_${currentUser.id}`);
          if (savedId === activeConversationId) {
            localStorage.removeItem(`groona_active_conversation_${currentUser.id}`);
          }
        }
        setActiveConversationId(null);
        setActiveConversation(null);
        setMessages([]);
        setHasStartedConversation(false);
      }
      toast.success('Conversation deleted');
    },
    onError: (error) => {
      console.error('[GroonaAssistant] Delete conversation error:', error);
      toast.error(error.message || 'Failed to delete conversation');
    }
  });

  const handleDeleteConversation = (conversationId, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!confirm('Delete this conversation? This action cannot be undone.')) {
      return;
    }
    deleteConversationMutation.mutate(conversationId);
  };

  // Show page structure immediately, even if data is loading
  // Only block if we don't have permission check yet
  if (!permissionChecked) {
    return (
      <div className="h-[calc(100vh-4rem)] flex relative overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex relative overflow-hidden">
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
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
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
          {conversationsLoading && conversations.length === 0 ? (
            // Skeleton loading state with shimmer effect
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-2.5 sm:p-3 rounded-lg border border-slate-200 bg-white animate-pulse">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-3/4 rounded bg-slate-200" />
                      <Skeleton className="h-3 w-1/2 rounded bg-slate-200" />
                    </div>
                    <Skeleton className="h-6 w-6 rounded-full bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
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
                      ? 'bg-purple-50 border border-purple-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  onClick={() => {
                    setActiveConversationId(convId);
                    setActiveConversation(conv);
                    const convMessages = conv.messages || [];
                    setMessages(convMessages);
                    // Mark as started if conversation has messages
                    setHasStartedConversation(convMessages.length > 0);
                    // Save to localStorage
                    if (currentUser) {
                      localStorage.setItem(`groona_active_conversation_${currentUser.id}`, convId);
                    }
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
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => handleDeleteConversation(convId, e)}
                      disabled={deleteConversationMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 min-w-0 overflow-hidden max-h-[calc(100vh-4rem)]">
        <div className="p-3 sm:p-4 md:p-6 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25 flex-shrink-0">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 truncate">
                Groona Assistant
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500 flex-shrink-0" />
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 hidden sm:block">
                Intelligent project management assistant
              </p>
            </div>
          </div>
        </div>

        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6"
          onScroll={() => {
            // Update auto-scroll preference when user manually scrolls
            if (chatContainerRef.current) {
              const container = chatContainerRef.current;
              const scrollHeight = container.scrollHeight;
              const scrollTop = container.scrollTop;
              const clientHeight = container.clientHeight;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
              shouldAutoScrollRef.current = isNearBottom;
            }
          }}
        >
          {messages.length === 0 && !hasStartedConversation ? (
            <div className="max-w-3xl mx-auto">
              <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 mb-4 sm:mb-6">
                <CardContent className="p-4 sm:p-6 md:p-8 text-center">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-purple-500/25">
                    <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
                    Welcome to Groona Assistant
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">
                    Your intelligent project management assistant. I can help you manage projects, tasks, and provide insights.
                    Ask me anything or try one of the suggestions below!
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500">
                    <Badge variant="outline" className="text-xs">Project Management</Badge>
                    <Badge variant="outline" className="text-xs">Task Management</Badge>
                    <Badge variant="outline" className="text-xs">Analytics</Badge>
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
                const isLastUserMessage = message.role === 'user' && idx === messages.length - 1;
                const isLastAssistantMessage = message.role === 'assistant' && idx === messages.length - 1;
                // Show streaming indicator for the last assistant message when streaming
                const shouldStream = isStreaming && isLastAssistantMessage;
                return (
                  <EnhancedMessageBubble
                    key={`${message.id || idx}-${message.content?.substring(0, 20)}`}
                    message={message}
                    currentUser={currentUser}
                    onAction={() => {}}
                    isStreaming={shouldStream}
                    onReload={message.role === 'user' ? () => {
                      // Resend the message
                      const messageContent = message.content;
                      setInputMessage(messageContent);
                      sendMessageMutation.mutate({ message: messageContent });
                    } : undefined}
                    onViewProject={message.createdProjectId ? () => {
                      navigate(createPageUrl("ProjectDetail") + `?id=${message.createdProjectId}`);
                    } : undefined}
                    onViewTask={message.createdTaskId ? async () => {
                      // Navigate to project detail page with task ID to highlight the task
                      if (message.createdTaskProjectId) {
                        navigate(createPageUrl("ProjectDetail") + `?id=${message.createdTaskProjectId}&taskId=${message.createdTaskId}`);
                      } else {
                        // If no project ID, fetch the task to get its project_id
                        try {
                          const tasks = await groonabackend.entities.Task.filter({ _id: message.createdTaskId });
                          const task = tasks && tasks.length > 0 ? tasks[0] : null;
                          
                          if (!task) {
                            // Try with id field instead of _id
                            const tasksById = await groonabackend.entities.Task.filter({ id: message.createdTaskId });
                            const taskById = tasksById && tasksById.length > 0 ? tasksById[0] : null;
                            
                            if (taskById && taskById.project_id) {
                              navigate(createPageUrl("ProjectDetail") + `?id=${taskById.project_id}&taskId=${message.createdTaskId}`);
                            } else {
                              toast.error('Task not found or has no project');
                              navigate(createPageUrl("Projects"));
                            }
                          } else if (task.project_id) {
                            navigate(createPageUrl("ProjectDetail") + `?id=${task.project_id}&taskId=${message.createdTaskId}`);
                          } else {
                            toast.error('Task has no associated project');
                            navigate(createPageUrl("Projects"));
                          }
                        } catch (error) {
                          console.error('[GroonaAssistant] Error fetching task:', error);
                          toast.error('Failed to load task');
                          navigate(createPageUrl("Projects"));
                        }
                      }
                    } : undefined}
                  />
                );
              })}
              {/* Show floating dots ONLY when streaming AND last message is user (waiting for assistant response) */}
              {/* Don't show if last message is already assistant (assistant is responding) */}
              {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 justify-start">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[85%] min-w-0">
                    <div className="rounded-2xl px-4 py-3 bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-1.5 py-2">
                        <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
                        <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
                        <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
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
                <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-lg border border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all w-full min-h-[48px] sm:min-h-[52px]">
                  {/* Model Selection */}
                  {availableModels.length > 0 && (
                    <div className="pl-2 sm:pl-3 flex-shrink-0 border-r border-slate-200 pr-2 sm:pr-3">
                      <Select
                        value={selectedModel || availableModels[0]?.id}
                        onValueChange={(value) => setSelectedModel(value)}
                        disabled={sendMessageMutation.isPending || isStreaming}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 focus:ring-0 focus:ring-offset-0 w-[140px] sm:w-[160px] font-medium text-slate-700 hover:text-slate-900 [&>svg]:h-3 [&>svg]:w-3">
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
                    placeholder="Ask Groona anything..."
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base flex-1 min-w-0 py-3"
                    disabled={sendMessageMutation.isPending || isStreaming}
                  />
                </div>
              </div>
              {sendMessageMutation.isPending || isStreaming ? (
                <Button
                  onClick={() => {
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
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 h-10 sm:h-12 px-3 sm:px-6 flex-shrink-0 w-full sm:w-auto"
                >
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline ml-2">Send</span>
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center hidden sm:block break-words">
              Verify important information before taking action.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

