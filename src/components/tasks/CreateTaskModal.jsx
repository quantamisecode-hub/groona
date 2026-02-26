import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Save, X, Plus, AlertTriangle, Upload, FileIcon, Wand2, FolderKanban, AlignLeft, Circle, Flag, Calendar as CalendarIcon, Palette, BookOpen, Target, Users, ClipboardList } from "lucide-react";
import { useHasPermission } from "../shared/usePermissions";
import { useUser } from "@/components/shared/UserContext";
import { Siren } from "lucide-react";
import TaskDetailsTab from "./create-task/TaskDetailsTab";
import AISuggestionsPanel from "./create-task/AISuggestionsPanel";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "sonner";

export default function CreateTaskModal({ open, onClose, projectId, onSuccess }) {
  const [currentProjectId, setCurrentProjectId] = useState(projectId || "");

  // Sync currentProjectId when prop changes or simple effect
  useEffect(() => {
    if (open) {
      setCurrentProjectId(projectId || "");
    }
  }, [projectId, open]);
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();
  const [showAISuggestions, setShowAISuggestions] = useState(true);
  const [showImpedimentDialog, setShowImpedimentDialog] = useState(false);
  const [impedimentData, setImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedImpedimentId, setSelectedImpedimentId] = useState("");
  const [createMode, setCreateMode] = useState("task"); // "task" or "impediment"

  const canCreateTask = useHasPermission('can_create_task');
  const canUseAI = useHasPermission('can_use_ai_assistant');

  // Epic form state
  const [epicData, setEpicData] = useState({
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    start_date: "",
    due_date: "",
    color: "#3b82f6",
    owner: "",
    labels: [],
    attachments: [],
  });

  // Epic impediment state
  const [epicImpedimentData, setEpicImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedEpicImpedimentId, setSelectedEpicImpedimentId] = useState("");
  const [isEpicReportImpediment, setIsEpicReportImpediment] = useState(false);

  // Epic file upload state
  const [isEpicUploading, setIsEpicUploading] = useState(false);
  const epicFileInputRef = useRef(null);


  // Story point options with hours mapping
  const storyPointOptions = [
    { value: 0, label: "0 Points (0 hours)" },
    { value: 1, label: "1 Point (2 hours)" },
    { value: 2, label: "2 Points (4 hours)" },
    { value: 3, label: "3 Points (8 hours)" },
    { value: 5, label: "5 Points (16 hours)" },
    { value: 8, label: "8 Points (32 hours)" },
    { value: 13, label: "13 Points (64 hours)" },
  ];

  // Story form state
  const [storyData, setStoryData] = useState({
    title: "",
    description: "",
    acceptance_criteria: "",
    status: "todo",
    priority: "medium",
    story_points: "",
    assigned_to: [],
    due_date: "",
    labels: [],
    epic_id: "",
  });

  // Story impediment state
  const [storyImpedimentData, setStoryImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedStoryImpedimentId, setSelectedStoryImpedimentId] = useState("");
  const [isStoryReportImpediment, setIsStoryReportImpediment] = useState(false);

  // AI generation states
  const [isGeneratingEpicDescription, setIsGeneratingEpicDescription] = useState(false);
  const [isGeneratingStoryDescription, setIsGeneratingStoryDescription] = useState(false);

  // Task form state
  const [taskData, setTaskData] = useState({
    project_id: projectId,
    workspace_id: "",
    title: "",
    reference_url: "",
    description: "",
    task_type: "task", // Can be "epic", "story", "task", "bug", "technical_debt"
    status: "todo",
    priority: "medium",
    assigned_to: [],
    reporter: "",
    sprint_id: "",
    story_id: "",
    story_points: 0,
    due_date: "",
    estimated_hours: 0,
    labels: [],
    attachments: [],
    dependencies: [],
    subtasks: [],
    acceptance_criteria: "",
    custom_fields: {},
    ai_generated: false,
    ai_metadata: {},
    milestone_id: ""
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isDraft, setIsDraft] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setEpicData(prev => ({ ...prev, owner: currentUser.email }));
      setStoryData(prev => ({ ...prev, reporter: currentUser.email }));
      setTaskData(prev => ({ ...prev, reporter: currentUser.email }));
    }
  }, [currentUser]);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const validTenantId = effectiveTenantId && effectiveTenantId.trim() ? effectiveTenantId.trim() : null;



  // Reset forms when modal opens
  useEffect(() => {
    if (open) {
      // Reset task type to task by default
      setTaskData(prev => ({ ...prev, task_type: "task", project_id: currentProjectId }));
      // Reset all forms 
      setEpicData({
        name: "",
        description: "",
        status: "planning",
        priority: "medium",
        start_date: "",
        due_date: "",
        color: "#3b82f6",
        owner: currentUser?.email || "",
        labels: [],
        attachments: [],
      });
      // ... (keep rest same)
      setEpicImpedimentData({ title: "", description: "", severity: "medium" });
      setSelectedEpicImpedimentId("");
      setIsEpicReportImpediment(false);
      setStoryData({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        story_points: "",
        assigned_to: [],
        due_date: "",
        labels: [],
        epic_id: "",
      });
      setTaskData({
        project_id: currentProjectId,
        workspace_id: "",
        title: "",
        reference_url: "",
        description: "",
        task_type: "task",
        status: "todo",
        priority: "medium",
        assigned_to: [],
        reporter: currentUser?.email || "",
        sprint_id: "",
        story_id: "",
        story_points: 0,
        due_date: "",
        estimated_hours: 0,
        labels: [],
        attachments: [],
        dependencies: [],
        subtasks: [],
        acceptance_criteria: "",
        custom_fields: {},
        ai_generated: false,
        ai_metadata: {},
        milestone_id: ""
      });
      setValidationErrors({});
      setIsDraft(false);
      setCreateMode("task");
      setSelectedImpedimentId("");
      setImpedimentData({ title: "", description: "", severity: "medium" });
    }
  }, [open, projectId, currentProjectId, currentUser?.email]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  const { data: project } = useQuery({
    queryKey: ['project', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const projects = await groonabackend.entities.Project.list();
      return projects.find(p => (p.id === currentProjectId) || (p._id === currentProjectId));
    },
    enabled: !!currentProjectId && open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', validTenantId],
    queryFn: async () => {
      if (!validTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(user =>
        user.tenant_id === validTenantId &&
        !user.is_super_admin &&
        user.custom_role !== 'client'
      );
    },
    enabled: !!validTenantId,
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
    enabled: open && !!effectiveTenantId,
    refetchInterval: 30000,
  });
  console.log('DEBUG: CreateTaskModal reworkAlarms:', reworkAlarms); // DEBUG LOG


  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', currentProjectId],
    queryFn: () => groonabackend.entities.Sprint.filter({ project_id: currentProjectId }),
    enabled: !!currentProjectId,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', currentProjectId],
    queryFn: () => currentProjectId
      ? groonabackend.entities.Story.filter({ project_id: currentProjectId })
      : groonabackend.entities.Story.list(),
    enabled: open, // Enable if modal is open, regardless of currentProjectId
  });

  const { data: epics = [] } = useQuery({
    queryKey: ['epics', currentProjectId],
    queryFn: () => groonabackend.entities.Epic.filter({ project_id: currentProjectId }),
    enabled: !!currentProjectId && open,
  });

  // Fetch impediments for epic form
  const { data: epicProjectImpediments = [] } = useQuery({
    queryKey: ['impediments', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      return await groonabackend.entities.Impediment.filter({ project_id: currentProjectId });
    },
    enabled: !!currentProjectId && open,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentProjectId],
    queryFn: () => groonabackend.entities.Task.filter({ project_id: currentProjectId }),
    enabled: !!currentProjectId,
  });

  // Auto-set workspace from selected project
  useEffect(() => {
    if (taskData.project_id && projects.length > 0) {
      const proj = projects.find(p => p.id === taskData.project_id);
      if (proj?.workspace_id) {
        setTaskData(prev => ({ ...prev, workspace_id: proj.workspace_id }));
      }
    }
  }, [taskData.project_id, projects]);

  // Epic file upload handler
  const handleEpicFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsEpicUploading(true);

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
      setEpicData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploadedFiles]
      }));
      toast.success(`${uploadedFiles.length} file(s) attached`);
    } catch (error) {
      toast.error('Failed to attach files');
      console.error(error);
    } finally {
      setIsEpicUploading(false);
      if (epicFileInputRef.current) {
        epicFileInputRef.current.value = '';
      }
    }
  };

  const removeEpicAttachment = (index) => {
    setEpicData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  // Epic creation mutation
  const createEpicMutation = useMutation({
    mutationFn: async (data) => {
      if (!validTenantId) {
        throw new Error('Cannot create epic: Tenant ID is missing or invalid');
      }
      const epicData = {
        tenant_id: validTenantId,
        workspace_id: project?.workspace_id || "",
        project_id: currentProjectId,
        name: data.name.trim(),
        description: data.description.trim() || "",
        status: data.status,
        priority: data.priority,
        start_date: data.start_date || undefined,
        due_date: data.due_date || undefined,
        color: data.color,
        owner: data.owner || currentUser?.email,
        labels: data.labels,
        attachments: data.attachments || [],
        progress: 0,
      };
      return await groonabackend.entities.Epic.create(epicData);
    },
    onSuccess: async (newEpic) => {
      queryClient.invalidateQueries({ queryKey: ['epics', currentProjectId] });

      // Handle impediment if checkbox is checked
      if (isEpicReportImpediment) {
        if (selectedEpicImpedimentId && selectedEpicImpedimentId !== "new" && selectedEpicImpedimentId !== "") {
          // Link epic to existing impediment
          try {
            await groonabackend.entities.Impediment.update(selectedEpicImpedimentId, {
              epic_id: newEpic.id || newEpic._id,
            });
            toast.success('Epic created and linked to impediment successfully!');
          } catch (error) {
            console.error('Error linking epic to impediment:', error);
            toast.error('Epic created but failed to link to impediment');
          }
        } else if (epicImpedimentData.title && epicImpedimentData.title.trim()) {
          // Create new impediment with epic
          try {
            const impedimentPayload = {
              tenant_id: validTenantId,
              workspace_id: project?.workspace_id || "",
              project_id: currentProjectId,
              epic_id: newEpic.id || newEpic._id,
              title: epicImpedimentData.title.trim(),
              description: epicImpedimentData.description || "",
              severity: epicImpedimentData.severity,
              status: "open",
              reported_by: currentUser?.email,
              reported_by_name: currentUser?.full_name || currentUser?.email,
            };
            await groonabackend.entities.Impediment.create(impedimentPayload);
            toast.success('Epic and impediment created successfully!');
            queryClient.invalidateQueries({ queryKey: ['impediments', currentProjectId] });
          } catch (error) {
            console.error('Error creating impediment:', error);
            toast.error('Epic created but failed to create impediment');
          }
        }
      }

      toast.success('Epic created successfully!');
      if (onSuccess) onSuccess(newEpic);
      handleClose();
    },
    onError: (error) => {
      console.error('[CreateEpic] Epic creation error:', error);
      toast.error(`Failed to create epic: ${error.message || 'Please try again.'}`);
    },
  });

  // Story creation mutation
  const createStoryMutation = useMutation({
    mutationFn: async (data) => {
      if (!validTenantId) {
        throw new Error('Cannot create story: Tenant ID is missing or invalid');
      }
      const storyData = {
        tenant_id: validTenantId,
        workspace_id: project?.workspace_id || "",
        project_id: currentProjectId,
        title: data.title.trim(),
        description: data.description.trim() || "",
        acceptance_criteria: data.acceptance_criteria?.trim() || "",
        status: data.status,
        priority: data.priority,
        story_points: data.story_points ? Number(data.story_points) : undefined,
        assigned_to: data.assigned_to || [],
        reporter: currentUser?.email,
        due_date: data.due_date || undefined,
        labels: data.labels,
        epic_id: data.epic_id || undefined,
      };
      return await groonabackend.entities.Story.create(storyData);
    },
    onSuccess: async (newStory) => {
      queryClient.invalidateQueries({ queryKey: ['stories', currentProjectId] });

      // Handle impediment if checkbox is checked
      if (isStoryReportImpediment) {
        if (selectedStoryImpedimentId && selectedStoryImpedimentId !== "new" && selectedStoryImpedimentId !== "") {
          // Link story to existing impediment
          try {
            await groonabackend.entities.Impediment.update(selectedStoryImpedimentId, {
              story_id: newStory.id || newStory._id,
              epic_id: storyData.epic_id || undefined,
            });
            toast.success('Story created and linked to impediment successfully!');
          } catch (error) {
            console.error('Error linking story to impediment:', error);
            toast.error('Story created but failed to link to impediment');
          }
        } else if (storyImpedimentData.title && storyImpedimentData.title.trim()) {
          // Create new impediment with story
          try {
            const impedimentPayload = {
              tenant_id: validTenantId,
              workspace_id: project?.workspace_id || "",
              project_id: currentProjectId,
              story_id: newStory.id || newStory._id,
              epic_id: storyData.epic_id || undefined,
              title: storyImpedimentData.title.trim(),
              description: storyImpedimentData.description || "",
              severity: storyImpedimentData.severity,
              status: "open",
              reported_by: currentUser?.email,
              reported_by_name: currentUser?.full_name || currentUser?.email,
            };
            await groonabackend.entities.Impediment.create(impedimentPayload);
            toast.success('Story and impediment created successfully!');
            queryClient.invalidateQueries({ queryKey: ['impediments', currentProjectId] });
          } catch (error) {
            console.error('Error creating impediment:', error);
            toast.error('Story created but failed to create impediment');
          }
        } else {
          toast.success('Story created successfully!');
        }
      } else {
        toast.success('Story created successfully!');
      }

      if (onSuccess) onSuccess(newStory);
      handleClose();
    },
    onError: (error) => {
      console.error('[CreateStory] Story creation error:', error);
      toast.error(`Failed to create story: ${error.message || 'Please try again.'}`);
    },
  });

  // Task creation mutation (existing)
  const createTaskMutation = useMutation({
    mutationFn: async (data) => {
      if (!validTenantId) {
        throw new Error('Cannot create task: Tenant ID is missing or invalid');
      }

      let targetWorkspaceId = data.workspace_id;
      if (!targetWorkspaceId || targetWorkspaceId.trim() === "") {
        const foundProject = projects.find(p => p.id === data.project_id);
        if (foundProject?.workspace_id) {
          targetWorkspaceId = foundProject.workspace_id;
        }
      }

      /* Removed: Mandatory workspace check
      if (!targetWorkspaceId || targetWorkspaceId.trim() === "") {
        throw new Error("Missing Workspace ID. Please try refreshing the page or selecting the project again.");
      }
      */

      const safeString = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === 'string') return value.trim();
        return String(value).trim();
      };

      let finalEstHours = Number(data.estimated_hours);
      const points = Number(data.story_points);

      if ((!finalEstHours || finalEstHours === 0) && points > 0) {
        const hoursMap = { 1: 2, 2: 4, 3: 8, 5: 16, 8: 32, 13: 64 };
        finalEstHours = hoursMap[points] || 0;
      }

      const cleanData = {
        tenant_id: validTenantId,
        project_id: data.project_id,
        workspace_id: targetWorkspaceId,
        title: safeString(data.title),
        reference_url: safeString(data.reference_url),
        description: safeString(data.description),
        task_type: data.task_type || 'task',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        assigned_to: Array.isArray(data.assigned_to)
          ? data.assigned_to.filter(u => u && typeof u === 'string' && u.trim() !== '')
          : [],
        reporter: currentUser.email,
        sprint_id: (data.sprint_id && data.sprint_id !== "unassigned" && data.sprint_id.trim() !== "") ? data.sprint_id : null,
        story_id: (data.story_id && data.story_id !== "unassigned" && data.story_id.trim() !== "") ? data.story_id : null,
        story_points: points >= 0 ? points : 0,
        estimated_hours: finalEstHours >= 0 ? finalEstHours : 0,
        due_date: data.due_date || null,
        labels: Array.isArray(data.labels) ? data.labels : [],
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
        subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
        custom_fields: (data.custom_fields && typeof data.custom_fields === 'object') ? data.custom_fields : {},
        ai_generated: Boolean(data.ai_generated),
        ai_metadata: (data.ai_metadata && typeof data.ai_metadata === 'object') ? data.ai_metadata : {},
        milestone_id: (data.milestone_id && data.milestone_id !== "unassigned" && data.milestone_id.trim() !== "") ? data.milestone_id : null,
      };

      const newTask = await groonabackend.entities.Task.create(cleanData);

      if (validTenantId) {
        try {
          await groonabackend.entities.Activity.create({
            tenant_id: validTenantId,
            action: 'created',
            entity_type: 'task',
            entity_id: newTask.id,
            entity_name: newTask.title,
            project_id: currentProjectId,
            user_email: currentUser.email,
            user_name: currentUser.full_name,
          });
        } catch (e) { console.error('Activity log error', e); }
      }

      if (Array.isArray(newTask.assigned_to) && newTask.assigned_to.length > 0 && validTenantId) {
        await Promise.all(newTask.assigned_to.map(async (assigneeEmail) => {
          if (assigneeEmail !== currentUser.email) {
            try {
              await groonabackend.entities.Notification.create({
                tenant_id: validTenantId,
                recipient_email: assigneeEmail,
                type: 'task_assigned',
                title: 'New Task Assigned',
                message: `${currentUser.full_name} assigned you to task: ${newTask.title}`,
                entity_type: 'task',
                entity_id: newTask.id || newTask._id,
                project_id: newTask.project_id || currentProjectId,
                sender_name: currentUser.full_name,
              });
            } catch (notifError) {
              console.error(`Notification failed for ${assigneeEmail}:`, notifError);
            }
          }
        }));
      }

      return newTask;
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentProjectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activities', currentProjectId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });

      localStorage.removeItem(`task-draft-${currentProjectId}`);
      setIsDraft(false);
      toast.success('Task created successfully!');

      if (onSuccess) onSuccess(newTask);
    },
    onError: (error) => {
      console.error('[CreateTask] Task creation error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Please try again.';

      // Handle assignment freeze specific error
      if (
        errorMessage.toLowerCase().includes("rework") ||
        errorMessage.toLowerCase().includes("frozen") ||
        errorMessage.toLowerCase().includes("cannot assign task")
      ) {
        setValidationErrors(prev => ({
          ...prev,
          assigned_to: errorMessage
        }));
      }

      toast.error(`Failed to create task: ${errorMessage}`);
    },
  });

  const validateForm = () => {
    const errors = {};
    const taskType = taskData.task_type;

    if (taskType === "epic") {
      if (!epicData.name || !epicData.name.trim()) {
        errors.name = 'Epic name is required';
      }
    } else if (taskType === "story") {
      if (!storyData.title || !storyData.title.trim()) {
        errors.title = 'Story title is required';
      }
    } else {
      // For task, bug, technical_debt
      if (!taskData.title || (typeof taskData.title === 'string' && !taskData.title.trim())) {
        errors.title = 'Title is required';
      }
      if (!taskData.story_id || taskData.story_id === "" || taskData.story_id === "unassigned") {
        errors.story_id = 'Story is required';
      }
      /* Removed: Project is no longer required
      if (!taskData.project_id) {
        errors.project_id = 'Project is required';
      }
      */
      let currentWorkspaceId = taskData.workspace_id;
      if (!currentWorkspaceId && taskData.project_id && projects.length > 0) {
        const proj = projects.find(p => p.id === taskData.project_id);
        if (proj?.workspace_id) currentWorkspaceId = proj.workspace_id;
      }
      /* Removed: Workspace ID validation tied to project
      if (!currentWorkspaceId) {
        errors.workspace_id = 'Critical Error: Project Workspace not found. Please refresh.';
      }
      */
    }

    if (!validTenantId) {
      errors.tenant = 'Tenant context is missing';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const taskType = taskData.task_type;
    if (taskType === "epic") {
      await createEpicMutation.mutateAsync(epicData);
    } else if (taskType === "story") {
      await createStoryMutation.mutateAsync(storyData);
    } else {
      // Check if impediment mode is selected
      if (createMode === "impediment") {
        // If impediment checkbox is checked, create impediment with task
        if (selectedImpedimentId && selectedImpedimentId !== "new" && selectedImpedimentId !== "") {
          // Link task to existing impediment
          await handleLinkTaskToImpediment();
        } else if (impedimentData.title && impedimentData.title.trim()) {
          // Create new impediment with task
          await handleCreateImpedimentWithTask();
        } else {
          // If checkbox is checked but no impediment data, just create task normally
          await createTaskMutation.mutateAsync(taskData);
          handleClose();
        }
      } else {
        // Normal task creation
        await createTaskMutation.mutateAsync(taskData);
        handleClose();
      }
    }
  };

  const handleLinkTaskToImpediment = async () => {
    try {
      // Create task first
      const newTask = await createTaskMutation.mutateAsync(taskData);

      // Capture context
      let sprintId = taskData.sprint_id || null;
      let epicId = null;
      let storyId = taskData.story_id || null;

      if (storyId) {
        const selectedStory = stories.find(s => (s.id || s._id) === storyId);
        if (selectedStory?.epic_id) {
          epicId = selectedStory.epic_id;
        }
      }

      // Update impediment to link to task
      await groonabackend.entities.Impediment.update(selectedImpedimentId, {
        task_id: newTask.id || newTask._id,
        sprint_id: sprintId || undefined,
        story_id: storyId || undefined,
        epic_id: epicId || undefined,
      });

      toast.success('Task created and linked to impediment successfully!');
      queryClient.invalidateQueries({ queryKey: ['impediments', projectId] });
      if (sprintId) {
        queryClient.invalidateQueries({ queryKey: ['impediments', sprintId] });
      }
      handleClose();
    } catch (error) {
      console.error('Error linking task to impediment:', error);
      toast.error(`Failed to link task to impediment: ${error.message || 'Please try again.'}`);
    }
  };

  const handleCreateImpedimentWithTask = async () => {
    try {
      // Create task first
      const newTask = await createTaskMutation.mutateAsync(taskData);

      // Capture context
      let sprintId = taskData.sprint_id || null;
      let epicId = null;
      let storyId = taskData.story_id || null;

      if (storyId) {
        const selectedStory = stories.find(s => (s.id || s._id) === storyId);
        if (selectedStory?.epic_id) {
          epicId = selectedStory.epic_id;
        }
      }

      // Create impediment linked to task
      const impedimentPayload = {
        tenant_id: validTenantId,
        workspace_id: project?.workspace_id || "",
        project_id: projectId,
        sprint_id: sprintId || undefined,
        epic_id: epicId || undefined,
        story_id: storyId || undefined,
        task_id: newTask.id || newTask._id,
        title: impedimentData.title.trim(),
        description: impedimentData.description || "",
        severity: impedimentData.severity,
        status: "open",
        reported_by: currentUser?.email,
        reported_by_name: currentUser?.full_name || currentUser?.email,
      };

      await groonabackend.entities.Impediment.create(impedimentPayload);
      toast.success('Task and impediment created successfully!');
      queryClient.invalidateQueries({ queryKey: ['impediments', currentProjectId] });
      if (sprintId) {
        queryClient.invalidateQueries({ queryKey: ['impediments', sprintId] });
      }
      handleClose();
    } catch (error) {
      console.error('Error creating impediment with task:', error);
      toast.error(`Failed to create impediment: ${error.message || 'Please try again.'}`);
    }
  };

  const handleReportImpediment = async () => {
    if (!impedimentData.title.trim()) {
      toast.error('Impediment title is required');
      return;
    }

    if (!validTenantId) {
      toast.error('Tenant context is missing');
      return;
    }

    try {
      // Capture context based on entity type
      let sprintId = null;
      let epicId = null;
      let storyId = null;
      let taskId = null;

      const taskType = taskData.task_type;
      if (taskType === "task" || taskType === "bug" || taskType === "technical_debt") {
        sprintId = taskData.sprint_id || null;
        storyId = taskData.story_id || null;
        // If story is selected, get its epic_id
        if (storyId) {
          const selectedStory = stories.find(s => (s.id || s._id) === storyId);
          if (selectedStory?.epic_id) {
            epicId = selectedStory.epic_id;
          }
        }
      } else if (taskType === "story") {
        // For story creation, capture epic if selected
        epicId = storyData.epic_id || null;
        // Note: story_id will be null since story hasn't been created yet
      } else if (taskType === "epic") {
        // For epic creation, no parent context
        // Note: epic_id will be null since epic hasn't been created yet
      }

      // Create impediment in database
      const impedimentPayload = {
        tenant_id: validTenantId,
        workspace_id: project?.workspace_id || "",
        project_id: projectId,
        sprint_id: sprintId || undefined,
        epic_id: epicId || undefined,
        story_id: storyId || undefined,
        task_id: taskId || undefined,
        title: impedimentData.title.trim(),
        description: impedimentData.description || "",
        severity: impedimentData.severity,
        status: "open",
        reported_by: currentUser?.email,
        reported_by_name: currentUser?.full_name || currentUser?.email,
      };

      const newImpediment = await groonabackend.entities.Impediment.create(impedimentPayload);
      toast.success('Impediment reported successfully!');

      setImpedimentData({
        title: "",
        description: "",
        severity: "medium",
      });
      setShowImpedimentDialog(false);

      // Invalidate impediment queries
      queryClient.invalidateQueries({ queryKey: ['impediments', projectId] });
      if (sprintId) {
        queryClient.invalidateQueries({ queryKey: ['impediments', sprintId] });
      }
    } catch (error) {
      console.error('Error reporting impediment:', error);
      toast.error(`Failed to report impediment: ${error.message || 'Please try again.'}`);
    }
  };

  const handleClose = () => {
    setEpicData({
      name: "",
      description: "",
      status: "planning",
      priority: "medium",
      start_date: "",
      due_date: "",
      color: "#3b82f6",
      owner: currentUser?.email || "",
      labels: [],
      attachments: [],
    });
    setEpicImpedimentData({ title: "", description: "", severity: "medium" });
    setSelectedEpicImpedimentId("");
    setIsEpicReportImpediment(false);
    setStoryData({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      story_points: "",
      assigned_to: [],
      due_date: "",
      acceptance_criteria: "",
      labels: [],
      epic_id: "",
    });
    setTaskData({
      project_id: projectId,
      workspace_id: "",
      title: "",
      reference_url: "",
      description: "",
      task_type: "task",
      status: "todo",
      priority: "medium",
      assigned_to: [],
      reporter: currentUser?.email || "",
      sprint_id: "",
      story_id: "",
      story_points: 0,
      due_date: "",
      estimated_hours: 0,
      labels: [],
      attachments: [],
      dependencies: [],
      subtasks: [],
      custom_fields: {},
      ai_generated: false,
      ai_metadata: {}
    });
    setValidationErrors({});
    setIsDraft(false);
    setShowImpedimentDialog(false);
    setImpedimentData({ title: "", description: "", severity: "medium" });
    setSelectedImpedimentId("");
    setCreateMode("task");
    // Reset story impediment state
    setStoryImpedimentData({ title: "", description: "", severity: "medium" });
    setSelectedStoryImpedimentId("");
    setIsStoryReportImpediment(false);
    onClose();
  };

  if (!canCreateTask) {
    return null;
  }

  const isSaving = createEpicMutation.isPending || createStoryMutation.isPending || createTaskMutation.isPending;

  const getTitle = () => {
    const taskType = taskData.task_type;
    if (taskType === "epic") return "Epic";
    if (taskType === "story") return "Story";
    return "Task";
  };

  const hasRequiredFields = () => {
    const taskType = taskData.task_type;
    if (taskType === "epic") return epicData.name && epicData.name.trim();
    if (taskType === "story") return storyData.title && storyData.title.trim();
    return taskData.title && (typeof taskData.title === 'string' ? taskData.title.trim() : true);
  };

  // AI Generation for Epic Description
  const handleGenerateEpicDescription = async () => {
    if (!epicData.name?.trim()) {
      toast.error("Please enter an Epic Name first.");
      return;
    }

    setIsGeneratingEpicDescription(true);
    try {
      const prompt = `You are a senior project manager. Based on the epic name "${epicData.name}" and any initial description provided ("${epicData.description || ''}"), generate a brief, concise epic description.

      The description should be a short summary (1-2 paragraphs) explaining the goal and purpose of this epic.
      Do NOT use structured headers like "Scope", "Requirements", "In-Scope", or "Deliverables".
      Keep it simple and direct.
      
      Output only the description text (no JSON, no markdown formatting, just plain descriptive text).`;

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
      setEpicData(prev => ({ ...prev, description: generatedDescription }));
      toast.success("Epic description generated successfully!");
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate epic description. Please check your connection.");
    } finally {
      setIsGeneratingEpicDescription(false);
    }
  };

  // AI Generation for Story Description
  const handleGenerateStoryDescription = async () => {
    if (!storyData.title?.trim()) {
      toast.error("Please enter a Story Title first.");
      return;
    }

    setIsGeneratingStoryDescription(true);
    try {
      const prompt = `You are a senior product manager. Based on the story title "${storyData.title}" and any initial description provided ("${storyData.description || ''}"), generate a brief, concise user story description.

      The description should be a short paragraph explaining the feature from a user's perspective (the "what" and "why").
      Do NOT use structured headers or long lists.
      Keep it simple and direct.
      
      Output only the description text (no JSON, no markdown formatting, just plain descriptive text).`;

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
      setStoryData(prev => ({ ...prev, description: generatedDescription }));
      toast.success("Story description generated successfully!");
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate story description. Please check your connection.");
    } finally {
      setIsGeneratingStoryDescription(false);
    }
  };

  // Render Epic Form
  const renderEpicForm = () => (
    <div className="space-y-6">
      {/* Task Type - Sticky in all forms */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Task Type</Label>
        <Select
          value={taskData.task_type}
          onValueChange={(value) => setTaskData(prev => ({ ...prev, task_type: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="epic">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-700 text-xs">Epic</Badge>
              </div>
            </SelectItem>
            <SelectItem value="story">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700 text-xs">Story</Badge>
              </div>
            </SelectItem>
            <SelectItem value="bug">
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-700 text-xs">Bug</Badge>
              </div>
            </SelectItem>
            <SelectItem value="task">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 text-xs">Task</Badge>
              </div>
            </SelectItem>
            <SelectItem value="technical_debt">
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700 text-xs">Technical Debt</Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>



      {/* Project Selection for Epic (Hidden) */}
      {false && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Project</Label>
          <Select
            value={currentProjectId}
            onValueChange={(value) => {
              setCurrentProjectId(value);
              setTaskData(prev => ({ ...prev, project_id: value }));
            }}
            disabled={!!projectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id || p._id} value={p.id || p._id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="epic-name" className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-purple-500" />
          Epic Name *
        </Label>
        <Input
          id="epic-name"
          value={epicData.name}
          onChange={(e) => setEpicData({ ...epicData, name: e.target.value })}
          placeholder="Enter epic name"
          required
        />
        {validationErrors.name && (
          <p className="text-xs text-red-600">{validationErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="epic-description" className="flex items-center gap-2">
            <AlignLeft className="h-4 w-4 text-slate-600" />
            Description
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateEpicDescription}
            disabled={isGeneratingEpicDescription}
            className="text-xs"
          >
            {isGeneratingEpicDescription ? (
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
              value={epicData.description || ""}
              onChange={(value) => setEpicData({ ...epicData, description: value })}
              placeholder="Epic description"
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-blue-500" />
            Status
          </Label>
          <Select
            value={epicData.status}
            onValueChange={(value) => setEpicData({ ...epicData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-500" />
            Priority
          </Label>
          <Select
            value={epicData.priority}
            onValueChange={(value) => setEpicData({ ...epicData, priority: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="epic-start-date" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-pink-500" />
            Start Date
          </Label>
          <Input
            id="epic-start-date"
            type="date"
            value={epicData.start_date}
            onChange={(e) => setEpicData({ ...epicData, start_date: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="epic-due-date" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-pink-500" />
            Due Date
          </Label>
          <Input
            id="epic-due-date"
            type="date"
            value={epicData.due_date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setEpicData({ ...epicData, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="epic-color" className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-pink-500" />
          Color
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="epic-color"
            type="color"
            value={epicData.color}
            onChange={(e) => setEpicData({ ...epicData, color: e.target.value })}
            className="w-16 h-10"
          />
          <Input
            type="text"
            value={epicData.color}
            onChange={(e) => setEpicData({ ...epicData, color: e.target.value })}
            placeholder="#3b82f6"
            className="flex-1"
          />
        </div>
      </div>

      {/* Attachments Section */}
      <div>
        <Label className="text-sm font-semibold">Attachments</Label>
        <div className="space-y-2 mt-1">
          <input
            ref={epicFileInputRef}
            type="file"
            multiple
            onChange={handleEpicFileUpload}
            className="hidden"
            disabled={isEpicUploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => epicFileInputRef.current?.click()}
            disabled={isEpicUploading}
            className="w-full"
          >
            {isEpicUploading ? (
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

        {epicData.attachments && epicData.attachments.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {epicData.attachments.map((file, index) => {
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
                    onClick={() => removeEpicAttachment(index)}
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
            id="epic-report-impediment"
            checked={isEpicReportImpediment}
            onCheckedChange={(checked) => setIsEpicReportImpediment(checked === true)}
          />
          <Label htmlFor="epic-report-impediment" className="font-normal cursor-pointer text-sm font-semibold">
            Report Impediment
          </Label>
        </div>

        {isEpicReportImpediment && (
          <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div>
              <Label className="text-sm font-semibold">Link to Existing Impediment</Label>
              <Select
                value={selectedEpicImpedimentId || "new"}
                onValueChange={(value) => setSelectedEpicImpedimentId(value === "new" ? "" : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select existing impediment or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Impediment</SelectItem>
                  {epicProjectImpediments
                    .filter(imp => imp.status !== 'resolved')
                    .map(impediment => (
                      <SelectItem key={impediment.id || impediment._id} value={impediment.id || impediment._id}>
                        {impediment.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEpicImpedimentId === "" && (
              <>
                <div>
                  <Label htmlFor="epic-impediment-title" className="text-sm font-semibold">Impediment Title *</Label>
                  <Input
                    id="epic-impediment-title"
                    value={epicImpedimentData.title}
                    onChange={(e) => setEpicImpedimentData({ ...epicImpedimentData, title: e.target.value })}
                    placeholder="Brief description of the impediment"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="epic-impediment-description" className="text-sm font-semibold">Description</Label>
                  <Textarea
                    id="epic-impediment-description"
                    value={epicImpedimentData.description}
                    onChange={(e) => setEpicImpedimentData({ ...epicImpedimentData, description: e.target.value })}
                    placeholder="Detailed explanation and impact"
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="epic-impediment-severity" className="text-sm font-semibold">Severity</Label>
                  <Select
                    value={epicImpedimentData.severity}
                    onValueChange={(val) => setEpicImpedimentData({ ...epicImpedimentData, severity: val })}
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

            {selectedEpicImpedimentId && selectedEpicImpedimentId !== "new" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  This epic will be linked to the selected impediment.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div >
  );

  // Render Story Form
  const renderStoryForm = () => (
    <div className="space-y-6">
      {/* Task Type - Sticky in all forms */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Task Type</Label>
        <Select
          value={taskData.task_type}
          onValueChange={(value) => setTaskData(prev => ({ ...prev, task_type: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="epic">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-700 text-xs">Epic</Badge>
              </div>
            </SelectItem>
            <SelectItem value="story">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700 text-xs">Story</Badge>
              </div>
            </SelectItem>
            <SelectItem value="bug">
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-700 text-xs">Bug</Badge>
              </div>
            </SelectItem>
            <SelectItem value="task">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 text-xs">Task</Badge>
              </div>
            </SelectItem>
            <SelectItem value="technical_debt">
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700 text-xs">Technical Debt</Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>



      {/* Project Selection for Story (Hidden) */}
      {false && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Project</Label>
          <Select
            value={currentProjectId}
            onValueChange={(value) => {
              setCurrentProjectId(value);
              setTaskData(prev => ({ ...prev, project_id: value }));
            }}
            disabled={!!projectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id || p._id} value={p.id || p._id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="story-title" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-green-500" />
          Story Title *
        </Label>
        <Input
          id="story-title"
          value={storyData.title}
          onChange={(e) => setStoryData({ ...storyData, title: e.target.value })}
          placeholder="Enter story title"
          required
        />
        {validationErrors.title && (
          <p className="text-xs text-red-600">{validationErrors.title}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="story-description" className="flex items-center gap-2">
            <AlignLeft className="h-4 w-4 text-slate-600" />
            Description
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateStoryDescription}
            disabled={isGeneratingStoryDescription}
            className="text-xs"
          >
            {isGeneratingStoryDescription ? (
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
              value={storyData.description || ""}
              onChange={(value) => setStoryData({ ...storyData, description: value })}
              placeholder="Story description"
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



      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-purple-500" />
          Epic (Optional)
        </Label>
        <Select
          value={storyData.epic_id || "none"}
          onValueChange={(value) => setStoryData({ ...storyData, epic_id: value === "none" ? "" : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select epic (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Epic</SelectItem>
            {epics.map((epic) => (
              <SelectItem key={epic.id || epic._id} value={epic.id || epic._id}>
                {epic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-blue-500" />
            Status
          </Label>
          <Select
            value={storyData.status}
            onValueChange={(value) => setStoryData({ ...storyData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-500" />
            Priority
          </Label>
          <Select
            value={storyData.priority}
            onValueChange={(value) => setStoryData({ ...storyData, priority: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="story-points" className="flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-500" />
            Story Points
          </Label>
          <Select
            value={String(storyData.story_points || 0)}
            onValueChange={(value) => {
              const points = parseInt(value);
              setStoryData({ ...storyData, story_points: String(points) });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select story points" />
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

        <div className="space-y-2">
          <Label htmlFor="story-due-date" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-pink-500" />
            Due Date
          </Label>
          <Input
            id="story-due-date"
            type="date"
            value={storyData.due_date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setStoryData({ ...storyData, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          Assign To
        </Label>
        <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
          {users.length === 0 ? (
            <p className="text-sm text-gray-500">No users available</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={storyData.assigned_to.includes(user.email)}
                    onCheckedChange={() => {
                      // Check for rework block
                      const hasReworkAlarm = reworkAlarms.some(alarm => alarm.recipient_email === user.email);
                      if (hasReworkAlarm && !storyData.assigned_to.includes(user.email)) {
                        toast.error(`Cannot assign: ${user.email} has an active High Rework alarm.`);
                        return;
                      }

                      setStoryData(prev => ({
                        ...prev,
                        assigned_to: prev.assigned_to.includes(user.email)
                          ? prev.assigned_to.filter(e => e !== user.email)
                          : [...prev.assigned_to, user.email]
                      }));
                    }}
                    disabled={reworkAlarms.some(alarm => alarm.recipient_email === user.email)}
                  />
                  <div className="flex items-center justify-between flex-1">
                    <span className={`text-sm ${reworkAlarms.some(alarm => alarm.recipient_email === user.email) ? 'text-slate-500 font-medium' : ''}`}>
                      {user.full_name || "Unknown User"}
                    </span>
                    {reworkAlarms.some(alarm => alarm.recipient_email === user.email) && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                        <Siren className="h-3 w-3" />
                        ASSIGNMENT FROZEN
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        {storyData.assigned_to.some(email => reworkAlarms.some(a => a.recipient_email === email)) && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-bold animate-pulse">
            <Siren className="h-4 w-4" />
            One or more selected users have their assignments frozen due to high rework.
          </div>
        )}
      </div>

      {/* Acceptance Criteria */}
      <div className="space-y-2 mt-4">
        <Label htmlFor="story-acceptance-criteria" className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-emerald-600" />
          Acceptance Criteria
        </Label>
        <div className="border rounded-lg overflow-hidden resize-y min-h-[150px] max-h-[500px] flex flex-col relative bg-white">
          <div className="flex-1 overflow-y-auto">
            <ReactQuill
              theme="snow"
              value={storyData.acceptance_criteria || ""}
              onChange={(value) => {
                setStoryData({ ...storyData, acceptance_criteria: value });
              }}
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
              placeholder="Define success criteria..."
            />
          </div>
        </div>
      </div>

      {/* Report Impediment Section for Story */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="report-story-impediment-unified"
            checked={isStoryReportImpediment}
            onCheckedChange={(checked) => setIsStoryReportImpediment(checked === true)}
          />
          <Label htmlFor="report-story-impediment-unified" className="font-normal cursor-pointer text-sm font-semibold">
            Report Impediment
          </Label>
        </div>

        {isStoryReportImpediment && (
          <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div>
              <Label className="text-sm font-semibold">Link to Existing Impediment</Label>
              <Select
                value={selectedStoryImpedimentId || "new"}
                onValueChange={(value) => setSelectedStoryImpedimentId(value === "new" ? "" : value)}
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

            {selectedStoryImpedimentId === "" && (
              <>
                <div>
                  <Label htmlFor="story-impediment-title-unified" className="text-sm font-semibold">Impediment Title *</Label>
                  <Input
                    id="story-impediment-title-unified"
                    value={storyImpedimentData.title}
                    onChange={(e) => setStoryImpedimentData({ ...storyImpedimentData, title: e.target.value })}
                    placeholder="Brief description of the impediment"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="story-impediment-description-unified" className="text-sm font-semibold">Description</Label>
                  <Textarea
                    id="story-impediment-description-unified"
                    value={storyImpedimentData.description}
                    onChange={(e) => setStoryImpedimentData({ ...storyImpedimentData, description: e.target.value })}
                    placeholder="Detailed explanation and impact"
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="story-impediment-severity-unified" className="text-sm font-semibold">Severity</Label>
                  <Select
                    value={storyImpedimentData.severity}
                    onValueChange={(val) => setStoryImpedimentData({ ...storyImpedimentData, severity: val })}
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

            {selectedStoryImpedimentId && selectedStoryImpedimentId !== "new" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  This story will be linked to the selected impediment.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div >
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isSaving && handleClose()}>
      <DialogContent className="max-w-7xl h-[90vh] max-h-[900px] p-0 gap-0 flex flex-col [&>button.absolute]:hidden">
        <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div>
                <DialogTitle className="text-xl md:text-2xl font-bold text-slate-900">
                  Create New {getTitle()}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-600 mt-0.5">
                  Fill in the details to create a new {getTitle().toLowerCase()}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isDraft && (
                <span className="hidden sm:inline text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  Draft saved
                </span>
              )}

              {canUseAI && (taskData.task_type === "task" || taskData.task_type === "bug" || taskData.task_type === "technical_debt") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAISuggestions(!showAISuggestions)}
                  className="border-purple-200 text-purple-700 hidden md:flex"
                  disabled={isSaving}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  <span className="hidden lg:inline">AI {showAISuggestions ? 'Hide' : 'Show'}</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 pb-24 md:pb-28">
              {taskData.task_type === "epic" && renderEpicForm()}
              {taskData.task_type === "story" && renderStoryForm()}
              {(taskData.task_type === "task" || taskData.task_type === "bug" || taskData.task_type === "technical_debt") && (
                <TaskDetailsTab
                  taskData={taskData}
                  setTaskData={setTaskData}
                  validationErrors={validationErrors}
                  projects={projects}
                  users={users}
                  sprints={sprints}
                  stories={stories}
                  tasks={tasks}
                  currentUser={currentUser}
                  onImpedimentDataChange={(impedimentData, selectedImpedimentId, createMode) => {
                    // Store impediment data in parent component
                    setImpedimentData(impedimentData);
                    setSelectedImpedimentId(selectedImpedimentId);
                    setCreateMode(createMode);
                  }}
                  onProjectChange={(newProjectId) => {
                    setCurrentProjectId(newProjectId);
                    setTaskData(prev => ({ ...prev, project_id: newProjectId }));
                  }}
                  isProjectFixed={!!projectId}
                  reworkAlarms={reworkAlarms}
                />
              )}
            </div>
          </div>

          {showAISuggestions && canUseAI && (taskData.task_type === "task" || taskData.task_type === "bug" || taskData.task_type === "technical_debt") && (
            <div className="hidden lg:block w-80 border-l border-slate-200 overflow-y-auto">
              <AISuggestionsPanel
                taskData={taskData}
                setTaskData={setTaskData}
                tasks={tasks}
                currentUser={currentUser}
              />
            </div>
          )}
        </div>

        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-200 bg-slate-50/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs md:text-sm text-slate-600 order-2 sm:order-1">
              {Object.values(validationErrors).map((error, idx) => (
                <span key={idx} className="text-red-600 block">* {error}</span>
              ))}
              {isSaving && (
                <span className="text-blue-600">Creating {getTitle().toLowerCase()}...</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasRequiredFields() || !validTenantId}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    <span>Create {getTitle()}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Report Impediment Dialog */}
      <Dialog open={showImpedimentDialog} onOpenChange={setShowImpedimentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Impediment</DialogTitle>
            <DialogDescription>
              This impediment will be linked to the current {getTitle().toLowerCase()} context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Show context that will be captured */}
            {(() => {
              let contextInfo = [];
              const taskType = taskData.task_type;
              if (taskType === "task" || taskType === "bug" || taskType === "technical_debt") {
                if (taskData.sprint_id) {
                  const sprint = sprints.find(s => s.id === taskData.sprint_id);
                  if (sprint) contextInfo.push(`Sprint: ${sprint.name}`);
                }
                if (taskData.story_id) {
                  const story = stories.find(s => (s.id || s._id) === taskData.story_id);
                  if (story) {
                    contextInfo.push(`Story: ${story.title}`);
                    if (story.epic_id) {
                      const epic = epics.find(e => (e.id || e._id) === story.epic_id);
                      if (epic) contextInfo.push(`Epic: ${epic.name}`);
                    }
                  }
                }
              } else if (taskType === "story") {
                if (storyData.epic_id) {
                  const epic = epics.find(e => (e.id || e._id) === storyData.epic_id);
                  if (epic) contextInfo.push(`Epic: ${epic.name}`);
                }
                contextInfo.push("Story: (will be linked after creation)");
              } else if (taskType === "epic") {
                contextInfo.push("Epic: (will be linked after creation)");
              }

              return contextInfo.length > 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-blue-900 mb-1">Context will be linked:</p>
                  <ul className="list-disc list-inside text-blue-700 space-y-1">
                    {contextInfo.map((info, idx) => (
                      <li key={idx}>{info}</li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            <div>
              <Label htmlFor="impediment-title">Title *</Label>
              <Input
                id="impediment-title"
                value={impedimentData.title}
                onChange={(e) => setImpedimentData({ ...impedimentData, title: e.target.value })}
                placeholder="Brief description of the impediment"
                required
              />
            </div>

            <div>
              <Label htmlFor="impediment-description">Description</Label>
              <Textarea
                id="impediment-description"
                value={impedimentData.description}
                onChange={(e) => setImpedimentData({ ...impedimentData, description: e.target.value })}
                placeholder="Detailed explanation and impact"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="impediment-severity">Severity</Label>
              <Select
                value={impedimentData.severity}
                onValueChange={(val) => setImpedimentData({ ...impedimentData, severity: val })}
              >
                <SelectTrigger>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImpedimentDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReportImpediment}
                className="bg-red-600 hover:bg-red-700"
              >
                Report Impediment
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}


