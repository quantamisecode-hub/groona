import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import { useNavigate, useSearchParams } from "react-router-dom"; // Added useSearchParams
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Target, List, Loader2, RefreshCw, Download, ChevronDown, ChevronUp, Eye, CheckSquare, Square, Trash2, BookOpen, Edit, ChevronRight, ListTodo, FolderKanban, Archive } from "lucide-react";
import SprintKanbanBoard from "../components/sprint/SprintKanbanBoard";
import SprintCapacityView from "../components/sprint/SprintCapacityView";
import SprintBurndown from "../components/sprint/SprintBurndown";
import SprintMetrics from "../components/sprint/SprintMetrics";
import CreateSprintDialog from "../components/sprint/CreateSprintDialog";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog";
import CreateTaskModal from "../components/tasks/CreateTaskModal";
import CreateStoryDialog from "../components/stories/CreateStoryDialog";
import StoryDetailDialog from "../components/stories/StoryDetailDialog";
import CreateEpicDialog from "../components/epics/CreateEpicDialog";
import EpicDetailDialog from "../components/epics/EpicDetailDialog";
import { toast } from "sonner";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
// === UPDATED IMPORT ===
import { generateSprintReportPDF } from "../components/insights/PDFReportGenerator";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SprintBoard() {
  const { user: currentUser, effectiveTenantId } = useUser();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [activeTab, setActiveTab] = useState("board");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [showSelectionSection, setShowSelectionSection] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [showMoveToSprintDialog, setShowMoveToSprintDialog] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [selectedSprintForMove, setSelectedSprintForMove] = useState("");
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [editingStoryField, setEditingStoryField] = useState(null);
  const [showCreateStoryDialog, setShowCreateStoryDialog] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [expandedStories, setExpandedStories] = useState(new Set());
  const [selectedEpic, setSelectedEpic] = useState(null);
  const [selectedEpicId, setSelectedEpicId] = useState(null);
  const [showCreateEpicDialog, setShowCreateEpicDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    item: null, // { id, title, type }
    mutation: null
  });

  const [manuallyChangedStatuses, setManuallyChangedStatuses] = useState(new Set()); // Track manually changed story statuses
  const [highlightCommentId, setHighlightCommentId] = useState(null); // Added state for comment highlight
  const queryClient = useQueryClient();
  const printRef = useRef(null); // You can keep this even if unused for now
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // === DEEP LINKING HANDLER ===
  useEffect(() => {
    const taskIdParam = searchParams.get("taskId");
    const commentIdParam = searchParams.get("commentId");

    if (taskIdParam) {
      setSelectedTaskId(taskIdParam);
      if (commentIdParam) {
        setHighlightCommentId(commentIdParam);
      }
    }
  }, [searchParams]);
  // ============================

  const { tenant } = useUser();

  // Check if user is a viewer
  const isViewer = currentUser?.custom_role === 'viewer';

  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';
  const isMarketingCompany = tenant?.company_type === 'MARKETING';

  // Auto-hide selection section when both project and sprint are selected
  React.useEffect(() => {
    if (selectedProjectId && (selectedSprintId || isMarketingCompany)) {
      setShowSelectionSection(false);
    } else {
      setShowSelectionSection(true);
    }
  }, [selectedProjectId, selectedSprintId, isMarketingCompany]);

  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser && !!effectiveTenantId,
    staleTime: 5 * 60 * 1000,
  });

  const projects = isAdmin ? allProjects : allProjects.filter(p => {
    const isTeamMember = p.team_members?.some(m => m.email === currentUser?.email);
    const isProjectManager = projectRoles.some(r => r.project_id === p.id);
    return isTeamMember || isProjectManager;
  });

  const { data: sprints = [], refetch: refetchSprints } = useQuery({
    queryKey: ['sprints', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      return groonabackend.entities.Sprint.filter({ project_id: selectedProjectId }, '-start_date');
    },
    enabled: !!selectedProjectId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: tasks = [], refetch: refetchTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      return groonabackend.entities.Task.filter({ project_id: selectedProjectId }, '-updated_date');
    },
    enabled: !!selectedProjectId,
    staleTime: 30 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!currentUser && !!effectiveTenantId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: stories = [], refetch: refetchStories } = useQuery({
    queryKey: ['stories', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      return groonabackend.entities.Story.filter({ project_id: selectedProjectId });
    },
    enabled: !!selectedProjectId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: epics = [], refetch: refetchEpics } = useQuery({
    queryKey: ['epics', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      return groonabackend.entities.Epic.filter({ project_id: selectedProjectId });
    },
    enabled: !!selectedProjectId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const createSprintMutation = useMutation({
    mutationFn: async ({ sprintData, selectedStoryIds = [] }) => {
      if (!sprintData.start_date || !sprintData.end_date) {
        throw new Error('Start date and end date are required');
      }

      const startDate = new Date(sprintData.start_date);
      const endDate = new Date(sprintData.end_date);

      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }

      const sprintPayload = {
        ...sprintData,
        project_id: selectedProjectId,
        tenant_id: effectiveTenantId,
        status: sprintData.status || 'planned',
      };

      const newSprint = await groonabackend.entities.Sprint.create(sprintPayload);

      // Assign selected stories to the sprint
      if (selectedStoryIds.length > 0 && newSprint.id) {
        try {
          await Promise.all(
            selectedStoryIds.map(storyId =>
              groonabackend.entities.Story.update(storyId, { sprint_id: newSprint.id || newSprint._id })
            )
          );
        } catch (error) {
          console.error('Failed to assign stories to sprint:', error);
          // Don't fail the whole operation if story assignment fails
          toast.warning('Sprint created but some stories could not be assigned');
        }
      }

      await groonabackend.entities.Activity.create({
        tenant_id: effectiveTenantId,
        action: 'created',
        entity_type: 'sprint',
        entity_id: newSprint.id,
        entity_name: newSprint.name,
        project_id: selectedProjectId,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        details: `Created sprint: ${newSprint.name}`,
      });

      return newSprint;
    },
    onSuccess: async (newSprint) => {
      await queryClient.invalidateQueries({ queryKey: ['sprints', selectedProjectId] });
      await queryClient.invalidateQueries({ queryKey: ['stories', selectedProjectId] });
      await queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      setTimeout(() => refetchSprints(), 300);

      setSelectedSprintId(newSprint.id);
      setShowCreateSprint(false);
      toast.success(`Sprint "${newSprint.name}" created successfully!`);
    },
    onError: (error) => {
      toast.error('Failed to create sprint', {
        description: error.message || 'Please try again.'
      });
    },
  });

  const updateSprintMutation = useMutation({
    mutationFn: async ({ id, data: { sprintData, selectedStoryIds = [] } }) => {
      // Update the sprint
      const updatedSprint = await groonabackend.entities.Sprint.update(id, sprintData);

      // Handle story assignment for updates
      if (selectedStoryIds !== undefined) {
        try {
          // Get all stories in the project
          const allStories = await groonabackend.entities.Story.filter({ project_id: selectedProjectId });

          // Remove sprint_id from stories that are no longer selected
          const storiesToRemove = allStories.filter(
            s => {
              const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
              return String(storySprintId) === String(id) && !selectedStoryIds.includes(s.id || s._id);
            }
          );
          await Promise.all(
            storiesToRemove.map(story =>
              groonabackend.entities.Story.update(story.id || story._id, { sprint_id: null })
            )
          );

          // Add sprint_id to newly selected stories
          const storiesToAdd = selectedStoryIds.filter(
            storyId => !allStories.find(s => {
              const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
              return (s.id || s._id) === storyId && String(storySprintId) === String(id);
            })
          );
          await Promise.all(
            storiesToAdd.map(storyId =>
              groonabackend.entities.Story.update(storyId, { sprint_id: id })
            )
          );
        } catch (error) {
          console.error('Failed to update story assignments:', error);
          toast.warning('Sprint updated but story assignments may be incomplete');
        }
      }

      return updatedSprint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['stories', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      toast.success('Sprint updated successfully');
      setEditingSprint(null);
      setShowCreateSprint(false);
    },
    onError: (error) => {
      toast.error(`Failed to update sprint: ${error.message}`);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await groonabackend.entities.Task.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id) => {
      return await groonabackend.entities.Task.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    }
  });

  const updateStoryMutation = useMutation({
    mutationFn: async ({ id, data, silent = false }) => {
      const result = await groonabackend.entities.Story.update(id, data);
      return { result, silent };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['stories', selectedProjectId] });
      if (!response.silent) {
        toast.success('Story updated successfully');
      }
    },
    onError: (error) => {
      toast.error(`Failed to update story: ${error.message}`);
    }
  });

  const deleteStoryMutation = useMutation({
    mutationFn: async (id) => {
      return await groonabackend.entities.Story.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', selectedProjectId] });
      toast.success('Story deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete story: ${error.message}`);
    }
  });

  const deleteEpicMutation = useMutation({
    mutationFn: async (id) => {
      return await groonabackend.entities.Epic.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', selectedProjectId] });
      toast.success('Epic deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete epic: ${error.message}`);
    }
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedSprint = sprints.find(s => s.id === selectedSprintId);
  const isProjectManager = projectRoles.length > 0;
  const userRole = isAdmin ? 'admin' : (isProjectManager ? 'project_manager' : 'user');

  // Filter tasks: For team members (not admin, not project manager), only show assigned tasks
  const isTeamMember = !isAdmin && !isProjectManager;
  const userEmail = currentUser?.email?.toLowerCase();

  // Projects are already filtered at line 62-66 to show projects where user is a team member
  // So we don't need to filter projects again - just use the projects variable directly
  const filteredProjects = projects;

  // Filter tasks: For team members, only show assigned tasks
  // But keep all tasks for admins and project managers
  let filteredTasks = tasks;
  /* 
  // DISABLED FILTERING: Team members should see ALL tasks in the sprint
  if (isTeamMember && userEmail) {
    filteredTasks = tasks.filter(t => {
      // 1. Show if user is the reporter
      if (t.reporter && String(t.reporter).toLowerCase() === String(userEmail).toLowerCase()) {
        return true;
      }

      // 2. Show if user is assigned (check both Email and ID)
      const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
      return taskAssignees.some(assignee => {
        // Normalize assignee value (handle objects with .email or .id, or plain strings)
        const assigneeVal = (typeof assignee === 'object' && assignee !== null)
          ? (assignee.email || assignee.id || '')
          : String(assignee || '');

        const normalizedAssignee = assigneeVal.toLowerCase().trim();
        const normalizedEmail = String(userEmail).toLowerCase().trim();
        const normalizedId = String(currentUser.id || '').toLowerCase().trim();

        return normalizedAssignee === normalizedEmail || normalizedAssignee === normalizedId;
      });
    });
  } 
  */

  /* 
  // Moved sprintTasks and backlogTasks definitions down to allow dependency on sprintBacklogStories
  */

  // Helper function to truncate description to a few words (returns plain text for display)
  const truncateDescription = (html, maxWords = 10) => {
    if (!html) return '';
    // Strip HTML tags to get plain text
    const plainText = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    // Split into words
    const words = plainText.split(/\s+/).filter(word => word.length > 0);
    // If text is shorter than maxWords, return as is
    if (words.length <= maxWords) {
      return plainText;
    }
    // Get first few words
    const truncatedWords = words.slice(0, maxWords).join(' ');
    // Return truncated text with ellipsis
    return truncatedWords + '...';
  };


  // Backlog stories: 
  // - Unassigned stories (no sprint_id) show in ALL sprint backlogs
  // - Assigned stories show ONLY in their assigned sprint's backlog
  // Stories assigned to the selected sprint
  const sprintBacklogStories = React.useMemo(() => {
    if (!selectedSprintId) return [];
    return stories.filter(s => {
      const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
      return String(storySprintId) === String(selectedSprintId);
    });
  }, [stories, selectedSprintId]);

  // Stories not assigned to any sprint (Product Backlog)
  const productBacklogStories = React.useMemo(() => {
    return stories.filter(s => {
      const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
      return !storySprintId || storySprintId === 'null' || storySprintId === '';
    });
  }, [stories]);

  // Combined backlog stories for auto-update logic (unassigned + current sprint)
  const backlogStories = React.useMemo(() => {
    if (!selectedSprintId) return productBacklogStories;
    return [...productBacklogStories, ...sprintBacklogStories];
  }, [productBacklogStories, sprintBacklogStories, selectedSprintId]);

  // Calculate total tasks count for all backlog stories (count all tasks, not just filtered ones)
  const backlogStoriesTaskCount = React.useMemo(() => {
    return backlogStories.reduce((total, story) => {
      const storyId = story.id || story._id;
      // Count all tasks for this story, not just filtered tasks
      const storyTasks = tasks.filter(t => {
        const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
        const taskStoryIdStr = taskStoryId?.id || taskStoryId?._id || taskStoryId;
        return String(taskStoryIdStr) === String(storyId);
      });
      return total + storyTasks.length;
    }, 0);
  }, [backlogStories, tasks]);

  // Redefined sprintTasks with robust logic:
  // 1. Include tasks explicitly in sprint
  // 2. Include tasks belonging to stories in the sprint (even if sprint_id is missing on task)
  // 3. Filter by assignee for Team Members
  const sprintTasks = React.useMemo(() => {
    const sprintStoryIds = new Set(sprintBacklogStories.map(s => s.id || s._id).map(String));

    // Valid tasks for this sprint
    const validSprintTasks = filteredTasks.filter(t => {
      const taskSprintId = t.sprint_id?.id || t.sprint_id?._id || t.sprint_id;
      if (String(taskSprintId) === String(selectedSprintId)) return true;

      const storyId = t.story_id?.id || t.story_id?._id || t.story_id;
      if (storyId && sprintStoryIds.has(String(storyId))) return true;

      return false;
    });

    // Permission filtering
    if (!isTeamMember) {
      return validSprintTasks; // PM/Admin sees ALL tasks
    }

    // Team Member: Only show assigned tasks
    return validSprintTasks.filter(t => {
      // 1. Show if user is the reporter
      if (t.reporter && String(t.reporter).toLowerCase() === String(userEmail).toLowerCase()) {
        return true;
      }

      // 2. Show if user is assigned
      const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
      return taskAssignees.some(assignee => {
        const assigneeVal = (typeof assignee === 'object' && assignee !== null)
          ? (assignee.email || assignee.id || '')
          : String(assignee || '');

        const normalizedAssignee = assigneeVal.toLowerCase().trim();
        const normalizedEmail = String(userEmail).toLowerCase().trim();
        const normalizedId = String(currentUser.id || '').toLowerCase().trim();

        return normalizedAssignee === normalizedEmail || normalizedAssignee === normalizedId;
      });
    });
  }, [filteredTasks, sprintBacklogStories, selectedSprintId, isTeamMember, userEmail, currentUser]);

  const backlogTasks = React.useMemo(() => {
    return filteredTasks.filter(t => {
      const taskSprintId = t.sprint_id?.id || t.sprint_id?._id || t.sprint_id;
      return !taskSprintId || taskSprintId === 'null' || taskSprintId === '';
    });
  }, [filteredTasks]);

  // Helper function to get tasks for a story
  // Only show tasks that belong to stories in the current sprint
  // Helper function to get tasks for a story
  // specificSprintId: 
  // - undefined: use selectedSprintId
  // - null: show unassigned tasks
  // - string: show tasks in that specific sprint
  const getStoryTasks = (storyId, specificSprintId) => {
    const storyIdStr = storyId?.id || storyId?._id || storyId;
    // We ignore specificSprintId effectively, showing all tasks for the story regardless of their individual sprint assignment.
    // This ensures that if a Story is in the sprint, all its tasks are visible, even if they drifted or weren't tagged correctly.

    return filteredTasks.filter(t => {
      const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
      const taskStoryIdStr = taskStoryId?.id || taskStoryId?._id || taskStoryId;

      // Match task to story
      return String(taskStoryIdStr) === String(storyIdStr);
    });
  };

  // Toggle story expansion
  const toggleStoryExpansion = (storyId) => {
    const storyIdStr = storyId?.id || storyId?._id || storyId;
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyIdStr)) {
      newExpanded.delete(storyIdStr);
    } else {
      newExpanded.add(storyIdStr);
    }
    setExpandedStories(newExpanded);
  };

  // Calculate story progress based on task completion
  // If sprint is locked, only count tasks created before locked_date
  // Progress shows 100% only if all tasks (pre-lock) are completed
  const getStoryProgress = (storyId) => {
    const storyIdStr = storyId?.id || storyId?._id || storyId;
    const isSprintLocked = !!selectedSprint?.locked_date;
    const lockedDate = selectedSprint?.locked_date ? new Date(selectedSprint.locked_date) : null;

    // Get all tasks for this story
    const allStoryTasks = tasks.filter(t => {
      const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
      const taskStoryIdStr = taskStoryId?.id || taskStoryId?._id || taskStoryId;
      return String(taskStoryIdStr) === String(storyIdStr);
    });

    // Filter tasks based on sprint lock status
    // If sprint is locked, only count tasks created before locked_date
    // If sprint is not locked, count all tasks
    const relevantTasks = isSprintLocked && lockedDate
      ? allStoryTasks.filter(t => {
        // Only count tasks that existed before sprint was locked
        // Check if task was created before locked_date
        const taskCreatedDate = t.created_date ? new Date(t.created_date) : null;
        return taskCreatedDate && taskCreatedDate < lockedDate;
      })
      : allStoryTasks;

    if (relevantTasks.length === 0) {
      return { percentage: 0, completed: 0, total: 0 };
    }

    const completedTasks = relevantTasks.filter(t => t.status === 'completed');
    const percentage = (completedTasks.length / relevantTasks.length) * 100;

    return {
      percentage: Math.round(percentage),
      completed: completedTasks.length,
      total: relevantTasks.length
    };
  };

  // Auto-update story status based on progress
  // Status changes: 0% → todo, >0% but <100% → in_progress, 100% → done
  // But respect manually changed statuses (in_review, blocked, cancelled)
  React.useEffect(() => {
    if (!stories.length || !tasks.length) return;

    backlogStories.forEach(story => {
      const storyId = story.id || story._id;
      const storyIdStr = String(storyId);
      const currentStatus = (story.status || '').toLowerCase();
      const progress = getStoryProgress(storyId);

      // Determine expected status based on progress
      let expectedStatus = null;
      if (progress.percentage === 0) {
        expectedStatus = 'todo';
      } else if (progress.percentage === 100) {
        // At 100%, always set to "done" (can override in_review)
        expectedStatus = 'done';
      } else if (progress.percentage > 0 && progress.percentage < 100) {
        // Between 0% and 100%, set to "in_progress" unless manually set to "in_review"
        // If manually set to "in_review", keep it as "in_review"
        if (currentStatus === 'in_review' && manuallyChangedStatuses.has(storyIdStr)) {
          return; // Keep in_review if manually set
        }
        expectedStatus = 'in_progress';
      }

      // Only auto-update if expected status is different from current
      if (expectedStatus && expectedStatus !== currentStatus) {
        // Don't auto-update if manually set to blocked or cancelled
        if (currentStatus === 'blocked' || currentStatus === 'cancelled') {
          return;
        }

        // If story was manually changed but current status doesn't match expected,
        // it means user changed it away from auto-status, so respect that
        // Exception: Always allow 0% → todo and 100% → done
        if (manuallyChangedStatuses.has(storyIdStr)) {
          // Allow auto-update only for 0% → todo or 100% → done
          if (expectedStatus !== 'todo' && expectedStatus !== 'done') {
            return;
          }
        }

        updateStoryMutation.mutate({
          id: storyId,
          data: { status: expectedStatus },
          silent: true // Suppress toast for auto-updates
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, tasks, backlogStories, manuallyChangedStatuses, selectedSprint]);

  const isCurrentProjectManager = projectRoles.some(r => r.project_id === selectedProjectId);
  const canViewMetrics = isAdmin || isCurrentProjectManager;

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700 border-slate-200' },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      review: { label: 'Review', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      completed: { label: 'Done', color: 'bg-green-100 text-green-700 border-green-200' },
    };
    const config = statusConfig[status] || statusConfig.todo;
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200' },
      medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600 border-blue-200' },
      high: { label: 'High', color: 'bg-amber-100 text-amber-600 border-amber-200' },
      urgent: { label: 'Urgent', color: 'bg-red-100 text-red-600 border-red-200' },
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const getEpicStatusBadge = (status) => {
    const statusConfig = {
      planning: { label: 'Planning', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' },
    };
    const config = statusConfig[status] || statusConfig.planning;
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  // Filter epics to only show those with stories in the current sprint
  const sprintEpics = React.useMemo(() => {
    if (!selectedSprintId) {
      // If no sprint selected, show epics with unassigned stories
      return epics.filter(epic => {
        const epicId = epic.id || epic._id;
        return stories.some(s => {
          const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
          return String(storyEpicId) === String(epicId) && !storySprintId;
        });
      });
    }

    // If a sprint is selected, show epics that have at least one story in this sprint
    return epics.filter(epic => {
      const epicId = epic.id || epic._id;
      return stories.some(s => {
        const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;

        // Story must belong to this epic
        if (String(storyEpicId) !== String(epicId)) return false;

        // Story must be in the current sprint (or unassigned, which shows in all sprints)
        if (!storySprintId) return true; // Unassigned stories appear in all sprint epics

        return String(storySprintId) === String(selectedSprintId);
      });
    });
  }, [epics, stories, selectedSprintId]);

  // Calculate epic progress based on story completion (only for stories in current sprint)
  const getEpicProgress = (epicId) => {
    const epicIdStr = epicId?.id || epicId?._id || epicId;

    // Filter stories by epic and sprint
    const epicStories = stories.filter(s => {
      const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
      if (String(storyEpicId) !== String(epicIdStr)) return false;

      // If sprint is selected, only count stories in that sprint (or unassigned)
      if (selectedSprintId) {
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
        // Include unassigned stories (they appear in all sprint epics)
        if (!storySprintId) return true;
        return String(storySprintId) === String(selectedSprintId);
      } else {
        // No sprint selected - only count unassigned stories
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
        return !storySprintId;
      }
    });

    if (epicStories.length === 0) return { percentage: 0, completed: 0, total: 0 };

    const totalPoints = epicStories.reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);
    const completedPoints = epicStories
      .filter(s => s.status === 'done')
      .reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);

    if (totalPoints === 0) return { percentage: 0, completed: 0, total: 0 };

    return {
      percentage: Math.round((completedPoints / totalPoints) * 100),
      completed: completedPoints,
      total: totalPoints
    };
  };

  const getStoryStatusBadge = (status) => {
    const statusConfig = {
      todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700 border-slate-200' },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      in_review: { label: 'In Review', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      done: { label: 'Done', color: 'bg-green-100 text-green-700 border-green-200' },
      blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700 border-red-200' },
      cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    };
    const config = statusConfig[status] || statusConfig.todo;
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const handleStoryFieldUpdate = (storyId, field, value) => {
    // If status is being manually changed, mark it as manually changed
    if (field === 'status') {
      const storyIdStr = String(storyId?.id || storyId?._id || storyId);
      const newManuallyChanged = new Set(manuallyChangedStatuses);
      newManuallyChanged.add(storyIdStr);
      setManuallyChangedStatuses(newManuallyChanged);
    }
    updateStoryMutation.mutate({ id: storyId, data: { [field]: value }, silent: false });
    setEditingStoryId(null);
    setEditingStoryField(null);
  };

  const handleTaskCheckbox = (taskId, checked) => {
    const newSelected = new Set(selectedTasks);
    if (checked) {
      newSelected.add(taskId);
      setSelectedTasks(newSelected);
      setShowMoveToSprintDialog(true);
    } else {
      newSelected.delete(taskId);
      setSelectedTasks(newSelected);
      if (newSelected.size === 0) {
        setShowMoveToSprintDialog(false);
      }
    }
  };

  const handleMoveToSprint = () => {
    if (!selectedSprintForMove) {
      toast.error("Please select a sprint");
      return;
    }
    const taskCount = selectedTasks.size;
    selectedTasks.forEach(taskId => {
      updateTaskMutation.mutate({ id: taskId, data: { sprint_id: selectedSprintForMove } });
    });
    setSelectedTasks(new Set());
    setShowMoveToSprintDialog(false);
    setSelectedSprintForMove("");
    toast.success(`Moved ${taskCount} task(s) to sprint`);
  };

  const handleFieldUpdate = (taskId, field, value) => {
    updateTaskMutation.mutate({ id: taskId, data: { [field]: value } });
    setEditingTaskId(null);
    setEditingField(null);
  };


  const handleProjectChange = (projectId) => {
    setSelectedProjectId(projectId);
    setSelectedSprintId("");
  };

  const handleManualRefresh = () => {
    refetchTasks();
    refetchSprints();
    toast.success('Refreshed!');
  };

  // === UPDATED: Data-Driven PDF Export ===
  const handleExportSprintReport = async () => {
    // We no longer rely on 'printRef' (DOM screenshot)
    if (!selectedSprint) return;

    try {
      toast.info('Generating PDF report...');

      // Call the new text-based generator function
      const pdfBlob = generateSprintReportPDF(selectedSprint, sprintTasks, selectedProject);

      if (pdfBlob) {
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sprint_Report_${selectedSprint.name.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Sprint report downloaded');
      }
    } catch (error) {
      console.error('[SprintBoard] Export error:', error);
      toast.error('Failed to export sprint report');
    }
  };


  const handleTaskClick = (taskId) => {
    setSelectedTaskId(taskId);
  };

  const renderBacklogTable = (storiesList, sprintIdFilter, title, IconComponent) => {
    const taskCount = storiesList.reduce((total, story) => {
      return total + getStoryTasks(story.id || story._id, sprintIdFilter).length;
    }, 0);

    return (
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <IconComponent className="h-5 w-5 text-blue-600" />
                {title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-300">
                  {storiesList.length} {storiesList.length === 1 ? 'Story' : 'Stories'}
                </Badge>
                {taskCount > 0 && (
                  <Badge variant="outline" className="border-slate-300">
                    {taskCount} {taskCount === 1 ? 'Task' : 'Tasks'}
                  </Badge>
                )}
              </div>
            </div>
            {!isViewer && (
              <Button
                onClick={() => setShowCreateTaskDialog(true)}
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 w-full md:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Assignee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-slate-200">
                {storiesList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-500">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p>No stories in this section</p>
                    </td>
                  </tr>
                ) : (
                  storiesList.map((story) => {
                    const storyId = story.id || story._id;
                    const storyTasks = getStoryTasks(storyId, sprintIdFilter);
                    const isExpanded = expandedStories.has(storyId);
                    const storyAssignees = Array.isArray(story.assigned_to)
                      ? story.assigned_to.filter(Boolean)
                      : (story.assigned_to ? [story.assigned_to] : []);
                    const isEditingStatus = editingStoryId === storyId && editingStoryField === 'status';
                    const isEditingAssignee = editingStoryId === storyId && editingStoryField === 'assignee';
                    const isEditingPriority = editingStoryId === storyId && editingStoryField === 'priority';
                    const isEditingDueDate = editingStoryId === storyId && editingStoryField === 'due_date';

                    return (
                      <React.Fragment key={storyId}>
                        <tr
                          className="hover:bg-slate-50 transition-colors bg-slate-50/30 cursor-pointer"
                          onClick={() => setSelectedStoryId(storyId)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStoryExpansion(storyId);
                                }}
                                className="h-5 w-5 p-0 mt-0.5 -ml-1"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500" />
                                )}
                              </Button>
                              <BookOpen className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-900 text-sm">{story.title}</div>
                                  {story.description && (
                                    (() => {
                                      const hasHTML = /<[^>]+>/.test(story.description);
                                      if (hasHTML) {
                                        return (
                                          <div
                                            className="text-xs text-slate-500 mt-1 line-clamp-1 prose prose-xs max-w-none prose-headings:text-slate-600 prose-p:text-slate-500 prose-strong:text-slate-600 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-500 prose-ol:text-slate-500 prose-li:text-slate-500"
                                            dangerouslySetInnerHTML={{ __html: story.description }}
                                          />
                                        );
                                      }
                                      return (
                                        <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                                          {truncateDescription(story.description, 10)}
                                        </div>
                                      );
                                    })()
                                  )}
                                  {storyTasks.length > 0 && (
                                    <div className="text-xs text-slate-400 mt-1">
                                      {storyTasks.length} {storyTasks.length === 1 ? 'Task' : 'Tasks'}
                                    </div>
                                  )}
                                </div>
                                {(() => {
                                  const progress = getStoryProgress(storyId);
                                  return progress.total > 0 ? (
                                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: '80px' }}>
                                      <Progress
                                        value={progress.percentage}
                                        className="h-1.5 flex-1"
                                        title={`${progress.percentage}% complete`}
                                      />
                                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                                        {progress.percentage}%
                                      </span>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isEditingStatus ? (
                              <Select
                                value={story.status}
                                onValueChange={(value) => {
                                  handleStoryFieldUpdate(storyId, 'status', value);
                                }}
                                onOpenChange={(open) => !open && setEditingStoryId(null)}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <SelectTrigger className="w-32 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todo">To Do</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="in_review">In Review</SelectItem>
                                  <SelectItem value="done">Done</SelectItem>
                                  <SelectItem value="blocked">Blocked</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStoryId(storyId);
                                  setEditingStoryField('status');
                                }}
                                className="cursor-pointer"
                              >
                                {getStoryStatusBadge(story.status)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditingAssignee ? (
                              <Select
                                value={storyAssignees[0] || "unassigned"}
                                onValueChange={(value) => {
                                  const newValue = value === "unassigned" ? [] : [value];
                                  handleStoryFieldUpdate(storyId, 'assigned_to', newValue);
                                }}
                                onOpenChange={(open) => !open && setEditingStoryId(null)}
                              >
                                <SelectTrigger className="w-40 h-7 text-xs">
                                  <SelectValue placeholder="Select assignee" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {users.map((user) => (
                                    <SelectItem key={user.id} value={user.email}>
                                      {user.full_name || user.email}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStoryId(storyId);
                                  setEditingStoryField('assignee');
                                }}
                                className="cursor-pointer"
                              >
                                {storyAssignees.length > 0 ? (
                                  <div className="flex items-center -space-x-2">
                                    {storyAssignees.slice(0, 3).map((email, idx) => {
                                      const user = users.find(u => u.email === email);
                                      const initials = user?.full_name ? getInitials(user.full_name) : getInitials(email?.split('@')[0] || '?');
                                      return (
                                        <Avatar key={email + idx} className="h-7 w-7 border-2 border-white ring-1 ring-slate-100">
                                          <AvatarImage src={user?.profile_image_url} />
                                          <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 font-medium">
                                            {initials}
                                          </AvatarFallback>
                                        </Avatar>
                                      );
                                    })}
                                    {storyAssignees.length > 3 && (
                                      <div className="h-7 w-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-medium text-slate-600">
                                        +{storyAssignees.length - 3}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">Unassigned</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditingPriority ? (
                              <Select
                                value={story.priority}
                                onValueChange={(value) => handleStoryFieldUpdate(storyId, 'priority', value)}
                                onOpenChange={(open) => !open && setEditingStoryId(null)}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <SelectTrigger className="w-28 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStoryId(storyId);
                                  setEditingStoryField('priority');
                                }}
                                className="cursor-pointer"
                              >
                                {getPriorityBadge(story.priority)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditingDueDate ? (
                              <Popover open={isEditingDueDate} onOpenChange={(open) => {
                                if (!open) {
                                  setEditingStoryId(null);
                                  setEditingStoryField(null);
                                }
                              }}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(
                                      "w-36 h-7 text-xs justify-start text-left font-normal",
                                      !story.due_date && "text-muted-foreground"
                                    )}
                                  >
                                    <Calendar className="mr-2 h-3 w-3" />
                                    {story.due_date ? format(new Date(story.due_date), 'MMM d, yyyy') : "Pick a date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={story.due_date ? new Date(story.due_date) : undefined}
                                    onSelect={(date) => {
                                      if (date) {
                                        handleStoryFieldUpdate(storyId, 'due_date', format(date, 'yyyy-MM-dd'));
                                      }
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStoryId(storyId);
                                  setEditingStoryField('due_date');
                                }}
                                className="cursor-pointer"
                              >
                                {story.due_date ? (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                    <span>{format(new Date(story.due_date), 'MMM d, yyyy')}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">No due date</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!isViewer && (
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStory(story);
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                  title={selectedSprint?.locked_date ? "Sprint locked - Stories remain stable" : "Edit Story"}
                                  disabled={!!selectedSprint?.locked_date}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmation({
                                      isOpen: true,
                                      item: { id: storyId, title: story.title, type: 'Story' },
                                      mutation: () => deleteStoryMutation.mutate(storyId)
                                    });
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                  title="Delete Story"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          storyTasks.length > 0 ? (
                            storyTasks.map((task) => {
                              const assignees = Array.isArray(task.assigned_to)
                                ? task.assigned_to.filter(Boolean)
                                : (task.assigned_to ? [task.assigned_to] : []);
                              const isEditingTaskStatus = editingTaskId === task.id && editingField === 'status';
                              const isEditingTaskAssignee = editingTaskId === task.id && editingField === 'assignee';
                              const isEditingTaskPriority = editingTaskId === task.id && editingField === 'priority';
                              const isEditingTaskDueDate = editingTaskId === task.id && editingField === 'due_date';

                              return (
                                <tr
                                  key={task.id}
                                  className="hover:bg-slate-50 transition-colors bg-slate-100/50 cursor-pointer"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  <td className="px-4 py-3 pl-12">
                                    <div className="flex items-start gap-2">
                                      <ListTodo className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <div className="font-medium text-slate-700 text-sm">{task.title}</div>
                                        {task.description && (
                                          (() => {
                                            const hasHTML = /<[^>]+>/.test(task.description);
                                            if (hasHTML) {
                                              return (
                                                <div
                                                  className="text-xs text-slate-500 mt-1 line-clamp-1 prose prose-xs max-w-none prose-headings:text-slate-600 prose-p:text-slate-500 prose-strong:text-slate-600 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-500 prose-ol:text-slate-500 prose-li:text-slate-500"
                                                  dangerouslySetInnerHTML={{ __html: task.description }}
                                                />
                                              );
                                            }
                                            return (
                                              <div className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description}</div>
                                            );
                                          })()
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {isEditingTaskStatus ? (
                                      <Select
                                        value={task.status}
                                        onValueChange={(value) => handleFieldUpdate(task.id, 'status', value)}
                                        onOpenChange={(open) => !open && setEditingTaskId(null)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                      >
                                        <SelectTrigger className="w-32 h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="todo">To Do</SelectItem>
                                          <SelectItem value="in_progress">In Progress</SelectItem>
                                          <SelectItem value="review">Review</SelectItem>
                                          <SelectItem value="completed">Done</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTaskId(task.id);
                                          setEditingField('status');
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {getStatusBadge(task.status)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {isEditingTaskAssignee ? (
                                      <Select
                                        value={assignees[0] || "unassigned"}
                                        onValueChange={(value) => {
                                          const newValue = value === "unassigned" ? null : value;
                                          handleFieldUpdate(task.id, 'assigned_to', newValue);
                                        }}
                                        onOpenChange={(open) => !open && setEditingTaskId(null)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                      >
                                        <SelectTrigger className="w-40 h-7 text-xs">
                                          <SelectValue placeholder="Select assignee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unassigned">Unassigned</SelectItem>
                                          {users.map((user) => (
                                            <SelectItem key={user.id} value={user.email}>
                                              {user.full_name || user.email}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTaskId(task.id);
                                          setEditingField('assignee');
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {assignees.length > 0 ? (
                                          <div className="flex items-center -space-x-2">
                                            {assignees.slice(0, 3).map((email, idx) => {
                                              const user = users.find(u => u.email === email);
                                              const initials = user?.full_name ? getInitials(user.full_name) : getInitials(email?.split('@')[0] || '?');
                                              return (
                                                <Avatar key={email + idx} className="h-7 w-7 border-2 border-white ring-1 ring-slate-100">
                                                  <AvatarImage src={user?.profile_image_url} />
                                                  <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 font-medium">
                                                    {initials}
                                                  </AvatarFallback>
                                                </Avatar>
                                              );
                                            })}
                                            {assignees.length > 3 && (
                                              <div className="h-7 w-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-medium text-slate-600">
                                                +{assignees.length - 3}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400">Unassigned</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {isEditingTaskPriority ? (
                                      <Select
                                        value={task.priority}
                                        onValueChange={(value) => handleFieldUpdate(task.id, 'priority', value)}
                                        onOpenChange={(open) => !open && setEditingTaskId(null)}
                                      >
                                        <SelectTrigger className="w-28 h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="low">Low</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTaskId(task.id);
                                          setEditingField('priority');
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {getPriorityBadge(task.priority)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {isEditingTaskDueDate ? (
                                      <Popover open={isEditingTaskDueDate} onOpenChange={(open) => {
                                        if (!open) {
                                          setEditingTaskId(null);
                                          setEditingField(null);
                                        }
                                      }}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                              "w-36 h-7 text-xs justify-start text-left font-normal",
                                              !task.due_date && "text-muted-foreground"
                                            )}
                                          >
                                            <Calendar className="mr-2 h-3 w-3" />
                                            {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : "Pick a date"}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <CalendarComponent
                                            mode="single"
                                            selected={task.due_date ? new Date(task.due_date) : undefined}
                                            onSelect={(date) => {
                                              if (date) {
                                                handleFieldUpdate(task.id, 'due_date', format(date, 'yyyy-MM-dd'));
                                              }
                                            }}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTaskId(task.id);
                                          setEditingField('due_date');
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {task.due_date ? (
                                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400">No due date</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {!isViewer && (
                                      <div className="flex justify-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTaskClick(task.id);
                                          }}
                                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                          title="Edit Task"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirmation({
                                              isOpen: true,
                                              item: { id: task.id, title: task.title, type: 'Task' },
                                              mutation: () => deleteTaskMutation.mutate(task.id)
                                            });
                                          }}
                                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                          title="Delete Task"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr className="bg-slate-50/50">
                              <td colSpan={7} className="px-4 py-3 pl-12 text-sm text-slate-500 italic">
                                No tasks found for this story.
                              </td>
                            </tr>
                          )
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="sprint_board">
      <FeatureOnboarding
        currentUser={currentUser}
        featureArea="sprint_board"
        userRole={userRole}
      />
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden" ref={printRef}>
        <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            {/* Fixed Header Section */}
            <div className="flex-none z-30 bg-slate-50 px-4 md:px-6 lg:px-8 mb-10">
              <Card className="bg-white border-slate-200/60 shadow-lg mt-4" data-onboarding="sprint-selection">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col">
                      <CardTitle className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                        {isMarketingCompany ? "Campaign Board" : "Sprint Board"}
                      </CardTitle>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => setShowSelectionSection(!showSelectionSection)}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                          >
                            {showSelectionSection ? (
                              <ChevronDown className="h-4 w-4 text-slate-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-600 rotate-[-90deg]" />
                            )}
                          </button>
                          <p className="text-slate-600 text-sm">
                            {isMarketingCompany ? "Manage campaigns and track progress" : "Manage sprints and track progress"}
                          </p>
                        </div>

                        {selectedProject && (
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 text-sm text-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 hidden md:inline">•</span>
                              <span className="font-medium">Selected {isMarketingCompany ? 'Campaign' : 'Project'}:</span> {selectedProject.name}
                            </div>
                            {selectedSprint && !isMarketingCompany && (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 hidden md:inline">•</span>
                                <span className="font-medium">Sprint:</span> {selectedSprint.name}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 mt-2 md:mt-0 md:ml-auto w-full md:w-auto">
                          {selectedProjectId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleManualRefresh}
                              className="flex items-center gap-2 h-9 flex-1 md:flex-none justify-center"
                            >
                              <RefreshCw className={`h-4 w-4 ${tasksLoading ? 'animate-spin' : ''}`} />
                              Refresh
                            </Button>
                          )}
                          {selectedSprintId && !isMarketingCompany && (
                            <Button
                              onClick={handleExportSprintReport}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 h-9 flex-1 md:flex-none justify-center"
                            >
                              <Download className="h-4 w-4" />
                              Export PDF
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Wide Selection Dropdowns - Responsive */}
                    {showSelectionSection && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                        <div className="flex-1 w-full">
                          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                            <SelectTrigger className="bg-white h-9 text-sm w-full">
                              <SelectValue placeholder={`Select ${isMarketingCompany ? 'Campaign' : 'Project'} *`} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredProjects.length === 0 ? (
                                <SelectItem value="no-projects" disabled>
                                  {isTeamMember && filteredTasks.length === 0
                                    ? "No projects with assigned tasks"
                                    : `No ${isMarketingCompany ? 'campaigns' : 'projects'} available`}
                                </SelectItem>
                              ) : (
                                filteredProjects.map(project => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {!isMarketingCompany && (
                          <>
                            <div className="flex-1 w-full">
                              <Select
                                value={selectedSprintId}
                                onValueChange={setSelectedSprintId}
                                disabled={!selectedProjectId}
                              >
                                <SelectTrigger className="bg-white h-9 text-sm w-full">
                                  <SelectValue placeholder={selectedProjectId ? "Select Sprint" : "Select project first"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {sprints.length === 0 ? (
                                    <SelectItem value="no-sprints" disabled>No sprints yet</SelectItem>
                                  ) : (
                                    sprints.map(sprint => (
                                      <SelectItem key={sprint.id} value={sprint.id}>
                                        {sprint.name} ({sprint.status})
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            {selectedProjectId && !isViewer && (
                              <Button
                                onClick={() => setShowCreateSprint(true)}
                                size="sm"
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white h-9 flex-shrink-0"
                              >
                                <Plus className="h-4 w-4 mr-1.5" />
                                New Sprint
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* Injected TabsList to join header */}
              {selectedProjectId && selectedSprintId && selectedSprint && !isMarketingCompany && (
                <div className="mt-2 pb-4">
                  <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 gap-1 bg-white border-slate-200/60 shadow-sm hide-scrollbar">
                    <TabsTrigger value="board" className="flex-shrink-0">Sprint Board</TabsTrigger>
                    <TabsTrigger value="sprint-backlog" className="flex-shrink-0">Sprint Backlog</TabsTrigger>
                    <TabsTrigger value="backlog" className="flex-shrink-0">Backlog</TabsTrigger>
                    <TabsTrigger value="epics" className="flex-shrink-0">Epics</TabsTrigger>
                    {/* RESTRICTED: Capacity and Metrics */}
                    {canViewMetrics && <TabsTrigger value="capacity" className="flex-shrink-0">Capacity</TabsTrigger>}
                    <TabsTrigger value="burndown" className="flex-shrink-0">Burndown</TabsTrigger>
                    {canViewMetrics && <TabsTrigger value="metrics" className="flex-shrink-0">Metrics</TabsTrigger>}
                  </TabsList>
                </div>
              )}
            </div>

            {/* Scrollable Content Section */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
              <div className="space-y-6">
                {!selectedProjectId && (
                  <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                    <CardContent className="py-12 text-center">
                      <Target className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">Get Started</h3>
                      <p className="text-slate-600">Please select a {isMarketingCompany ? 'campaign' : 'project'} above to begin {isMarketingCompany ? "managing tasks" : "sprint planning"}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedProjectId && !selectedSprintId && !isMarketingCompany && (
                  <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                    <CardContent className="py-12 text-center">
                      <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">Select or Create a Sprint</h3>
                      <p className="text-slate-600 mb-4">Choose an existing sprint or create a new one to continue</p>
                      {!isViewer && (
                        <Button
                          onClick={() => setShowCreateSprint(true)}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Sprint
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedProjectId && isMarketingCompany && (
                  <div className="space-y-6">
                    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                      <CardContent className="p-6">
                        <SprintKanbanBoard
                          sprint={{ name: selectedProject?.name || 'Campaign', id: 'marketing-campaign' }}
                          tasks={tasks}
                          allTasks={tasks}
                          onUpdate={(id, data) => {
                            const updates = { ...data };
                            // Handle completed_date logic
                            if (data.status) {
                              if (data.status === 'completed') {
                                updates.completed_date = new Date().toISOString();
                              } else {
                                // If moving out of completed (and not just updating other fields), clear date?
                                // Actually better to check if it WAS completed. 
                                // For now, simpler: if moving TO non-completed, clear it.
                                updates.completed_date = null;
                              }
                            }
                            updateTaskMutation.mutate({ id, data: updates })
                          }}
                          onDelete={(id) => {
                            const task = tasks.find(t => t.id === id);
                            setDeleteConfirmation({
                              isOpen: true,
                              item: { id, title: task?.title || 'this task', type: 'Task' },
                              mutation: () => deleteTaskMutation.mutate(id)
                            });
                          }}
                          onTaskClick={handleTaskClick}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {selectedProjectId && selectedSprintId && selectedSprint && !isMarketingCompany && (
                  <div className="space-y-6">

                    <TabsContent value="board" className="mt-6">
                      {sprintTasks.length === 0 && isTeamMember ? (
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                          <CardContent className="p-12 text-center">
                            <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Tasks Assigned</h3>
                            <p className="text-slate-600">You don't have any tasks assigned in this sprint.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                          <CardContent className="p-6">
                            <SprintKanbanBoard
                              sprint={selectedSprint}
                              tasks={sprintTasks}
                              allTasks={tasks}
                              onEditSprint={(sprint) => {
                                setEditingSprint(sprint);
                                setShowCreateSprint(true);
                              }}
                              onUpdate={(id, data) => {
                                const updates = { ...data };
                                if (data.status) {
                                  if (data.status === 'completed') {
                                    updates.completed_date = new Date().toISOString();
                                  } else {
                                    updates.completed_date = null;
                                  }
                                }
                                updateTaskMutation.mutate({ id, data: updates });
                              }}
                              onDelete={(id) => {
                                const task = tasks.find(t => t.id === id);
                                setDeleteConfirmation({
                                  isOpen: true,
                                  item: { id, title: task?.title || 'this task', type: 'Task' },
                                  mutation: () => deleteTaskMutation.mutate(id)
                                });
                              }}
                              showAvailability={true}
                              onTaskClick={handleTaskClick}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="sprint-backlog" className="mt-6">
                      {sprintBacklogStories.length === 0 && isTeamMember ? (
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                          <CardContent className="p-12 text-center">
                            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Stories in Sprint</h3>
                            <p className="text-slate-600">This sprint doesn't have any stories assigned yet.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        renderBacklogTable(sprintBacklogStories, selectedSprintId, "Sprint Backlog", ListTodo)
                      )}
                    </TabsContent>

                    <TabsContent value="backlog" className="mt-6">
                      {productBacklogStories.length === 0 && isTeamMember ? (
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                          <CardContent className="p-12 text-center">
                            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Stories in Product Backlog</h3>
                            <p className="text-slate-600">You don't have any unassigned stories in the backlog.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        renderBacklogTable(productBacklogStories, null, "Product Backlog", BookOpen)
                      )}
                    </TabsContent>

                    <TabsContent value="epics" className="mt-6">
                      {sprintEpics.length === 0 && isTeamMember ? (
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                          <CardContent className="p-12 text-center">
                            <FolderKanban className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Epics</h3>
                            <p className="text-slate-600">
                              {selectedSprintId
                                ? "There are no epics with stories in this sprint."
                                : "There are no epics with unassigned stories."}
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <FolderKanban className="h-5 w-5 text-blue-600" />
                                  {selectedSprintId ? 'Sprint Epics' : 'Project Epics'}
                                  <Badge variant="outline" className="ml-2">
                                    {sprintEpics.length} {sprintEpics.length === 1 ? 'Epic' : 'Epics'}
                                  </Badge>
                                </CardTitle>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Priority</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Progress</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Stories</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Due Date</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-slate-200">
                                  {sprintEpics.length === 0 ? (
                                    <tr>
                                      <td colSpan="7" className="px-4 py-12 text-center text-slate-500">
                                        <FolderKanban className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                        <p>
                                          {selectedSprintId
                                            ? "No epics with stories in this sprint"
                                            : "No epics with unassigned stories"}
                                        </p>
                                      </td>
                                    </tr>
                                  ) : (
                                    sprintEpics.map((epic) => {
                                      const epicId = epic.id || epic._id;
                                      const progress = getEpicProgress(epicId);
                                      // Filter stories by epic and sprint
                                      const epicStories = stories.filter(s => {
                                        const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
                                        if (String(storyEpicId) !== String(epicId)) return false;

                                        // If sprint is selected, only count stories in that sprint (or unassigned)
                                        if (selectedSprintId) {
                                          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
                                          // Include unassigned stories (they appear in all sprint epics)
                                          if (!storySprintId) return true;
                                          return String(storySprintId) === String(selectedSprintId);
                                        } else {
                                          // No sprint selected - only count unassigned stories
                                          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
                                          return !storySprintId;
                                        }
                                      });

                                      return (
                                        <tr
                                          key={epicId}
                                          className="hover:bg-slate-50 transition-colors bg-slate-50/30 cursor-pointer"
                                          onClick={() => setSelectedEpicId(epicId)}
                                        >
                                          <td className="px-4 py-3">
                                            <div className="flex items-start gap-2">
                                              <div
                                                className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
                                                style={{ backgroundColor: epic.color || "#3b82f6" }}
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium text-slate-900 text-sm">{epic.name}</div>
                                                {epic.description && (
                                                  <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                                                    {truncateDescription(epic.description, 15)}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            {getEpicStatusBadge(epic.status)}
                                          </td>
                                          <td className="px-4 py-3">
                                            {getPriorityBadge(epic.priority)}
                                          </td>
                                          <td className="px-4 py-3">
                                            {progress.total > 0 ? (
                                              <div className="flex items-center gap-1.5" style={{ minWidth: '100px' }}>
                                                <Progress
                                                  value={progress.percentage}
                                                  className="h-1.5 flex-1"
                                                  title={`${progress.percentage}% complete`}
                                                />
                                                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                                                  {progress.percentage}%
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-slate-400">No stories</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            <Badge variant="outline" className="text-xs">
                                              {epicStories.length} {epicStories.length === 1 ? 'Story' : 'Stories'}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-3">
                                            {epic.due_date ? (
                                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{format(new Date(epic.due_date), 'MMM d, yyyy')}</span>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-slate-400">No due date</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            {!isViewer && (
                                              <div className="flex justify-center gap-1">
                                                {!isViewer && (
                                                  <>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEpic(epic);
                                                        setShowCreateEpicDialog(true);
                                                      }}
                                                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                                      title="Edit Epic"
                                                    >
                                                      <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmation({
                                                          isOpen: true,
                                                          item: { id: epicId, title: epic.name, type: 'Epic' },
                                                          mutation: () => deleteEpicMutation.mutate(epicId)
                                                        });
                                                      }}
                                                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                                      title="Delete Epic"
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* RESTRICTED CONTENT */}
                    {canViewMetrics && (
                      <TabsContent value="capacity" className="mt-6">
                        <SprintCapacityView
                          sprint={selectedSprint}
                          tasks={sprintTasks}
                          projectId={selectedProjectId}
                        />
                      </TabsContent>
                    )}

                    <TabsContent value="burndown" className="mt-6">
                      <SprintBurndown
                        sprint={selectedSprint}
                        tasks={sprintTasks}
                      />
                    </TabsContent>

                    {canViewMetrics && (
                      <TabsContent value="metrics" className="mt-6 space-y-6">
                        <SprintMetrics
                          sprint={selectedSprint}
                          tasks={sprintTasks}
                          projectId={selectedProjectId}
                        />
                      </TabsContent>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!isMarketingCompany && (
              <CreateSprintDialog
                open={showCreateSprint}
                onClose={() => {
                  setShowCreateSprint(false);
                  setEditingSprint(null);
                }}
                onSubmit={(data) => {
                  if (editingSprint) {
                    updateSprintMutation.mutate({ id: editingSprint.id, data });
                  } else {
                    createSprintMutation.mutate(data);
                  }
                }}
                loading={createSprintMutation.isPending || updateSprintMutation.isPending}
                projectId={selectedProjectId}
                projectName={selectedProject?.name}
                initialValues={editingSprint}
              />
            )}

            {/* Create Task Dialog */}
            <CreateTaskModal
              open={showCreateTaskDialog}
              onClose={() => setShowCreateTaskDialog(false)}
              projectId={selectedProjectId}
              onSuccess={() => {
                refetchTasks();
                setShowCreateTaskDialog(false);
              }}
            />
            {/* RENDER TASK DETAIL DIALOG WITH CALLBACK */}
            <TaskDetailDialog
              open={!!selectedTaskId}
              onClose={() => {
                setSelectedTaskId(null);
                setHighlightCommentId(null);
                // Clear URL params on close
                setSearchParams(params => {
                  const newParams = new URLSearchParams(params);
                  newParams.delete('taskId');
                  newParams.delete('commentId');
                  return newParams;
                });
              }}
              taskId={selectedTaskId}
              highlightCommentId={highlightCommentId} // Pass highlight ID
              onTaskUpdate={() => {
                refetchTasks();
                refetchSprints();
              }}
            />

            {/* RENDER STORY DETAIL DIALOG */}
            <StoryDetailDialog
              open={!!selectedStoryId}
              onClose={() => setSelectedStoryId(null)}
              storyId={selectedStoryId}
              onStoryUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['stories', selectedProjectId] });
              }}
            />

            {/* Move to Sprint Dialog */}
            <Dialog open={showMoveToSprintDialog} onOpenChange={setShowMoveToSprintDialog}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Move to Sprint</DialogTitle>
                  <DialogDescription>
                    {selectedTasks.size > 0
                      ? `Select a sprint to move ${selectedTasks.size} selected task${selectedTasks.size > 1 ? 's' : ''} to.`
                      : 'Select a sprint to move the selected task to.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select value={selectedSprintForMove} onValueChange={setSelectedSprintForMove}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {sprints.filter(s => s.status !== 'completed').map((sprint) => (
                        <SelectItem key={sprint.id} value={sprint.id}>
                          {sprint.name} ({sprint.status})
                        </SelectItem>
                      ))}
                      {sprints.filter(s => s.status !== 'completed').length === 0 && (
                        <SelectItem value="" disabled>No active sprints available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowMoveToSprintDialog(false);
                    setSelectedSprintForMove("");
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleMoveToSprint} disabled={!selectedSprintForMove}>
                    Move Task{selectedTasks.size > 1 ? 's' : ''}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Create/Edit Story Dialog */}
            <CreateStoryDialog
              key={`create-story-dialog-${selectedStory?.id || selectedStory?._id || 'new'}-${showCreateStoryDialog || !!selectedStory}`}
              open={showCreateStoryDialog || !!selectedStory}
              onClose={() => {
                setShowCreateStoryDialog(false);
                setSelectedStory(null);
              }}
              projectId={selectedProjectId}
              story={selectedStory}
              sprint={selectedSprint}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['stories', selectedProjectId] });
                setSelectedStory(null);
                setShowCreateStoryDialog(false);
              }}
            />

            {/* Create/Edit Epic Dialog */}
            <CreateEpicDialog
              open={showCreateEpicDialog || !!selectedEpic}
              onClose={() => {
                setShowCreateEpicDialog(false);
                setSelectedEpic(null);
              }}
              projectId={selectedProjectId}
              epic={selectedEpic}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['epics', selectedProjectId] });
                setSelectedEpic(null);
                setShowCreateEpicDialog(false);
              }}
            />

            {/* Epic Detail Dialog */}
            <EpicDetailDialog
              open={!!selectedEpicId}
              onClose={() => setSelectedEpicId(null)}
              epicId={selectedEpicId}
              sprintId={selectedSprintId}
              onEpicUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['epics', selectedProjectId] });
              }}
            />

            {/* Global Delete Confirmation Dialog */}
            <AlertDialog
              open={deleteConfirmation.isOpen}
              onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {deleteConfirmation.item?.type}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{deleteConfirmation.item?.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (deleteConfirmation.mutation) {
                        deleteConfirmation.mutation();
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Tabs>
        </div>
      </div>
    </OnboardingProvider>
  );
}