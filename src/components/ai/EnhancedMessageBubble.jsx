import React, { useState, useEffect, Fragment, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock, Plus, Edit, RotateCw, ExternalLink, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Helper function to get user initials
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Interactive components for structured AI outputs
const TaskCard = ({ task, onAction }) => (
  <Card className="bg-white border-blue-200 hover:shadow-md transition-shadow">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900">{task.title}</h4>
          {task.description && (
            <p className="text-sm text-slate-600 mt-1">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {task.priority && (
              <Badge variant="outline" className="text-xs">
                {task.priority}
              </Badge>
            )}
            {task.dueDate && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.dueDate}
              </Badge>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onAction('create_task', task)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>
    </CardContent>
  </Card>
);

const ProjectSummaryCard = ({ project, onAction }) => (
  <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
    <CardContent className="p-4">
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-slate-900">{project.name}</h4>
          <p className="text-sm text-slate-600 mt-1">{project.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{project.tasksTotal || 0}</div>
            <div className="text-xs text-slate-600">Total Tasks</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{project.tasksCompleted || 0}</div>
            <div className="text-xs text-slate-600">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{project.progress || 0}%</div>
            <div className="text-xs text-slate-600">Progress</div>
          </div>
        </div>
        {onAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('view_project', project)}
            className="w-full"
          >
            View Project
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

const ActionButton = ({ action, onExecute }) => {
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(action);
      toast.success('Action executed successfully');
    } catch (error) {
      toast.error('Failed to execute action');
    } finally {
      setExecuting(false);
    }
  };

  const actionIcons = {
    create_task: Plus,
    edit_task: Edit,
    view_project: ChevronRight,
  };

  const Icon = actionIcons[action.type] || Zap;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleExecute}
      disabled={executing}
      className="text-blue-600 hover:bg-blue-50 border-blue-200"
    >
      {executing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {action.label || action.type}
    </Button>
  );
};

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall?.name || 'Function';
  const status = toolCall?.status || 'pending';
  const results = toolCall?.results;
  
  const parsedResults = (() => {
    if (!results) return null;
    try {
      return typeof results === 'string' ? JSON.parse(results) : results;
    } catch {
      return results;
    }
  })();
  
  const isError = results && (
    (typeof results === 'string' && /error|failed/i.test(results)) ||
    (parsedResults?.success === false)
  );
  
  const statusConfig = {
    pending: { icon: Clock, color: 'text-slate-400', text: 'Pending' },
    running: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
    in_progress: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
    completed: isError ? 
      { icon: AlertCircle, color: 'text-red-500', text: 'Failed' } : 
      { icon: CheckCircle2, color: 'text-green-600', text: 'Success' },
    success: { icon: CheckCircle2, color: 'text-green-600', text: 'Success' },
    failed: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' },
    error: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' }
  }[status] || { icon: Zap, color: 'text-slate-500', text: '' };
  
  const Icon = statusConfig.icon;
  const formattedName = name.split('.').reverse().join(' ').toLowerCase();
  
  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
          "hover:bg-slate-50",
          expanded ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"
        )}
      >
        <Icon className={cn("h-3 w-3", statusConfig.color, statusConfig.spin && "animate-spin")} />
        <span className="text-slate-700">{formattedName}</span>
        {statusConfig.text && (
          <span className={cn("text-slate-500", isError && "text-red-600")}>
            • {statusConfig.text}
          </span>
        )}
        {!statusConfig.spin && (toolCall.arguments_string || results) && (
          <ChevronRight className={cn("h-3 w-3 text-slate-400 transition-transform ml-auto", 
            expanded && "rotate-90")} />
        )}
      </button>
      
      {expanded && !statusConfig.spin && (
        <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200 space-y-2">
          {toolCall.arguments_string && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Parameters:</div>
              <pre className="bg-slate-50 rounded-md p-2 text-xs text-slate-600 whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2);
                  } catch {
                    return toolCall.arguments_string;
                  }
                })()}
              </pre>
            </div>
          )}
          {parsedResults && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Result:</div>
              <pre className="bg-slate-50 rounded-md p-2 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-auto">
                {typeof parsedResults === 'object' ? 
                  JSON.stringify(parsedResults, null, 2) : parsedResults}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Floating dots animation for initial loading
const FloatingDots = () => (
  <div className="flex items-center gap-1.5 py-2">
    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
  </div>
);

// Thinking component with dropdown
const ThinkingIndicator = ({ onExpand, expanded }) => (
  <div className="space-y-2">
    <button
      onClick={onExpand}
      className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
    >
      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
      <span>Thinking...</span>
      <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
    </button>
  </div>
);

// Typewriter effect hook - properly handles streaming and word-by-word typing
const useTypewriter = (text, speed = 25, enabled = true) => {
  const [displayedText, setDisplayedText] = useState('');
  const intervalRef = useRef(null);
  const textRef = useRef('');
  const wordIndexRef = useRef(0);
  const [isComplete, setIsComplete] = useState(false);
  const messageIdRef = useRef('');
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text || '');
      setIsComplete(true);
      // Clear any ongoing timeout
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Check if this is a new message (different from previous) or if enabled just became true
    const currentMessageId = text.substring(0, 50);
    const isNewMessage = currentMessageId !== messageIdRef.current;
    const wasJustEnabled = !messageIdRef.current && enabled;
    
    if (isNewMessage || wasJustEnabled) {
      // New message or just enabled - reset everything
      messageIdRef.current = currentMessageId;
      textRef.current = text;
      setDisplayedText(''); // Start with empty text
      wordIndexRef.current = 0;
      setIsComplete(false);
      // Clear any existing timeout
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      // Same message, just update the text reference
      textRef.current = text;
    }
  }, [text, enabled]);

  useEffect(() => {
    if (!enabled || !text || isComplete || !enabledRef.current) {
      if (!enabled || !text) {
        setIsComplete(true);
      }
      return;
    }

    const currentText = textRef.current;
    if (!currentText) return;
    
    const words = currentText.split(' ').filter(w => w.length > 0);
    
    // If we've displayed all words, mark as complete
    if (wordIndexRef.current >= words.length) {
      setDisplayedText(currentText); // Ensure full text is displayed
      setIsComplete(true);
      return;
    }

    // Type next word
    intervalRef.current = setTimeout(() => {
      if (!enabledRef.current) {
        setIsComplete(true);
        setDisplayedText(currentText);
        return;
      }
      
      const nextWords = words.slice(0, wordIndexRef.current + 1);
      const newText = nextWords.join(' ') + (nextWords.length < words.length ? ' ' : '');
      setDisplayedText(newText);
      wordIndexRef.current += 1;
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [displayedText, enabled, isComplete, text, speed]);

  return { displayedText, isComplete };
};

// Enhanced text formatter that highlights important words
const formatTextWithHighlights = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Pattern to match:
  // - Project names (quoted or capitalized phrases)
  // - Dates (various formats)
  // - Member names (capitalized words, emails)
  // - Numbers with context
  // - Bold markdown already present

  // First, handle markdown bold that's already there
  const parts = [];
  let lastIndex = 0;
  
  // Match markdown bold
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;
  
  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before bold
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    // Add bold text
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }
  
  // If no bold found, use whole text
  if (parts.length === 0) {
    parts.push({ text, bold: false });
  }

  return parts.map((part, idx) => {
    if (part.bold) {
      return <strong key={idx} className="font-bold text-slate-900">{part.text}</strong>;
    }
    return <Fragment key={idx}>{part.text}</Fragment>;
  });
};

