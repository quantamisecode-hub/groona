import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectItemRich, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MoveRight, Link as LinkIcon, Users, Check, X, Plus, Upload, Paperclip, FileIcon, Trash2, BookOpen, Wand2, AlignLeft, Siren } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "../shared/UserContext";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

export default function EditTaskDialog({ open, onClose, task, onUpdate = null }) {
  const queryClient = useQueryClient();
  const { user: currentUser, effectiveTenantId } = useUser();

  const [newSubtask, setNewSubtask] = useState("");
  const [customDependency, setCustomDependency] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const fileInputRef = React.useRef(null);

  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u =>
        u.tenant_id === effectiveTenantId &&
        !u.is_super_admin &&
        u.custom_role !== 'client'
      );
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      const tasks = await groonabackend.entities.Task.filter({ project_id: task.project_id });
      return tasks.filter(t => t.id !== task.id);
    },
    enabled: !!task?.project_id,
  });

  const { data: projectSprints = [] } = useQuery({
    queryKey: ['sprints', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return groonabackend.entities.Sprint.filter({ project_id: task.project_id }, '-start_date');
    },
    enabled: !!task?.project_id,
  });

  const { data: projectStories = [] } = useQuery({
    queryKey: ['stories', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return groonabackend.entities.Story.filter({ project_id: task.project_id });
    },
    enabled: !!task?.project_id,
  });

  const { data: projectEpics = [] } = useQuery({
    queryKey: ['epics', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return [];
      return groonabackend.entities.Epic.filter({ project_id: task.project_id });
    },
    enabled: !!task?.project_id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return null;
      const projects = await groonabackend.entities.Project.list();
      return projects.find(p => (p.id === task.project_id) || (p._id === task.project_id));
    },
    enabled: !!task?.project_id && open,
  });



  // Fetch active rework alarms
  const { data: reworkAlarms = [] } = useQuery({
    queryKey: ['rework-alarms', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return await groonabackend.entities.Notification.filter({
        tenant_id: effectiveTenantId,
        type: 'high_rework_alarm',
        status: 'OPEN'
      });
    },
    enabled: !!effectiveTenantId && open,
    refetchInterval: 30000,
  });
  console.log('DEBUG: EditTaskDialog reworkAlarms:', reworkAlarms); // DEBUG LOG

  const [assignmentError, setAssignmentError] = useState("");

  const [formData, setFormData] = useState(() => {
    // Lazy initialization to ensure stable state on mount
    if (task) {
      // Defensive mapping for IDs
      const storyId = task.story_id?.id || task.story_id?._id || (typeof task.story_id === 'string' ? task.story_id : "");
      const sprintId = task.sprint_id?.id || task.sprint_id?._id || (typeof task.sprint_id === 'string' ? task.sprint_id : "");

      // Defensive mapping for Assigned To
      const rawAssignedTo = task.assigned_to;
      const assignedTo = Array.isArray(rawAssignedTo)
        ? rawAssignedTo.map(a => (typeof a === 'string' ? a : (a?.email || a?.id || ""))).filter(Boolean)
        : (rawAssignedTo ? [typeof rawAssignedTo === 'string' ? rawAssignedTo : (rawAssignedTo?.email || rawAssignedTo?.id || "")] : []);

      return {
        title: task.title || "",
        reference_url: task.reference_url || "",
        story_id: storyId,
        sprint_id: sprintId,
        description: task.description || "",
        status: task.status || "todo",
        priority: task.priority || "medium",
        task_type: task.task_type || "task",
        assigned_to: assignedTo,
        due_date: task.due_date ? task.due_date.split('T')[0] : "",
        estimated_hours: task.estimated_hours !== undefined ? task.estimated_hours : 0,
        story_points: task.story_points !== undefined ? task.story_points : 0,
        dependencies: task.dependencies || [],
        subtasks: task.subtasks || [],
        attachments: task.attachments || [],
      };
    }
    return {
      title: "",
      reference_url: "",
      story_id: "",
      sprint_id: "",
      description: "",
      status: "todo",
      priority: "medium",
      task_type: "task",
      assigned_to: [],
      due_date: "",
      estimated_hours: 0,
      story_points: 0,
      subtasks: [],
      attachments: [],
      dependencies: [],
    };
  });

  const filteredUsers = React.useMemo(() => {
    // Stricter filtering: If no story is selected, show no assignees
    if (!formData.story_id) return [];

    // Determine the project to filter by
    if (!project || !project.team_members) return users;

    const teamEmails = project.team_members.map(m => m.email);
    return users.filter(u => teamEmails.includes(u.email));
  }, [users, project, formData.story_id]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data) => {
      if (!effectiveTenantId) {
        throw new Error('Cannot update task: Tenant ID is missing or invalid');
      }

      const originalAssignedTo = task.assigned_to;
      const cleanedData = { ...data };

      if (!Array.isArray(cleanedData.assigned_to)) {
        cleanedData.assigned_to = [];
      }
      if (cleanedData.assigned_to.length === 0) {
        cleanedData.assigned_to = undefined;
      }
      if (!cleanedData.due_date || cleanedData.due_date.trim() === '') {
        cleanedData.due_date = undefined;
      }
      if (!cleanedData.description || cleanedData.description.trim() === '') {
        cleanedData.description = undefined;
      }
      if (!cleanedData.reference_url || cleanedData.reference_url.trim() === '') {
        cleanedData.reference_url = undefined;
      }
      if (!cleanedData.story_id || cleanedData.story_id.trim() === '') {
        cleanedData.story_id = undefined;
      }
      if (!cleanedData.sprint_id || cleanedData.sprint_id.trim() === '') {
        cleanedData.sprint_id = undefined;
      }
      if (!Array.isArray(cleanedData.subtasks)) {
        cleanedData.subtasks = [];
      }

      const updated = await groonabackend.entities.Task.update(task.id, cleanedData);

      // LOG ACTIVITY & NOTIFICATIONS
      if (currentUser && effectiveTenantId) {
        try {
          await groonabackend.entities.Activity.create({
            tenant_id: effectiveTenantId,
            action: 'updated',
            entity_type: 'task',
            entity_id: task.id,
            entity_name: cleanedData.title,
            project_id: task.project_id,
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            details: 'Updated task details',
          });
        } catch (activityError) {
          console.error('[EditTaskDialog] Failed to log activity:', activityError);
        }

        const newAssignees = Array.isArray(cleanedData.assigned_to) ? cleanedData.assigned_to : [];
        const oldAssignees = Array.isArray(originalAssignedTo)
          ? originalAssignedTo
          : (originalAssignedTo ? [originalAssignedTo] : []);

        const addedAssignees = newAssignees.filter(email => !oldAssignees.includes(email));
        const removedAssignees = oldAssignees.filter(email => !newAssignees.includes(email));
        const isReassigned = addedAssignees.length > 0 || removedAssignees.length > 0;
        const isEdited = JSON.stringify(cleanedData) !== JSON.stringify({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          task_type: task.task_type,
          assigned_to: originalAssignedTo,
          due_date: task.due_date,
          estimated_hours: task.estimated_hours,

          story_points: task.story_points,
          subtasks: task.subtasks
        });

        // Notify newly assigned users
        if (addedAssignees.length > 0) {
          await Promise.all(addedAssignees.map(async (assigneeEmail) => {
            if (assigneeEmail !== currentUser.email) {
              try {
                await groonabackend.entities.Notification.create({
                  tenant_id: effectiveTenantId,
                  recipient_email: assigneeEmail,
                  type: 'task_assigned',
                  title: 'Task Assigned',
                  message: `${currentUser.full_name} assigned you to task: ${cleanedData.title}`,
                  entity_type: 'task',
                  entity_id: task.id,
                  sender_name: currentUser.full_name,
                });
              } catch (notifError) {
                console.error(`Failed to send notification to ${assigneeEmail}:`, notifError);
              }
            }
          }));
        }

        // Notify removed assignees
        if (removedAssignees.length > 0) {
          await Promise.all(removedAssignees.map(async (assigneeEmail) => {
            if (assigneeEmail !== currentUser.email) {
              try {
                await groonabackend.entities.Notification.create({
                  tenant_id: effectiveTenantId,
                  recipient_email: assigneeEmail,
                  type: 'task_unassigned',
                  title: 'Task Unassigned',
                  message: `You have been unassigned from task: ${cleanedData.title}`,
                  entity_type: 'task',
                  entity_id: task.id,
                  sender_name: currentUser.full_name,
                });
              } catch (notifError) {
                console.error(`Failed to send notification to ${assigneeEmail}:`, notifError);
              }
            }
          }));
        }

        // Notify existing assignees if task was edited (but not reassigned to them)
        if (isEdited && !isReassigned && newAssignees.length > 0) {
          await Promise.all(newAssignees.map(async (assigneeEmail) => {
            if (assigneeEmail !== currentUser.email) {
              try {
                await groonabackend.entities.Notification.create({
                  tenant_id: effectiveTenantId,
                  recipient_email: assigneeEmail,
                  type: 'task_updated',
                  title: 'Task Updated',
                  message: `${currentUser.full_name} updated task: ${cleanedData.title}`,
                  entity_type: 'task',
                  entity_id: task.id,
                  sender_name: currentUser.full_name,
                });
              } catch (notifError) {
                console.error(`Failed to send notification to ${assigneeEmail}:`, notifError);
              }
            }
          }));
        }
      }

      return updated;
    },
    onSuccess: (updatedTask) => {
      toast.success('Task updated successfully');

      // --- ROBUST INVALIDATION ---
      queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] }); // Update Detail View

      // Force refresh of the Project's task list specifically
      if (task.project_id) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      }

      // General invalidations
      queryClient.invalidateQueries({ queryKey: ['sprint-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['bi-tasks'] });

      // Invalidate sprints if sprint_id changed
      if (task.project_id) {
        queryClient.invalidateQueries({ queryKey: ['sprints', task.project_id] });
      }

      // Refresh activities
      if (task.project_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', task.project_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      }

      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate(updatedTask);
      }

      onClose();
    },
    onError: (error) => {
      const msg = error.response?.data?.error || error.message || 'Please try again.';
      if (msg.includes("High Rework") || msg.includes("frozen")) {
        setAssignmentError(msg);
      }
      toast.error('Failed to update task', {
        description: msg
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (!effectiveTenantId) {
      toast.error('Cannot update task: Tenant context is missing');
      return;
    }
    updateTaskMutation.mutate(formData);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      const newAttachment = {
        name: file.name,
        url: file_url,
        type: file.type,
      };
      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      }));
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setFormData(prev => ({
        ...prev,
        subtasks: [...(prev.subtasks || []), { title: newSubtask.trim(), completed: false }]
      }));
      setNewSubtask("");
    }
  };

  const removeSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter((_, i) => i !== index)
    }));
  };

  const toggleSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).map((st, i) => i === index ? { ...st, completed: !st.completed } : st)
    }));
  };

  const handleGenerateDescription = async () => {
    if (!formData.title?.trim()) {
      toast.error("Please enter a Task Title first.");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const prompt = `You are a senior project manager. Based on the task title "${formData.title}" and any initial description provided ("${formData.description || ''}"), generate a professional task overview.
      
      The description should:
      - Be a clear, concise overview of the task in a single paragraph
      - Do NOT include Key Requirements or Scope sections
      - Just provide a neat overview
      
      Output strictly in JSON format with the following field:
      - description: The task overview in HTML format (use <p>, <ul>, <li>, <strong> tags).`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" }
          }
        }
      });

      const generatedDescription = response.description || response;
      setFormData(prev => ({ ...prev, description: generatedDescription }));
      toast.success("Description generated successfully!");
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate description. Please check your connection.");
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const statusOptions = [
    { value: "todo", label: "To Do", color: "bg-slate-500" },
    { value: "in_progress", label: "In Progress", color: "bg-blue-500" },
    { value: "review", label: "In Review", color: "bg-amber-500" },
    { value: "completed", label: "Done", color: "bg-emerald-500" },
  ];

  const priorityOptions = [
    { value: "low", label: "Low", color: "bg-blue-500" },
    { value: "medium", label: "Medium", color: "bg-amber-500" },
    { value: "high", label: "High", color: "bg-orange-500" },
    { value: "urgent", label: "Urgent", color: "bg-red-500" },
  ];

  const taskTypeOptions = [
    { value: "bug", label: "Bug", icon: "🐛" },
    { value: "task", label: "Task", icon: "✓" },
    { value: "technical_debt", label: "Tech Debt", icon: "🔧" },
  ];

  const storyPointOptions = [
    { value: 0, label: "0 Points (0 hours)" },
    { value: 1, label: "1 Point (2 hours)" },
    { value: 2, label: "2 Points (4 hours)" },
    { value: 3, label: "3 Points (8 hours)" },
    { value: 5, label: "5 Points (16 hours)" },
    { value: 8, label: "8 Points (32 hours)" },
    { value: 13, label: "13 Points (64 hours)" },
  ];



  // Fetch active overdue alarm for this task
  const { data: overdueAlarm } = useQuery({
    queryKey: ['task-overdue-alarm', task?.id],
    queryFn: async () => {
      if (!task?.id) return null;
      const alarms = await groonabackend.entities.Notification.filter({
        type: 'task_delay_alarm',
        entity_id: task.id,
        status: 'OPEN'
      });
      return alarms.length > 0 ? alarms[0] : null;
    },
    enabled: !!task?.id && open
  });

  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [blockerReason, setBlockerReason] = useState("");

  const reportBlockerMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTenantId || !currentUser) return;

      // Create Impediment
      await groonabackend.entities.Impediment.create({
        tenant_id: effectiveTenantId,
        task_id: task.id,
        project_id: task.project_id,
        reported_by: currentUser.id, // or email depending on schema
        description: blockerReason,
        status: 'open',
        severity: 'high', // Critical delay implies high severity
        raised_at: new Date()
      });

      // Also resolve the alarm? Or keep it? Usually reporting blocker addresses the "action required".
      // User request: "deep link the alert review button... report blockers in that particular task only after user task Overdue 2 days"
      // It implies reporting blocker is the action.
      // Let's optionally resolve the alarm if blocker is reported to clear the noise?
      // Or keep alarm open until task is actually moved?
      // I'll keep alarm open but maybe show "Blocker Reported".
      // For now, just create impediment.
    },
    onSuccess: () => {
      toast.success("Blocker Reported Successfully");
      setShowBlockerForm(false);
      setBlockerReason("");
    },
    onError: () => toast.error("Failed to report blocker")
  });

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        setShowBlockerForm(false);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white backdrop-blur-xl border-slate-200/60 shadow-2xl p-0 gap-0">

        {/* OVERDUE ALERT BANNER */}
        {overdueAlarm && (
          <div className="bg-red-50 border-b border-red-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Siren className="h-5 w-5 text-red-600 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-red-900 flex items-center gap-2">
                  Alert: Task Overdue &gt; 2 Days
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] h-5">Action Required</Badge>
                </h4>
                <p className="text-sm text-red-700">This task is critically delayed. Please update status or report blockers.</p>
              </div>
            </div>
            {!showBlockerForm ? (
              <Button
                variant="destructive"
                size="sm"
                className="whitespace-nowrap shadow-sm hover:shadow-md transition-all"
                onClick={() => setShowBlockerForm(true)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report Blocker
              </Button>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Describe blocker..."
                  className="h-8 text-xs bg-white border-red-200 focus:ring-red-500"
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-8 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => reportBlockerMutation.mutate()}
                  disabled={!blockerReason.trim() || reportBlockerMutation.isPending}
                >
                  {reportBlockerMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-700 hover:bg-red-100"
                  onClick={() => setShowBlockerForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl">Edit Task</DialogTitle>
          <DialogDescription id="edit-task-description">
            Update task details, assignment, and status
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4 px-6 pb-6">

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              disabled={updateTaskMutation.isPending}
            />
          </div>

          {/* Story - Full Width */}
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="story_id" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              Story
            </Label>
            <Select
              value={formData.story_id || "unassigned"}
              onValueChange={(value) => {
                const newStoryId = value === "unassigned" ? "" : value;
                const selectedStory = projectStories.find(s => (s.id || s._id) === newStoryId);

                setFormData(prev => {
                  const updates = { ...prev, story_id: newStoryId };
                  // Auto-set sprint if story has one
                  if (selectedStory?.sprint_id) {
                    const sprintId = selectedStory.sprint_id?.id || selectedStory.sprint_id?._id || selectedStory.sprint_id;
                    updates.sprint_id = sprintId ? String(sprintId) : "";
                  } else if (!newStoryId) {
                    // Clear sprint if story is unselected
                    updates.sprint_id = "";
                  }
                  return updates;
                });
              }}
              disabled={updateTaskMutation.isPending}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select story..." />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[300px] max-h-80 overflow-x-auto">
                <SelectItem value="unassigned">No Story</SelectItem>
                {projectStories.length === 0 ? (
                  <SelectItem value="no-stories" disabled>
                    No stories available
                  </SelectItem>
                ) : (
                  projectStories.map(story => {
                    const epicId = story.epic_id?.id || story.epic_id?._id || story.epic_id;
                    const epic = epicId ? projectEpics.find(e => String(e.id || e._id) === String(epicId)) : null;
                    const sprintId = story.sprint_id?.id || story.sprint_id?._id || story.sprint_id;
                    const sprint = sprintId ? projectSprints.find(s => String(s.id || s._id) === String(sprintId)) : null;

                    return (
                      <SelectItemRich
                        key={story.id || story._id}
                        value={story.id || story._id}
                        richContent={
                          <div className="flex items-center gap-2 flex-shrink-0 ml-auto pr-6">
                            {epic && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50/50 text-blue-700 border-blue-200 gap-1 px-1.5 py-0 h-5 whitespace-nowrap">
                                <span className="font-bold">Epic:</span>
                                <span>{epic.name}</span>
                              </Badge>
                            )}
                            {sprint && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50/50 text-purple-700 border-purple-200 gap-1 px-1.5 py-0 h-5 whitespace-nowrap">
                                <span className="font-bold">Sprint:</span>
                                <span>{sprint.name}</span>
                              </Badge>
                            )}
                          </div>
                        }
                      >
                        <span className="font-medium text-slate-900 whitespace-nowrap">{story.title}</span>
                      </SelectItemRich>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {formData.story_id && (() => {
              const selectedStory = projectStories.find(s => (s.id || s._id) === formData.story_id);
              if (!selectedStory) return null;
              const epicId = selectedStory.epic_id?.id || selectedStory.epic_id?._id || selectedStory.epic_id;
              const epic = epicId ? projectEpics.find(e => String(e.id || e._id) === String(epicId)) : null;
              const sprintId = selectedStory.sprint_id?.id || selectedStory.sprint_id?._id || selectedStory.sprint_id;
              const sprint = sprintId ? projectSprints.find(s => String(s.id || s._id) === String(sprintId)) : null;

              return (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {epic && (
                    <Badge variant="outline" className="text-xs bg-blue-50/50 text-blue-700 border-blue-200 gap-1.5 px-2 py-0.5">
                      <span className="font-bold">Epic:</span>
                      <span>{epic.name}</span>
                    </Badge>
                  )}
                  {sprint && (
                    <Badge variant="outline" className="text-xs bg-purple-50/50 text-purple-700 border-purple-200 gap-1.5 px-2 py-0.5">
                      <span className="font-bold">Sprint:</span>
                      <span>{sprint.name}</span>
                    </Badge>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Assigned To and Reference URL - Side by Side */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-2">
            {/* Assigned To */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                Assigned To
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-auto min-h-10 px-3 py-2"
                    disabled={updateTaskMutation.isPending}
                  >
                    {formData.assigned_to && formData.assigned_to.length > 0
                      ? <div className="flex flex-wrap gap-1">
                        {formData.assigned_to.map(assigneeEmail => {
                          const user = users.find(u => u.email === assigneeEmail);
                          const initials = user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) : assigneeEmail.slice(0, 2).toUpperCase();
                          return (
                            <Badge key={assigneeEmail} variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={user?.profile_image_url} />
                                <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                              </Avatar>
                              <span className="truncate max-w-[80px]">{user?.full_name || assigneeEmail.split('@')[0]}</span>
                              <X
                                className="h-3 w-3 cursor-pointer hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData(prev => ({
                                    ...prev,
                                    assigned_to: prev.assigned_to.filter(email => email !== assigneeEmail)
                                  }));
                                }}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                      : <span className="text-slate-500">Select assignees...</span>}
                    <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandEmpty>No user found.</CommandEmpty>
                      <CommandGroup className="overflow-visible">
                        {filteredUsers.map((user) => {
                          const isSelected = Array.isArray(formData.assigned_to) && formData.assigned_to.includes(user.email);
                          const hasReworkAlarm = reworkAlarms.some(alarm => alarm.recipient_email === user.email);
                          return (
                            <CommandItem
                              key={user.id}
                              value={user.email}
                              onSelect={() => {
                                if (user.is_overdue_blocked && !isSelected) {
                                  const msg = "Cannot assign task: User has multiple overdue tasks.";
                                  toast.error(msg);
                                  setAssignmentError(msg);
                                  return;
                                }

                                const hasReworkAlarm = reworkAlarms.some(alarm => alarm.recipient_email === user.email);
                                if (hasReworkAlarm && !isSelected) {
                                  const msg = "Cannot assign task: User has too many rework tasks.";
                                  toast.error(msg);
                                  setAssignmentError(msg);
                                  return;
                                }

                                const currentAssignees = Array.isArray(formData.assigned_to) ? formData.assigned_to : [];
                                const newAssignees = isSelected
                                  ? currentAssignees.filter((email) => email !== user.email)
                                  : [...currentAssignees, user.email];

                                setAssignmentError(""); // Clear error
                                setFormData(prev => ({ ...prev, assigned_to: newAssignees }));
                              }}
                            >
                              <div className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                              )}>
                                <Check className={cn("h-4 w-4")} />
                              </div>
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarImage src={user.profile_image_url} />
                                <AvatarFallback className="text-xs">
                                  {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className={cn("truncate flex-1", (hasReworkAlarm || user.is_overloaded || user.is_overdue_blocked) && "text-slate-400 line-through")}>{user.full_name}</span>
                              {user.is_overloaded && (
                                <Badge variant="outline" className="ml-auto text-[8px] border-orange-200 bg-orange-50 text-orange-600 gap-1 animate-pulse">
                                  <Siren className="h-2 w-2" />
                                  OVERLOADED
                                </Badge>
                              )}
                              {user.is_overdue_blocked && (
                                <Badge variant="outline" className="ml-auto text-[8px] border-red-200 bg-red-50 text-red-600 gap-1 animate-pulse">
                                  <Siren className="h-2 w-2" />
                                  OVERDUE
                                </Badge>
                              )}
                              {hasReworkAlarm && (
                                <Badge variant="outline" className="ml-auto text-[8px] border-red-200 bg-red-50 text-red-600 gap-1 animate-pulse">
                                  <Siren className="h-2 w-2" />
                                  FROZEN
                                </Badge>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {assignmentError && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[10px] font-bold animate-pulse">
                  <Siren className="h-3.5 w-3.5" />
                  {assignmentError}
                </div>
              )}
            </div>

            {/* Reference URL */}
            <div className="space-y-2">
              <Label htmlFor="reference_url" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-cyan-500" />
                Reference URL
              </Label>
              <Input
                id="reference_url"
                type="url"
                value={formData.reference_url || ""}
                onChange={(e) => setFormData({ ...formData, reference_url: e.target.value })}
                placeholder="https://example.com/design"
                className="h-10"
                disabled={updateTaskMutation.isPending}
              />
            </div>
          </div>

          {/* Description with Draft with AI Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-slate-600" />
                Description
              </Label>
              <Button
                type="button"
                onClick={handleGenerateDescription}
                variant="outline"
                size="sm"
                disabled={isGeneratingDescription || !formData.title || updateTaskMutation.isPending}
                className="text-xs"
              >
                {isGeneratingDescription ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Draft with AI
                  </>
                )}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden resize-y min-h-[150px] max-h-[500px] flex flex-col relative bg-white">
              <div className="flex-1 overflow-y-auto">
                <ReactQuill
                  theme="snow"
                  value={formData.description || ""}
                  onChange={(value) => setFormData({ ...formData, description: value })}
                  placeholder="Enter task description..."
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ["bold", "italic", "underline", "strike"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      [{ color: [] }, { background: [] }],
                      ["link", "code-block"],
                      ["clean"],
                    ],
                  }}
                  style={{ minHeight: "150px", border: "none" }}
                />
              </div>
              <div className="h-2 bg-slate-100 cursor-ns-resize hover:bg-slate-200 transition-colors flex items-center justify-center border-t border-slate-200">
                <div className="w-12 h-1 bg-slate-300 rounded"></div>
              </div>
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <Label className="text-sm font-semibold">Subtasks</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                placeholder="Add a subtask..."
                className="flex-1"
                disabled={updateTaskMutation.isPending}
              />
              <Button onClick={addSubtask} size="sm" type="button" disabled={updateTaskMutation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {(formData.subtasks || []).map((subtask, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(index)}
                    className="h-4 w-4 rounded"
                    disabled={updateTaskMutation.isPending}
                  />
                  <span className={`flex-1 ${subtask.completed ? 'line-through text-slate-500' : ''}`}>
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => removeSubtask(index)}
                    className="text-red-600 hover:text-red-700"
                    type="button"
                    disabled={updateTaskMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MoveRight className="h-4 w-4 text-blue-600" />
                Move to Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={updateTaskMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${option.color}`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
                disabled={updateTaskMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${option.color}`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={formData.task_type}
                onValueChange={(value) => setFormData({ ...formData, task_type: value })}
                disabled={updateTaskMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <span>{option.icon} {option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Story Points</Label>
              <Select
                value={String(formData.story_points)}
                onValueChange={(value) => {
                  const points = parseInt(value);
                  const hoursMap = { 0: 0, 1: 2, 2: 4, 3: 8, 5: 16, 8: 32, 13: 64 };
                  setFormData({
                    ...formData,
                    story_points: points,
                    estimated_hours: hoursMap[points] || 0
                  });
                }}
                disabled={updateTaskMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {storyPointOptions.map(option => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                disabled={updateTaskMutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments
            </Label>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadingFile || updateTaskMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile || updateTaskMutation.isPending}
                className="w-full"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </>
                )}
              </Button>

              {formData.attachments && formData.attachments.length > 0 && (
                <div className="space-y-2">
                  {formData.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-lg bg-slate-50"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm truncate">{attachment.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAttachment(index)}
                        disabled={updateTaskMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Blocked By (Dependencies)
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Type custom dependency..."
                  value={customDependency}
                  onChange={(e) => setCustomDependency(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customDependency.trim()) {
                      e.preventDefault();
                      const currentDeps = formData.dependencies || [];
                      if (!currentDeps.includes(customDependency.trim())) {
                        setFormData({ ...formData, dependencies: [...currentDeps, customDependency.trim()] });
                        setCustomDependency("");
                      }
                    }
                  }}
                  disabled={updateTaskMutation.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (customDependency.trim()) {
                      const currentDeps = formData.dependencies || [];
                      if (!currentDeps.includes(customDependency.trim())) {
                        setFormData({ ...formData, dependencies: [...currentDeps, customDependency.trim()] });
                        setCustomDependency("");
                      }
                    }
                  }}
                  disabled={!customDependency.trim() || updateTaskMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" type="button">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Select from Project Tasks
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search tasks..." />
                    <CommandList>
                      <CommandEmpty>No tasks found.</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-auto">
                        {projectTasks.map(t => (
                          <CommandItem
                            key={t.id}
                            value={t.title}
                            onSelect={() => {
                              const currentDeps = formData.dependencies || [];
                              if (!currentDeps.includes(t.id)) {
                                setFormData({ ...formData, dependencies: [...currentDeps, t.id] });
                              }
                            }}
                          >
                            <span className="truncate">{t.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {formData.dependencies && formData.dependencies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.dependencies.map((depId, index) => {
                    const depTask = projectTasks.find(t => t.id === depId);
                    const displayText = depTask ? depTask.title : depId;
                    return (
                      <Badge key={`${depId}-${index}`} variant="secondary" className="flex items-center gap-1 pr-1">
                        <span className="truncate max-w-[200px]">{displayText}</span>
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-red-500"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              dependencies: prev.dependencies.filter((id, i) => i !== index)
                            }));
                          }}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateTaskMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateTaskMutation.isPending || !effectiveTenantId}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {updateTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

