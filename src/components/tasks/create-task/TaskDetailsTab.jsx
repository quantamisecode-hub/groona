import React, { useState, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Select, SelectContent, SelectItem, SelectItemRich, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Upload, X, Plus, Trash2, Users, Check, Sparkles, Loader2, Wand2, FileIcon, Paperclip, ImageIcon, ClipboardList, Tag, Flag, BookOpen, Target, Clock, User, Link2, Hash, AlignLeft, FolderKanban, AlertTriangle, Siren } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const taskTypes = [
  { value: "epic", label: "Epic", color: "bg-purple-100 text-purple-700" },
  { value: "story", label: "Story", color: "bg-indigo-100 text-indigo-700" },
  { value: "bug", label: "Bug", color: "bg-red-100 text-red-700" },
  { value: "task", label: "Task", color: "bg-blue-100 text-blue-700" },
  { value: "technical_debt", label: "Technical Debt", color: "bg-orange-100 text-orange-700" },
];

const priorities = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-700" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
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

// Helper to calculate hours from points
const getHoursFromPoints = (points) => {
  const map = { 0: 0, 1: 2, 2: 4, 3: 8, 5: 16, 8: 32, 13: 64 };
  return map[points] || 0;
};

export default function TaskDetailsTab({
  taskData,
  setTaskData,
  validationErrors,
  projects,
  users,
  sprints,
  stories = [],
  tasks,
  currentUser,

  onImpedimentDataChange,
  onProjectChange,
  isProjectFixed,
  reworkAlarms = []
}) {
  const [isReportImpediment, setIsReportImpediment] = useState(false);
  const [impedimentData, setImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedImpedimentId, setSelectedImpedimentId] = useState("");

  // Fetch epics for the project
  const { data: epics = [] } = useQuery({
    queryKey: ['epics', taskData.project_id],
    queryFn: async () => {
      if (!taskData.project_id) return [];
      return await groonabackend.entities.Epic.filter({ project_id: taskData.project_id });
    },
    enabled: !!taskData.project_id,
  });

  // Fetch milestones for the project
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', taskData.project_id],
    queryFn: async () => {
      if (!taskData.project_id) return [];
      return await groonabackend.entities.Milestone.filter({ project_id: taskData.project_id });
    },
    enabled: !!taskData.project_id,
  });

  // Fetch impediments for the project
  const { data: projectImpediments = [] } = useQuery({
    queryKey: ['impediments', taskData.project_id],
    queryFn: async () => {
      if (!taskData.project_id) return [];
      return await groonabackend.entities.Impediment.filter({ project_id: taskData.project_id });
    },
    enabled: !!taskData.project_id,
  });

  // Show all stories (no epic filter)
  const filteredStories = React.useMemo(() => {
    return stories;
  }, [stories]);

  // Auto-set sprint when story is selected (if story has a sprint)
  // Also filter assignees based on project team
  const filteredUsers = React.useMemo(() => {
    if (!taskData.story_id) return [];

    const selectedStory = stories.find(s => (s.id || s._id) === taskData.story_id);
    if (!selectedStory) return users;

    const projectId = selectedStory.project_id?.id || selectedStory.project_id?._id || selectedStory.project_id;
    const project = projects.find(p => (p.id || p._id) === projectId);

    if (!project || !project.team_members) return users;

    const teamEmails = project.team_members.map(m => m.email);
    return users.filter(u => teamEmails.includes(u.email));
  }, [taskData.story_id, stories, users, projects]);

  React.useEffect(() => {
    if (taskData.story_id) {
      const selectedStory = stories.find(s => (s.id || s._id) === taskData.story_id);

      // Auto-set sprint
      if (selectedStory?.sprint_id && !taskData.sprint_id) {
        setTaskData(prev => ({ ...prev, sprint_id: selectedStory.sprint_id }));
      }

      // Filter out existing assignees who are not in the project team
      const projectId = selectedStory?.project_id?.id || selectedStory?.project_id?._id || selectedStory?.project_id;
      const project = projects.find(p => (p.id || p._id) === projectId);

      if (project && project.team_members && taskData.assigned_to?.length > 0) {
        const teamEmails = project.team_members.map(m => m.email);
        const validAssignees = taskData.assigned_to.filter(email => teamEmails.includes(email));

        if (validAssignees.length !== taskData.assigned_to.length) {
          setTaskData(prev => ({ ...prev, assigned_to: validAssignees }));
        }
      }
    }
  }, [taskData.story_id, stories, projects, setTaskData]);

  // Milestone inheritance from Sprint
  React.useEffect(() => {
    if (taskData.sprint_id && taskData.sprint_id !== "unassigned") {
      const selectedSprint = sprints.find(s => (s.id || s._id) === taskData.sprint_id);
      if (selectedSprint?.milestone_id && !taskData.milestone_id) {
        setTaskData(prev => ({ ...prev, milestone_id: selectedSprint.milestone_id }));
      }
    }
  }, [taskData.sprint_id, sprints, setTaskData]);


  // Notify parent when impediment data changes
  React.useEffect(() => {
    if (onImpedimentDataChange && typeof onImpedimentDataChange === 'function') {
      onImpedimentDataChange(impedimentData, selectedImpedimentId, isReportImpediment ? "impediment" : "task");
    }
  }, [impedimentData, selectedImpedimentId, isReportImpediment]);

  const [newLabel, setNewLabel] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localError, setLocalError] = useState("");

  // Ref for file input imitation
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
        return {
          name: file.name,
          url: file_url,
          type: file.type || 'application/octet-stream',
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setTaskData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploadedFiles]
      }));
      toast.success(`${uploadedFiles.length} file(s) attached`);
    } catch (error) {
      toast.error('Failed to attach files');
      console.error(error);
    } finally {
      setIsUploading(false);
      // Reset input to allow selecting same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index) => {
    setTaskData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  // ... (Label, Subtask, and Toggle functions remain same) ...
  const addLabel = () => {
    if (newLabel.trim() && !taskData.labels.includes(newLabel.trim())) {
      setTaskData(prev => ({ ...prev, labels: [...prev.labels, newLabel.trim()] }));
      setNewLabel("");
    }
  };

  const removeLabel = (label) => {
    setTaskData(prev => ({ ...prev, labels: prev.labels.filter(l => l !== label) }));
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setTaskData(prev => ({ ...prev, subtasks: [...prev.subtasks, { title: newSubtask.trim(), completed: false }] }));
      setNewSubtask("");
    }
  };

  const removeSubtask = (index) => {
    setTaskData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) }));
  };

  const toggleSubtask = (index) => {
    setTaskData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map((st, i) => i === index ? { ...st, completed: !st.completed } : st)
    }));
  };

  // --- FULL TASK AUTO-GENERATION ---
  const handleAutoGenerate = async () => {
    if (!taskData.title?.trim()) {
      toast.error("Please enter a Task Title first.");
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `You are a senior project manager. Based on the task title "${taskData.title}" and any initial description provided ("${taskData.description || ''}"), generate a professional task overview.
      
      Output strictly in JSON format with these fields:
      1. description: A clear, concise overview of the task in a single paragraph. Do NOT include Key Requirements or Scope sections. Just provide a neat overview.
      2. priority: One of [low, medium, high, urgent] based on implied importance.
      3. story_points: Estimate complexity using Fibonacci (1, 2, 3, 5, 8, 13).
      4. labels: Array of 3-5 relevant short tags (strings).
      5. acceptance_criteria: A string of clear bullet points. DO NOT use markdown stars or bolding. Use standard bullets (-) or numbering.
      6. subtasks: Array of strings representing actionable steps.
      
      Context: Software development environment.`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" },
            priority: { type: "string" },
            story_points: { type: "number" },
            labels: { type: "array", items: { type: "string" } },
            acceptance_criteria: { type: "string" },
            subtasks: { type: "array", items: { type: "string" } }
          }
        }
      });

      // Process and apply data
      const suggestedPoints = typeof response.story_points === 'number' ? response.story_points : (taskData.story_points || 1);
      const calculatedHours = getHoursFromPoints(suggestedPoints);

      setTaskData(prev => ({
        ...prev,
        description: response.description || prev.description,
        priority: ['low', 'medium', 'high', 'urgent'].includes(response.priority?.toLowerCase()) ? response.priority.toLowerCase() : prev.priority,
        story_points: suggestedPoints,
        estimated_hours: calculatedHours,
        labels: [...new Set([...(prev.labels || []), ...(response.labels || [])])],
        acceptance_criteria: response.acceptance_criteria || prev.acceptance_criteria,
        subtasks: [
          ...(prev.subtasks || []),
          ...(response.subtasks || []).map(title => ({ title, completed: false }))
        ],
        ai_generated: true,
      }));

      toast.success("Task details auto-generated successfully!");
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate task details. Please check your connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Fields */}
      <div className="space-y-4">
        {/* Project Selection (Hidden as requested) */}
        {false && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-purple-500" />
                Project
              </Label>
              <Select
                value={taskData.project_id || ""}
                onValueChange={(value) => {
                  if (onProjectChange) onProjectChange(value);
                }}
                disabled={isProjectFixed}
              >
                <SelectTrigger className={validationErrors.project_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id || p._id} value={p.id || p._id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task Title */}
        <div className="md:col-span-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-500" />
            Task Title *
          </Label>
          <Input
            value={taskData.title}
            onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
            placeholder="e.g., Implement User Login with Google Auth"
            className={validationErrors.title ? 'border-red-500' : ''}
          />
          {validationErrors.title && (
            <p className="text-xs text-red-600 mt-1">{validationErrors.title}</p>
          )}
        </div>

        {/* Task Type */}
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-purple-500" />
            Task Type
          </Label>
          <Select value={taskData.task_type} onValueChange={(value) => setTaskData({ ...taskData, task_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <Badge className={`${type.color} text-xs`}>{type.label}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-500" />
            Priority
          </Label>
          <Select value={taskData.priority} onValueChange={(value) => setTaskData({ ...taskData, priority: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map(priority => (
                <SelectItem key={priority.value} value={priority.value}>
                  <div className="flex items-center gap-2">
                    <Badge className={`${priority.color} text-xs`}>{priority.label}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Milestone Selection */}
        <div className="md:col-span-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4 text-blue-500" />
            Project Milestone
          </Label>
          <Select
            value={taskData.milestone_id || "unassigned"}
            onValueChange={(value) => setTaskData({ ...taskData, milestone_id: value === "unassigned" ? null : value })}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select Milestone (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">No Milestone</SelectItem>
              {milestones
                .filter(m => m.status === 'in_progress' || (taskData.milestone_id && (m.id === taskData.milestone_id || m._id === taskData.milestone_id)))
                .map(m => (
                  <SelectItem key={m.id || m._id} value={m.id || m._id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color || '#3b82f6' }} />
                      {m.name}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-400 mt-1">
            Link this task to a phase for accurate milestone-level profit tracking.
          </p>
        </div>

        {/* Story - Moved Above Assignees */}
        <div className="md:col-span-2 space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-green-500" />
            Story *
          </Label>
          <Select
            value={taskData.story_id || undefined}
            onValueChange={(value) => {
              const newStoryId = value;
              const selectedStory = stories.find(s => (s.id || s._id) === newStoryId);

              // Extract project_id and sprint_id from story
              const storyProjectId = selectedStory?.project_id?.id || selectedStory?.project_id?._id || selectedStory?.project_id;
              const storySprintId = selectedStory?.sprint_id?.id || selectedStory?.sprint_id?._id || selectedStory?.sprint_id;

              if (storyProjectId && onProjectChange) {
                onProjectChange(storyProjectId);
              }

              setTaskData(prev => {
                const updates = {
                  ...prev,
                  story_id: newStoryId,
                  project_id: storyProjectId || prev.project_id,
                  sprint_id: storySprintId || ""
                };
                return updates;
              });
            }}
          >
            <SelectTrigger className={cn("h-10", validationErrors.story_id && "border-red-500")}>
              <SelectValue placeholder="Select story..." />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[300px] max-h-80 overflow-x-auto">
              {/* Removed unassigned option as it's now required */}
              {filteredStories.length === 0 ? (
                <SelectItem value="no-stories" disabled>
                  No stories available
                </SelectItem>
              ) : (
                filteredStories.map(story => {
                  const epic = story.epic_id ? epics.find(e => (e.id || e._id) === story.epic_id) : null;
                  const sprint = story.sprint_id ? sprints.find(s => s.id === story.sprint_id) : null;
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
          {validationErrors.story_id && (
            <p className="text-xs text-red-600 mt-1">{validationErrors.story_id}</p>
          )}
          {taskData.story_id && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(() => {
                const selectedStory = stories.find(s => (s.id || s._id) === taskData.story_id);
                if (!selectedStory) return null;
                const epic = selectedStory.epic_id ? epics.find(e => (e.id || e._id) === selectedStory.epic_id) : null;
                const sprint = selectedStory.sprint_id ? sprints.find(s => s.id === selectedStory.sprint_id) : null;

                return (
                  <>
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
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Assignees and Reference URL - Side by Side */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t mt-2">
          {/* Assignees */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Assignees
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-10 px-3 py-1.5"
                >
                  {taskData.assigned_to && taskData.assigned_to.length > 0
                    ? <div className="flex flex-wrap gap-1 overflow-hidden">
                      {taskData.assigned_to.map(assigneeEmail => {
                        const user = users.find(u => u.email === assigneeEmail);
                        const initials = user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : assigneeEmail.slice(0, 2).toUpperCase();
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
                                setTaskData(prev => ({
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
                        const isSelected = Array.isArray(taskData.assigned_to) && taskData.assigned_to.includes(user.email);
                        const hasReworkAlarm = reworkAlarms.some(alarm => alarm.recipient_email === user.email);
                        return (
                          <CommandItem
                            key={user.id}
                            value={user.email}
                            onSelect={() => {
                              if (user.is_overdue_blocked && !isSelected) {
                                const msg = "Cannot assign task: User has multiple overdue tasks.";
                                toast.error(msg);
                                setLocalError(msg);
                                return;
                              }

                              const hasReworkAlarm = reworkAlarms.some(alarm => alarm.recipient_email === user.email);
                              if (hasReworkAlarm && !isSelected) {
                                const msg = "Cannot assign task: User has too many rework tasks.";
                                toast.error(msg);
                                setLocalError(msg);
                                return;
                              }

                              const currentAssignees = Array.isArray(taskData.assigned_to) ? taskData.assigned_to : [];
                              const newAssignees = isSelected
                                ? currentAssignees.filter((email) => email !== user.email)
                                : [...currentAssignees, user.email];

                              setLocalError(""); // Clear error on valid selection
                              setTaskData(prev => ({ ...prev, assigned_to: newAssignees }));
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
            {taskData.assigned_to.some(email => reworkAlarms.some(a => a.recipient_email === email)) && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[10px] font-bold animate-pulse">
                <Siren className="h-3.5 w-3.5" />
                One or more selected users have their assignments frozen.
              </div>
            )}
            {(validationErrors.assigned_to || localError) && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[10px] font-bold animate-pulse">
                <Siren className="h-3.5 w-3.5" />
                {validationErrors.assigned_to || localError}
              </div>
            )}
          </div>

          {/* Reference URL */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-500" />
              Reference URL / Image Link
            </Label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={taskData.reference_url || ""}
                onChange={(e) => setTaskData({ ...taskData, reference_url: e.target.value })}
                placeholder="https://example.com/mockup-design"
                className="flex-1 h-10"
              />
            </div>
          </div>
        </div>

        {/* Story Points */}
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-500" />
            Story Points
          </Label>
          <Select
            value={String(taskData.story_points || 0)}
            onValueChange={(value) => {
              const points = parseInt(value);
              const calculatedHours = getHoursFromPoints(points);
              setTaskData({
                ...taskData,
                story_points: points,
                estimated_hours: calculatedHours
              });
            }}
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

        {/* Due Date */}
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-pink-500" />
            Due Date
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {taskData.due_date ? format(new Date(taskData.due_date), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={taskData.due_date ? new Date(taskData.due_date) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const adjustedDate = new Date(date);
                    adjustedDate.setHours(12, 0, 0, 0);
                    setTaskData({ ...taskData, due_date: adjustedDate.toISOString().split('T')[0] });
                  } else {
                    setTaskData({ ...taskData, due_date: '' });
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>


      {/* Description with Draft with AI Button */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <AlignLeft className="h-4 w-4 text-slate-600" />
            Description
          </Label>

          <Button
            onClick={handleAutoGenerate}
            variant="outline"
            size="sm"
            disabled={isGenerating || !taskData.title}
            className="text-xs"
          >
            {isGenerating ? (
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
        <div className="border rounded-lg overflow-hidden resize-y min-h-[150px] max-h-[500px] flex flex-col relative">
          <div className="flex-1 overflow-y-auto">
            <ReactQuill
              theme="snow"
              value={taskData.description || ""}
              onChange={(value) => setTaskData({ ...taskData, description: value })}
              placeholder="Describe your task here (use 'Draft with AI' to generate a structured description)..."
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
        <p className="text-[10px] text-slate-400 mt-1">
          Tip: Enter a Task Title and click "Auto-Generate Details" to fill Description, Subtasks, and more!
        </p>
      </div>

      {/* Labels/Tags */}
      <div>
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Hash className="h-4 w-4 text-violet-500" />
          Labels/Tags
        </Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
            placeholder="Add a label..."
            className="flex-1"
          />
          <Button onClick={addLabel} size="sm" type="button">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {taskData.labels.map((label, index) => (
            <Badge key={index} variant="outline" className="flex items-center gap-1">
              {label}
              <button onClick={() => removeLabel(label)} className="ml-1 hover:text-red-600" type="button">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
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
          />
          <Button onClick={addSubtask} size="sm" type="button">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {taskData.subtasks.map((subtask, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => toggleSubtask(index)}
                className="h-4 w-4 rounded"
              />
              <span className={`flex-1 ${subtask.completed ? 'line-through text-slate-500' : ''}`}>
                {subtask.title}
              </span>
              <button onClick={() => removeSubtask(index)} className="text-red-600 hover:text-red-700" type="button">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* UPDATED: Attachments with Ref Imitation from EditTaskDialog */}
      <div>
        <Label className="text-sm font-semibold">Attachments</Label>
        <div className="space-y-2 mt-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </>
            )}
          </Button>
        </div>

        {taskData.attachments && taskData.attachments.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {taskData.attachments.map((file, index) => {
              // Determine if it's an image for preview
              const isImage = file.type?.startsWith('image/') || file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

              return (
                <div key={index} className="flex items-center justify-between p-2 border border-slate-200 rounded-lg bg-white shadow-sm group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="h-10 w-10 flex items-center justify-center bg-slate-100 rounded overflow-hidden flex-shrink-0 border">
                      {isImage ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileIcon className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-700 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {file.name.split('.').pop() || 'FILE'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    type="button"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Impediment Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="report-impediment"
            checked={isReportImpediment}
            onCheckedChange={(checked) => setIsReportImpediment(checked === true)}
          />
          <Label htmlFor="report-impediment" className="font-normal cursor-pointer text-sm font-semibold">
            Report Impediment
          </Label>
        </div>

        {isReportImpediment && (
          <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4 text-amber-500" />
                Link to Existing Impediment
              </Label>
              <Select
                value={selectedImpedimentId || "new"}
                onValueChange={(value) => setSelectedImpedimentId(value === "new" ? "" : value)}
              >
                <SelectTrigger className="mt-1">
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

            {selectedImpedimentId === "" && (
              <>
                <div>
                  <Label htmlFor="impediment-title" className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Impediment Title *
                  </Label>
                  <Input
                    id="impediment-title"
                    value={impedimentData.title}
                    onChange={(e) => setImpedimentData({ ...impedimentData, title: e.target.value })}
                    placeholder="Brief description of the impediment"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="impediment-description" className="text-sm font-semibold flex items-center gap-2">
                    <AlignLeft className="h-4 w-4 text-red-600" />
                    Description
                  </Label>
                  <Textarea
                    id="impediment-description"
                    value={impedimentData.description}
                    onChange={(e) => setImpedimentData({ ...impedimentData, description: e.target.value })}
                    placeholder="Detailed explanation and impact"
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="impediment-severity" className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Severity
                  </Label>
                  <Select
                    value={impedimentData.severity}
                    onValueChange={(val) => setImpedimentData({ ...impedimentData, severity: val })}
                  >
                    <SelectTrigger className="mt-1">
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
            )}

            {selectedImpedimentId && selectedImpedimentId !== "new" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  This task will be linked to the selected impediment. The impediment context (Sprint, Epic, Story) will be automatically captured.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div >
  );
}