export default function EnhancedMessageBubble({ message, onAction, isStreaming = false, onReload, onViewProject, onViewTask, isThinking = false, currentUser = null }) {
  const isUser = message.role === 'user';
  const [showTypewriterState, setShowTypewriterState] = useState(false);
  const contentRef = useRef(null);
  const messageIdRef = useRef(message.id || message._id || message.content?.substring(0, 50));
  const isNewMessageRef = useRef(false); // Track if this is a newly received message

  // Parse structured content if present
  const structuredContent = message.structured_data || null;
  
  // Check if message contains JSON action (create_project or create_task) - MUST BE BEFORE HOOKS
  let actionData = null;
  let displayContent = message.content;
  let isActionMessage = false;
  
  if (!isUser && message.content) {
    // First check if message has action data from backend
    if (message.action) {
      actionData = message.action;
      isActionMessage = true;
    } else {
      // Try to parse JSON from content
      try {
        const parsed = JSON.parse(message.content);
        if (parsed.action === 'create_project' || parsed.action === 'create_task') {
          actionData = parsed;
          isActionMessage = true;
        }
      } catch (e) {
        // Try to find JSON in the content string
        try {
          const jsonMatch = message.content.match(/\{[\s\S]*"action"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.action === 'create_project' || parsed.action === 'create_task') {
              actionData = parsed;
              isActionMessage = true;
            }
          }
        } catch (e2) {
          // Not JSON, use content as is
        }
      }
    }
    
    // If we found action data, create a formatted message
    if (isActionMessage && actionData) {
      if (actionData.action === 'create_project') {
        displayContent = null; // Don't show text content, we'll render custom UI
      } else if (actionData.action === 'create_task') {
        displayContent = null; // Don't show text content, we'll render custom UI
      }
    }
  }

  // Check if message is new (just received) vs old (loaded from history)
  // New message: created within last 5 seconds AND currently streaming or just completed streaming
  const checkIfNewMessage = () => {
    // If currently streaming, it's definitely a new message
    if (isStreaming) return true;
    
    // Check timestamp
    if (!message.created_at) {
      // No timestamp - check if message was just added (very recent)
      // If we're not streaming and message has no timestamp, it's likely from history
      return false;
    }
    
    const messageTime = new Date(message.created_at).getTime();
    const now = Date.now();
    const timeDiff = now - messageTime;
    
    // Consider message "new" if created within last 5 seconds (recently received)
    // Messages older than 5 seconds are from history
    return timeDiff < 5000;
  };

  const isNewMessage = checkIfNewMessage();

  // Track if this is a new message and trigger typewriter only for new messages
  useEffect(() => {
    const currentId = message.id || message._id || message.content?.substring(0, 50);
    if (currentId !== messageIdRef.current) {
      messageIdRef.current = currentId;
      isNewMessageRef.current = isNewMessage;
      
      // Only show typewriter for NEW assistant messages (not action messages and not loaded from history)
      if (!isUser && !isActionMessage && message.content && displayContent && isNewMessage) {
        // For new messages, start with typewriter disabled - will be enabled by the loading state useEffect
        // This prevents showing full content before typewriter starts
        setShowTypewriterState(false);
      } else {
        // For old messages, show immediately without typewriter
        setShowTypewriterState(false);
      }
    }
  }, [message.id, message._id, message.content, isUser, isActionMessage, displayContent, isNewMessage]);

  // Use typewriter hook for assistant messages (only for new messages)
  // Enable typewriter only for new messages that are being streamed or just received
  const shouldUseTypewriter = !isUser && !isActionMessage && displayContent && message.content && showTypewriterState && isNewMessage;
  const { displayedText: typewriterText, isComplete: typewriterComplete } = useTypewriter(
    displayContent || '',
    25, // Speed for word-by-word effect
    shouldUseTypewriter
  );

  // Handle loading states: floating dots -> typewriter for new messages
  useEffect(() => {
    if (isUser || isActionMessage) return;

    if (!message.content && isStreaming) {
      // Show floating dots while waiting for response - don't show typewriter yet
      setShowTypewriterState(false);
    } else if (message.content && displayContent && isNewMessage) {
      // For new messages, always start typewriter immediately
      // This ensures typewriter shows before full content is displayed
      if (!showTypewriterState) {
        // Start typewriter immediately - no delay to prevent flash of full content
        const timer = setTimeout(() => {
          setShowTypewriterState(true);
        }, 50); // Minimal delay just for state update timing
        return () => clearTimeout(timer);
      }
    } else if (message.content && !isNewMessage) {
      // Old messages - don't show typewriter
      setShowTypewriterState(false);
    }
  }, [isStreaming, message.content, isUser, isActionMessage, displayContent, showTypewriterState, isNewMessage]);

  // Determine what to show based on state
  const showDots = isStreaming && !isUser && !message.content; // Show dots while waiting for initial response
  const showTypewriterEffect = !isActionMessage && displayContent && showTypewriterState && !typewriterComplete && isNewMessage;
  // Show content: 
  // - For USER messages: ALWAYS show immediately (no conditions)
  // - For old messages: show immediately (full content)
  // - For new messages: show ONLY when typewriter is ready (prevents flash of full content)
  // - For action messages: always show
  const showContent = isUser || isActionMessage || (displayContent && (
    !isNewMessage || // Old messages - show immediately
    (isNewMessage && showTypewriterState) // New messages - show only when typewriter state is active
  ));

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mt-0.5 flex-shrink-0">
          <Zap className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn("max-w-[85%] min-w-0", isUser && "flex flex-col items-end relative")}>
        {showDots && (
          <div className={cn(
            "rounded-2xl px-4 py-3 bg-white border border-slate-200 shadow-sm"
          )}>
            <FloatingDots />
          </div>
        )}

        {showContent && (
          <div className={cn(
            "rounded-2xl px-4 py-3 relative group",
            isUser ? "bg-slate-800 text-white" : "bg-white border border-slate-200 shadow-sm"
          )}>
            {isUser ? (
              <div className="flex items-start gap-2 pr-2">
                <p className="text-sm leading-relaxed break-words flex-1 whitespace-pre-wrap">{displayContent}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={() => {
                      navigator.clipboard.writeText(displayContent);
                      toast.success('Message copied');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {onReload && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-300 hover:text-white hover:bg-slate-700"
                      onClick={onReload}
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3" ref={contentRef}>
                {isActionMessage && actionData && actionData.action === 'create_project' ? (
                  <div className="text-sm space-y-3 leading-relaxed">
                    <p className="text-slate-700">
                      Your project has been created with the following details:
                    </p>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2.5 border border-slate-200">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-600 font-medium min-w-[80px]">Project Name:</span>
                        <span className="font-bold text-slate-900">{actionData.project_name || 'Not specified'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-600 font-medium min-w-[80px]">Workspace:</span>
                        <span className="font-bold text-slate-900">{actionData.workspace_name || 'Not specified'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-600 font-medium min-w-[80px]">Deadline:</span>
                        <span className="font-bold text-slate-900">
                          {actionData.deadline ? new Date(actionData.deadline).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          }) : 'Not set'}
                        </span>
                      </div>
                    </div>
                    {onViewProject && message.createdProjectId && (
                      <Button
                        size="sm"
                        onClick={onViewProject}
                        className="mt-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Project
                      </Button>
                    )}
                  </div>
                ) : isActionMessage && actionData && actionData.action === 'create_task' ? (
                  <div className="text-sm space-y-3 leading-relaxed">
                    <p className="text-slate-700">
                      Your task has been created with the following details:
                    </p>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2.5 border border-slate-200">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-600 font-medium min-w-[100px]">Task Title:</span>
                        <span className="font-bold text-slate-900">{actionData.title || 'Not specified'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-600 font-medium min-w-[100px]">Project:</span>
                        <span className="font-bold text-slate-900">{actionData.project_name || 'Not specified'}</span>
                      </div>
                      {actionData.sprint_name && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 font-medium min-w-[100px]">Sprint:</span>
                          <span className="font-bold text-slate-900">{actionData.sprint_name}</span>
                        </div>
                      )}
                      {/* PRIVACY: Only show assignee name, never email */}
                      {actionData.assignee_name && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 font-medium min-w-[100px]">Assigned to:</span>
                          <span className="font-bold text-slate-900">{actionData.assignee_name}</span>
                        </div>
                      )}
                      {actionData.due_date && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 font-medium min-w-[100px]">Due date:</span>
                          <span className="font-bold text-slate-900">
                            {new Date(actionData.due_date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      )}
                      {actionData.estimated_hours && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 font-medium min-w-[100px]">Estimated hours:</span>
                          <span className="font-bold text-slate-900">{actionData.estimated_hours}</span>
                        </div>
                      )}
                    </div>
                    {onViewTask && message.createdTaskId && (
                      <Button
                        size="sm"
                        onClick={onViewTask}
                        className="mt-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Task
                      </Button>
                    )}
                  </div>
                ) : displayContent && (!isNewMessage || showTypewriterState) ? (
                  <div className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown 
                      components={{
                        code: ({ inline, className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <div className="relative group/code">
                              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto my-2">
                                <code className={className} {...props}>{children}</code>
                              </pre>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover/code:opacity-100 bg-slate-800 hover:bg-slate-700"
                                onClick={() => {
                                  navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                                  toast.success('Code copied');
                                }}
                              >
                                <Copy className="h-3 w-3 text-slate-400" />
                              </Button>
                            </div>
                          ) : (
                            <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                              {children}
                            </code>
                          );
                        },
                        a: ({ children, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {children}
                          </a>
                        ),
                        p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="my-1">{children}</li>,
                        h1: ({ children }) => <h1 className="text-lg font-semibold my-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-semibold my-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold my-2">{children}</h3>,
                        strong: ({ children }) => (
                          <strong className="font-bold text-slate-900">{children}</strong>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-slate-300 pl-3 my-2 text-slate-600">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {/* For new messages: show typewriter text while typing, full text only after completion */}
                      {/* For old messages: always show full content */}
                      {/* Prevent showing full content for new messages until typewriter is ready */}
                      {isNewMessage && showTypewriterState && !typewriterComplete 
                        ? typewriterText 
                        : displayContent}
                    </ReactMarkdown>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
        
        {/* Render structured content */}
        {!isUser && structuredContent && (
          <div className="mt-2 space-y-2 w-full">
            {structuredContent.type === 'task' && (
              <TaskCard task={structuredContent.data} onAction={onAction} />
            )}
            {structuredContent.type === 'project_summary' && (
              <ProjectSummaryCard project={structuredContent.data} onAction={onAction} />
            )}
            {structuredContent.type === 'actions' && (
              <div className="flex flex-wrap gap-2">
                {structuredContent.data.map((action, idx) => (
                  <ActionButton key={idx} action={action} onExecute={onAction} />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Tool calls */}
        {message.tool_calls?.length > 0 && (
          <div className="space-y-1 mt-2">
            {message.tool_calls.map((toolCall, idx) => (
              <FunctionDisplay key={idx} toolCall={toolCall} />
            ))}
          </div>
        )}
      </div>
      {/* User Avatar on the right side with spacing */}
      {isUser && currentUser && (
        <div className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5">
          <Avatar className="h-7 w-7 border-2 border-slate-200">
            <AvatarImage 
              src={currentUser?.profile_image_url || currentUser?.profile_picture_url} 
              alt={currentUser?.full_name || 'User'}
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
              {getInitials(currentUser?.full_name || currentUser?.email || 'U')}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}
