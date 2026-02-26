import React, { useState } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Edit,
  Calendar as CalendarIcon,
  User as UserIcon,
  UserPlus,
  MoveRight,
  Link as LinkIcon,
  Paperclip,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  History,
  AlertCircle,
  Tag,
  ListTodo,
  CheckSquare,
  Square,
  Globe,
  ExternalLink,
  Check,
  Layout,
  Flag,
  Trash2,
  Siren,
  AlertTriangle,
  AlignLeft,
  Sparkles,
  Lock
} from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import EditTaskDialog from "./EditTaskDialog";
import CommentsSection from "../project-detail/CommentsSection";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Subtask Row Component ---
const SubtaskRow = ({ subtask, index, taskId, allUsers, onUpdate, onDelete, currentUser, project, reworkAlarms = [], isLocked = false }) => { // Added isLocked
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const updateSubtask = async (updates) => {
    try {
      // Use the new dedicated backend endpoint
      const response = await fetch(`${API_BASE}/api/subtasks/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Assuming basic token auth - adjust if your auth system differs
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          taskId,
          subtaskIndex: index,
          updates,
          assignedBy: currentUser?.email,
          assignedByName: currentUser?.full_name,
          tenantId: currentUser?.active_tenant_id || currentUser?.tenant_id
        })
      });

      if (!response.ok) throw new Error('Failed to update subtask');

      const result = await response.json();
      if (result.success && result.task) {
        onUpdate(result.task);
        return true;
      }
      return false;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update subtask");
      return false;
    }
  };

  const handleDateSelect = async (date) => {
    if (!date) return;
    const success = await updateSubtask({ due_date: date.toISOString() });
    if (success) {
      toast.success("Due date set");
      setIsCalendarOpen(false);
    }
  };

  const handleAssignUser = async (email) => {
    // Check if user has high rework block
    const isBlocked = reworkAlarms.some(alarm => alarm.recipient_email === email);
    if (isBlocked && subtask.assigned_to !== email) {
      toast.error(`Cannot assign: ${email} has an active High Rework alarm.`);
      return;
    }

    // Implement toggle: if already assigned to this user, unassign
    const newAssignee = subtask.assigned_to === email ? null : email;
    const success = await updateSubtask({ assigned_to: newAssignee });

    if (success) {
      toast.success(newAssignee ? "User assigned" : "User unassigned");
      setIsAssignOpen(false);
    }
  };

  const assignedUser = allUsers.find(u => u.email === subtask.assigned_to);
  const isClient = currentUser?.custom_role === 'client';

  // Filter users for assignment: 
  // 1. Must be currently assigned OR
  // 2. Must be in project team AND not client/super_admin
  const projectTeamEmails = project?.team_members?.map(m => m.email) || [];

  // Filter users for assignment: Match CreateTaskModal logic
  // 1. Must be in same tenant
  // 2. Not super admin
  // 3. Not client
  // 4. Always include if already assigned
  const effectiveTenantId = currentUser?.active_tenant_id || currentUser?.tenant_id;

  const assignableUsers = allUsers.filter(user => {
    if (user.email === subtask.assigned_to) return true;

    // Strict tenant check
    if (user.tenant_id !== effectiveTenantId) return false;

    // Exclude super_admin (check both flag and role)
    if (user.is_super_admin || user.custom_role === 'super_admin') return false;

    // Exclude client
    if (user.custom_role === 'client') return false;

    // PROJECT TEAM FILTER: Only allow members of this project
    const isProjectMember = projectTeamEmails.includes(user.email);
    if (!isProjectMember) return false;

    return true;
  });

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors group">
      <div className="mt-1">
        {subtask.completed ? (
          <CheckSquare
            className={cn(
              "h-5 w-5 text-emerald-500",
              (isClient || isLocked) ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
            onClick={() => (!isClient && !isLocked) && updateSubtask({ completed: false })}
          />
        ) : (
          <Square
            className={cn(
              "h-5 w-5 text-slate-300",
              (isClient || isLocked) ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
            onClick={() => (!isClient && !isLocked) && updateSubtask({ completed: true })}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <span className={`text-sm font-medium ${subtask.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
          {subtask.title}
        </span>

        {/* Metadata Badges */}
        <div className="flex gap-2 mt-1 min-h-[20px]">
          {subtask.due_date && (
            <span className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
              <CalendarIcon className="h-2.5 w-2.5" />
              {format(new Date(subtask.due_date), 'MMM d')}
            </span>
          )}
          {assignedUser && (
            <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              <UserIcon className="h-2.5 w-2.5" />
              {assignedUser.full_name?.split(' ')[0] || assignedUser.email?.split('@')[0] || 'User'}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons - Hide for clients or if locked */}
      {(!isClient && !isLocked) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          {/* 1. Due Date */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", subtask.due_date && "text-indigo-600")}
                title="Set Due Date"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={subtask.due_date ? new Date(subtask.due_date) : undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* 2. Assign User */}
          <Popover open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", subtask.assigned_to && "text-indigo-600")}
                title="Assign Member"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="end">
              <Command>
                <CommandInput placeholder="Search team..." />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {assignableUsers.map((user) => (
                      <CommandItem
                        key={user.email}
                        value={`${user.full_name} ${user.email}`} // Combine name and email for filtering
                        onSelect={() => handleAssignUser(user.email)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            subtask.assigned_to === user.email ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback>{(user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1">{user.full_name || user.email || 'Unknown User'}</span>
                        {reworkAlarms.some(alarm => alarm.recipient_email === user.email) && (
                          <Badge variant="outline" className="ml-auto text-[8px] border-red-200 bg-red-50 text-red-600 gap-1 animate-pulse">
                            <Siren className="h-2 w-2" />
                            FROZEN
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* 3. Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => {
              if (confirm("Delete this subtask?")) {
                onDelete(index);
              }
            }}
            title="Delete Subtask"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default function TaskDetailDialog({ open, onClose, taskId, initialTask, highlightCommentId, readOnly = false, onTaskUpdate, autoEdit = false }) {
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { user: currentUser } = useUser();
  const [showImpedimentDialog, setShowImpedimentDialog] = useState(false);
  const [impedimentData, setImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedImpedimentId, setSelectedImpedimentId] = useState("new");
  const [isReporting, setIsReporting] = useState(false);



  const handleReportImpediment = async () => {
    setIsReporting(true);
    try {
      if (selectedImpedimentId && selectedImpedimentId !== "new") {
        // Link to existing impediment
        await groonabackend.entities.Impediment.update(selectedImpedimentId, {
          task_id: task?.id || task?._id,
        });
        toast.success('Task linked to impediment successfully!');
      } else {
        // Create new impediment
        if (!impedimentData.title.trim()) {
          toast.error('Impediment title is required');
          setIsReporting(false);
          return;
        }

        const impedimentPayload = {
          tenant_id: currentUser?.active_tenant_id || currentUser?.tenant_id,
          workspace_id: project?.workspace_id || "",
          project_id: task?.project_id,
          sprint_id: task?.sprint_id,
          story_id: task?.story_id,
          task_id: task?.id || task?._id,
          title: impedimentData.title.trim(),
          description: impedimentData.description || "",
          severity: impedimentData.severity,
          status: "open",
          reported_by: currentUser?.email,
          reported_by_name: currentUser?.full_name || currentUser?.email,
        };

        await groonabackend.entities.Impediment.create(impedimentPayload);
        toast.success('Impediment reported successfully!');
      }

      // Reset and close
      setImpedimentData({ title: "", description: "", severity: "medium" });
      setSelectedImpedimentId("new");
      setShowImpedimentDialog(false);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['impediments', task?.project_id] });
    } catch (error) {
      console.error('Error reporting impediment:', error);
      toast.error('Failed to report impediment');
    } finally {
      setIsReporting(false);
    }
  };

  // Check if user is a viewer
  const isViewer = currentUser?.custom_role === 'viewer';

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      let tasks = await groonabackend.entities.Task.filter({ _id: taskId });
      if (!tasks || tasks.length === 0) {
        tasks = await groonabackend.entities.Task.filter({ id: taskId });
      }
      return tasks[0] || null;
    },
    enabled: !!taskId,
    initialData: initialTask,
    staleTime: initialTask ? 60 * 1000 : 0,
  });

  React.useEffect(() => {
    // Exception for peer reviews: allow edit mode even for viewers if autoEdit is enabled
    if (open && autoEdit && task && !readOnly && (!isViewer || autoEdit)) {
      setShowEditDialog(true);
    }
  }, [open, autoEdit, task, readOnly, isViewer]);

  const { data: projectImpediments = [] } = useQuery({
    queryKey: ['impediments', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return await groonabackend.entities.Impediment.filter({ project_id: task.project_id });
    },
    enabled: !!task?.project_id && showImpedimentDialog,
  });

  const { data: projectMilestones = [] } = useQuery({
    queryKey: ['milestones', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return groonabackend.entities.Milestone.filter({ project_id: task.project_id });
    },
    enabled: !!task?.project_id,
  });

  const { data: project } = useQuery({
    queryKey: ["project", task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: task.project_id });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ id: task.project_id });
      }
      return projects[0] || null;
    },
    enabled: !!task?.project_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: reworkAlarms = [] } = useQuery({
    queryKey: ['rework-alarms', currentUser?.tenant_id],
    queryFn: async () => {
      const tid = currentUser?.active_tenant_id || currentUser?.tenant_id;
      if (!tid) return [];
      return await groonabackend.entities.Notification.filter({
        tenant_id: tid,
        type: 'high_rework_alarm',
        status: 'OPEN'
      });
    },
    enabled: open && !!currentUser,
    refetchInterval: 30000,
  });

  const isLocked = React.useMemo(() => {
    if (!task) return false;
    // 1. If project is completed, everything is locked
    if (project?.status === 'completed') return true;

    // 2. If task has a milestone, check its status
    if (task.milestone_id) {
      const milestone = projectMilestones.find(m => (m.id || m._id) === task.milestone_id);
      return milestone?.status === 'completed';
    }

    return false;
  }, [task, project, projectMilestones]);





  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees", task?.assigned_to],
    queryFn: async () => {
      if (!task?.assigned_to || task.assigned_to.length === 0) return [];
      if (allUsers.length > 0) {
        return allUsers.filter(u => task.assigned_to.includes(u.email));
      }
      const users = await groonabackend.entities.User.list();
      return users.filter(u => task.assigned_to.includes(u.email));
    },
    enabled: !!task?.assigned_to && task.assigned_to.length > 0,
  });

  const { data: relatedTasks = [] } = useQuery({
    queryKey: ["related-tasks", task?.dependencies, task?.project_id],
    queryFn: async () => {
      if (!task?.dependencies || task.dependencies.length === 0) return [];
      const tasks = await groonabackend.entities.Task.filter({ project_id: task.project_id });
      return tasks.filter(t => task.dependencies.includes(t.id) || task.dependencies.includes(t.title));
    },
    enabled: !!task?.dependencies && task.dependencies.length > 0,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => groonabackend.entities.Comment.filter({
      entity_type: 'task',
      entity_id: taskId
    }, '-created_date'),
    enabled: !!taskId,
  });

  const getStatusConfig = (status) => {
    const configs = {
      todo: {
        gradient: "from-slate-500 to-slate-600",
        label: "To Do",
        icon: Clock
      },
      in_progress: {
        gradient: "from-blue-500 to-blue-600",
        label: "In Progress",
        icon: Zap
      },
      review: {
        gradient: "from-amber-500 to-orange-600",
        label: "Review",
        icon: Target
      },
      completed: {
        gradient: "from-emerald-500 to-green-600",
        label: "Completed",
        icon: CheckCircle2
      },
    };
    return configs[status] || configs.todo;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      low: { gradient: "from-blue-400 to-blue-500" },
      medium: { gradient: "from-amber-400 to-amber-500" },
      high: { gradient: "from-orange-400 to-orange-500" },
      urgent: { gradient: "from-red-400 to-red-500" },
    };
    return configs[priority] || configs.medium;
  };

  const getTaskTypeConfig = (type) => {
    const configs = {
      story: { icon: "📖" },
      bug: { icon: "🐛" },
      task: { icon: "✓" },
      epic: { icon: "⭐" },
      technical_debt: { icon: "🔧" },
    };
    return configs[type] || configs.task;
  };

  const handleEditClick = () => setShowEditDialog(true);

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const handleTaskUpdateFromEdit = (updatedTask) => {
    if (updatedTask && taskId) {
      queryClient.setQueryData(["task-detail", taskId], updatedTask);
    }
    queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    if (onTaskUpdate) onTaskUpdate(updatedTask);
  };

  const handleDeleteSubtask = async (index) => {
    if (!task) return;
    try {
      const newSubtasks = [...(task.subtasks || [])];
      newSubtasks.splice(index, 1);

      const updated = await groonabackend.entities.Task.update(task.id, { subtasks: newSubtasks });
      handleTaskUpdateFromEdit(updated);
      toast.success("Subtask deleted");
    } catch (error) {
      console.error("Failed to delete subtask:", error);
      toast.error("Failed to delete subtask");
    }
  };

  const renderDescription = (text) => {
    if (!text) return <p className="text-sm text-slate-400 italic">No description provided.</p>;

    // Extended Plain Text Rendering with Keyword Highlighting
    // Strict Keyword Highlighting for specific headers
    const pattern = /(OVERVIEW|KEY REQUIREMENTS|SCOPE)/g;

    // Check if text matches our specific keywords
    if (pattern.test(text)) {
      // Clean HTML tags first to handle mixed content from rich text editors
      const cleanText = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Strip remaining tags
        .replace(/&nbsp;/g, ' ');

      const parts = cleanText.split(pattern);

      return (
        <div className="text-sm text-slate-700 leading-relaxed">
          {parts.map((part, index) => {
            if (!part) return null;
            // Check if this part is one of our keywords
            if (part.match(/^(OVERVIEW|KEY REQUIREMENTS|SCOPE)$/)) {
              return (
                <div key={index} className="font-bold text-slate-800 mt-6 mb-2 block tracking-tight bg-yellow-100 px-2 py-1 border-l-4 border-yellow-500 rounded-sm w-fit uppercase">
                  {part}
                </div>
              );
            }
            // Regular text content
            const trimmed = part.trim();
            if (!trimmed) return null;

            return (
              <div key={index} className="mb-4 whitespace-pre-wrap">
                {trimmed}
              </div>
            );
          })}
        </div>
      );
    }

    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);

    if (hasHTML) {
      return (
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    // Fallback standard text
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      const isHeader = trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

      if (isHeader) {
        return (
          <div key={index} className="text-sm font-bold text-slate-900 mt-4 mb-1 tracking-wide">
            {line}
          </div>
        );
      }
      if (trimmed === "") {
        return <div key={index} className="h-2" />;
      }
      return (
        <div key={index} className="text-sm text-slate-700 leading-relaxed">
          {line}
        </div>
      );
    });
  };

  const renderAcceptanceCriteria = (text) => {
    if (!text) return null;

    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);

    if (hasHTML) {
      // Render HTML content safely with proper styling
      return (
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    // Fallback to plain text rendering for non-HTML content
    // Split by newlines and render each line with a checkmark
    return (
      <div className="text-sm text-slate-700 space-y-3">
        {text.split('\n').map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1 h-4 w-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="h-2.5 w-2.5 text-green-600" />
              </div>
              <span className="flex-1 leading-relaxed">{trimmed.replace(/^- /, '')}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading && !task) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl" aria-describedby="loading-desc">
          <DialogTitle className="sr-only">Loading Task</DialogTitle>
          <DialogDescription id="loading-desc" className="sr-only">
            Please wait while the task details are being loaded.
          </DialogDescription>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-slate-600 font-medium mt-6">Loading task details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent aria-describedby="error-desc">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-slate-400 mb-3" />
            <DialogTitle>Task not found</DialogTitle>
            <DialogDescription id="error-desc" className="text-slate-500 mt-2">
              This task may have been deleted.
            </DialogDescription>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityConfig(task.priority);
  const typeConfig = getTaskTypeConfig(task.task_type);
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0" aria-describedby="task-desc">
          <DialogDescription id="task-desc" className="sr-only">
            Detailed view of task {task.title} including status, subtasks, and comments.
          </DialogDescription>

          {/* Header */}
          <div className={`bg-gradient-to-r ${priorityConfig.gradient} p-6 text-white flex-shrink-0`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-inner border border-white/10">
                  {typeConfig.icon}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-2xl font-bold text-white mb-1 drop-shadow-sm">
                      {task.title}
                    </DialogTitle>
                    {isLocked && (
                      <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 self-start mt-1">
                        <Lock className="h-3 w-3" />
                        Settled
                      </Badge>
                    )}
                  </div>
                  <p className="text-white/90 text-sm font-medium flex items-center gap-1">
                    <Layout className="h-3 w-3" /> {project?.name || 'Project'}
                  </p>
                </div>
              </div>

              {(!readOnly && !isViewer && !isLocked || autoEdit) && (
                <Button
                  onClick={handleEditClick}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm mr-2 shadow-sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                <StatusIcon className="h-4 w-4 mr-1.5" />
                {statusConfig.label}
              </Badge>
              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                <Flag className="h-3 w-3 mr-1.5" />
                {task.priority.toUpperCase()}
              </Badge>
              {task.story_points > 0 && (
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                  {task.story_points} Points
                </Badge>
              )}
              {(() => {
                const milestoneId = task.milestone_id;
                const milestone = milestoneId ? projectMilestones.find(m => (m.id || m._id) === milestoneId) : null;
                if (!milestone) return null;
                return (
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                    <Flag className="h-3.5 w-3.5 mr-1.5" />
                    Phase: {milestone.name}
                  </Badge>
                );
              })()}
            </div>
          </div>

          <div className="p-6 bg-slate-50/80">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* LEFT COLUMN: Main Content + Comments */}
              <div className="lg:col-span-2 space-y-6">

                {/* Description - Highlighted Headers */}
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-950">Description</h3>
                    </div>
                    <div className="pl-1">
                      {renderDescription(task.description)}
                    </div>
                  </CardContent>
                </Card>

                {/* Reference URL */}
                {task.reference_url && (
                  <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Globe className="h-5 w-5 text-white" />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-0.5">Reference Link</h3>
                        <a
                          href={task.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 truncate"
                        >
                          {task.reference_url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Subtasks - UPDATED WITH ACTION BUTTONS */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white overflow-visible">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                            <ListTodo className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-950">Subtasks</h3>
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 font-mono">
                          {task.subtasks.filter(st => st.completed).length} / {task.subtasks.length}
                        </Badge>
                      </div>
                      <div className="space-y-2.5">
                        {task.subtasks.map((subtask, idx) => (
                          <SubtaskRow
                            key={idx}
                            subtask={subtask}
                            index={idx}
                            taskId={task.id}
                            allUsers={allUsers}
                            onUpdate={handleTaskUpdateFromEdit}
                            onDelete={handleDeleteSubtask}
                            currentUser={currentUser}
                            project={project}
                            reworkAlarms={reworkAlarms}
                            isLocked={isLocked}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Blocked By (Dependencies) */}
                {((task.dependencies && task.dependencies.length > 0) || relatedTasks.length > 0) && (
                  <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
                          <LinkIcon className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-amber-950">Blocked By</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {relatedTasks.map((depTask) => (
                          <Badge key={depTask.id} className="bg-white border-amber-200 text-amber-800 hover:bg-amber-50 pl-2 pr-3 py-1.5 flex items-center gap-2 shadow-sm">
                            <MoveRight className="h-3 w-3 text-amber-500" />
                            {depTask.title}
                          </Badge>
                        ))}
                        {task.dependencies
                          .filter(depId => !relatedTasks.some(rt => rt.id === depId))
                          .map((customDep, index) => (
                            <Badge key={`custom-${index}`} className="bg-white border-amber-200 text-amber-800 flex items-center gap-2 pl-2 pr-3 py-1.5 shadow-sm">
                              <MoveRight className="h-3 w-3 text-amber-500" />
                              {customDep}
                            </Badge>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Comments Section */}
                <CommentsSection
                  comments={comments}
                  users={allUsers}
                  mentionableUsers={allUsers.filter(u => project?.team_members?.some(m => m.email === u.email))}
                  entityType="task"
                  entityId={taskId}
                  entityName={task.title}
                  currentUser={currentUser}
                  loading={commentsLoading}
                  highlightCommentId={highlightCommentId}
                />

              </div>

              {/* RIGHT COLUMN: Sidebar (Timeline, Labels, etc.) */}
              <div className="space-y-6">

                {/* Timeline & Assigned To */}
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <CalendarIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Timeline & Team</span>
                  </div>
                  <CardContent className="p-4 space-y-5">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Due Date</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800">
                            {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : "None"}
                          </p>
                          {task.due_date && differenceInDays(new Date(), parseISO(task.due_date)) >= 1 && (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none text-[8px] h-4 px-1 py-0 shadow-none animate-pulse">
                              OVERDUE
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Estimate</p>
                        <p className="text-sm font-bold text-slate-800">
                          {task.estimated_hours || 0} hrs
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Assigned To - Vertical List */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</span>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-300 font-mono">{assignees.length}</Badge>
                      </div>

                      {assignees.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {assignees.map((assignee) => (
                            <div
                              key={assignee.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all shadow-sm"
                            >
                              <Avatar className="h-8 w-8 border border-white shadow-sm ring-1 ring-slate-100">
                                <AvatarImage src={assignee.profile_image_url} />
                                <AvatarFallback className="text-[10px] bg-indigo-600 text-white font-bold">
                                  {(assignee.full_name?.substring(0, 2) || assignee.email?.substring(0, 2) || 'U').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{assignee.full_name || assignee.email || 'Unknown User'}</p>
                                <p className="text-[10px] text-slate-500 truncate">{assignee.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <UserIcon className="h-5 w-5 mx-auto text-slate-300 mb-1" />
                          <span className="text-xs text-slate-400">Unassigned</span>
                        </div>
                      )}
                    </div>

                    {/* Report Impediment Button - Only if Overdue >= 2 Days */}
                    {task.due_date && (() => {
                      const today = new Date();
                      const dueDate = parseISO(task.due_date);
                      // Calculate difference: today - dueDate. Positive means overdue.
                      const diff = differenceInDays(today, dueDate);

                      if (diff >= 2) {
                        return (
                          <div className="pt-2">
                            <Button
                              onClick={() => setShowImpedimentDialog(true)}
                              size="sm"
                              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-sm transition-all hover:shadow hover:border-red-300"
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Report Impediment
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>

                {/* AI Priority Suggestions (Only if Overdue) */}
                {task.due_date && differenceInDays(new Date(), parseISO(task.due_date)) >= 1 && (
                  <Card className="border-red-200 shadow-sm bg-red-50/50">
                    <div className="bg-red-100 p-3 border-b border-red-200 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center animate-pulse">
                        <Siren className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-red-900">Action Required</span>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                        <p className="text-xs font-bold text-red-800 mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Overdue Alert
                        </p>
                        <p className="text-sm text-slate-700 leading-snug">
                          This task is overdue. System recommends immediate reprioritization.
                          <span className="block font-semibold mt-1 text-red-700">Please meet with your Project Manager.</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">AI Suggestions</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                            <MoveRight className="h-3 w-3 text-blue-500" />
                            <span>Change Priority to <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none ml-1">Urgent</Badge></span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                            <MoveRight className="h-3 w-3 text-blue-500" />
                            <span>Extend Due Date to <strong>{format(addDays(new Date(), 3), "MMM d")}</strong></span>
                          </div>
                          {(task.story_points > 5 || !task.story_points) && (
                            <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                              <MoveRight className="h-3 w-3 text-blue-500" />
                              <span>Review <span className="font-semibold">Story Points</span> (High Complexity)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Labels - Vertical Step-wise */}
                {task.labels && task.labels.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
                        <Tag className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Labels</span>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex flex-col items-start gap-2">
                        {task.labels.map((label, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm w-full hover:bg-slate-50 transition-colors"
                          >
                            <div className="h-2 w-2 rounded-full bg-rose-400 ring-2 ring-rose-100" />
                            {label}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Acceptance Criteria */}
                {task.acceptance_criteria && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Acceptance Criteria</span>
                    </div>
                    <CardContent className="p-4">
                      {renderAcceptanceCriteria(task.acceptance_criteria)}
                    </CardContent>
                  </Card>
                )}

                {/* Attachments */}
                {task.attachments && task.attachments.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                        <Paperclip className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Attachments</span>
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {task.attachments.map((file, index) => (
                          <a
                            key={index}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg hover:border-sky-300 hover:shadow-sm hover:bg-sky-50/20 transition-all group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 text-sky-600">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate group-hover:text-sky-700">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase font-medium">
                                {file.name.split('.').pop() || 'FILE'}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Impediment Dialog */}
      <Dialog open={showImpedimentDialog} onOpenChange={setShowImpedimentDialog}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col gap-0 mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Report Impediment
            </DialogTitle>
            <DialogDescription>
              This impediment will be directly linked to task <span className="font-medium text-slate-900">{task?.title}</span>.
            </DialogDescription>
          </div>

          <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">

            {/* Link to Existing / Create New */}
            <div>
              <label className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                <LinkIcon className="h-3.5 w-3.5" />
                Link to Existing Impediment
              </label>
              <Select
                value={selectedImpedimentId}
                onValueChange={setSelectedImpedimentId}
              >
                <SelectTrigger className="bg-white border-red-200 focus:ring-red-500">
                  <SelectValue placeholder="Select existing impediment or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Impediment</SelectItem>
                  {projectImpediments
                    .filter(imp => imp.status !== 'resolved')
                    .map(impediment => (
                      <SelectItem key={impediment.id || impediment._id} value={impediment.id || impediment._id}>
                        {impediment.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedImpedimentId === "new" ? (
              <>
                <div>
                  <label htmlFor="impediment-title" className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Impediment Title *
                  </label>
                  <input
                    id="impediment-title"
                    value={impedimentData.title}
                    onChange={(e) => setImpedimentData({ ...impedimentData, title: e.target.value })}
                    placeholder="Brief description of the impediment"
                    className="flex h-10 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="impediment-description" className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                    <AlignLeft className="h-3.5 w-3.5" />
                    Description
                  </label>
                  <textarea
                    id="impediment-description"
                    value={impedimentData.description}
                    onChange={(e) => setImpedimentData({ ...impedimentData, description: e.target.value })}
                    placeholder="Detailed explanation and impact"
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="impediment-severity" className="text-sm font-semibold text-red-900 flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Severity
                  </label>
                  <Select
                    value={impedimentData.severity}
                    onValueChange={(val) => setImpedimentData({ ...impedimentData, severity: val })}
                  >
                    <SelectTrigger className="bg-white border-red-200 focus:ring-red-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                      <SelectItem value="medium">Medium - Slowing progress</SelectItem>
                      <SelectItem value="high">High - Blocking work</SelectItem>
                      <SelectItem value="critical">Critical - Sprint at risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 flex items-center gap-2">
                  <LinkIcon className="h-3 w-3" />
                  This task will be linked to the selected impediment.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImpedimentDialog(false)}
                disabled={isReporting}
                className="bg-white hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReportImpediment}
                disabled={isReporting || (selectedImpedimentId === "new" && !impedimentData.title.trim())}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isReporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {selectedImpedimentId === "new" ? "Reporting..." : "Linking..."}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {selectedImpedimentId === "new" ? "Report Impediment" : "Link Impediment"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditDialog && (
        <EditTaskDialog
          open={showEditDialog}
          onClose={handleCloseEditDialog}
          task={task}
          onUpdate={handleTaskUpdateFromEdit}
        />
      )
      }
    </>
  );
}

