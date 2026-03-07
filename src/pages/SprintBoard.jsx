import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@/components/shared/UserContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Target, List, Loader2, RefreshCw, Download, ChevronDown, ChevronUp, Eye, CheckSquare, Square, Trash2, BookOpen, Edit, ChevronRight, ListTodo, FolderKanban, Archive, Users } from "lucide-react";
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
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [selectedMemberEmail, setSelectedMemberEmail] = useState("all");
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef(null); // You can keep this even if unused for now

  const taskIdParam = searchParams.get('taskId');
  const projectIdParam = searchParams.get('projectId');
  const sprintIdParam = searchParams.get('sprintId');

  // Deep Link Handling
  React.useEffect(() => {
    if (taskIdParam) setSelectedTaskId(taskIdParam);
    if (projectIdParam && !selectedProjectId) setSelectedProjectId(projectIdParam);
    if (sprintIdParam && !selectedSprintId) setSelectedSprintId(sprintIdParam);
  }, [taskIdParam, projectIdParam, sprintIdParam, selectedProjectId, selectedSprintId]);

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('taskId');
    setSearchParams(newParams, { replace: true });
  };

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

  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
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
  const isCurrentProjectManager = projectRoles.some(r => r.project_id === selectedProjectId);
  const isProjectManager = projectRoles.length > 0;
  const isOwner = currentUser?.custom_role === 'owner';
  const isMemberRole = currentUser?.role === 'member';
  const canSeeMemberFilter = isAdmin || isCurrentProjectManager || isOwner || isViewer || isMemberRole;
  const userRole = isAdmin ? 'admin' : (isProjectManager ? 'project_manager' : 'user');

  // Filter tasks: For team members (not admin, not project manager, not viewer, not member), only show assigned tasks
  const isTeamMember = !isAdmin && !isProjectManager && !isViewer && !isMemberRole;
  const userEmail = currentUser?.email?.toLowerCase();

  // Projects are already filtered at line 62-66 to show projects where user is a team member
  // So we don't need to filter projects again - just use the projects variable directly
  const filteredProjects = projects;

  // Filter tasks: For team members (not admin, not project manager), only show assigned tasks
  // But keep all tasks for admins and project managers
  let filteredTasks = tasks;

  // Apply Member Filter if active
  if (canSeeMemberFilter && selectedMemberEmail && selectedMemberEmail !== "all") {
    filteredTasks = tasks.filter(t => {
      const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
      return taskAssignees.some(assignee => {
        const assigneeVal = (typeof assignee === 'object' && assignee !== null)
          ? (assignee.email || assignee.id || '')
          : String(assignee || '');

        const normalizedAssignee = assigneeVal.toLowerCase().trim();
        const normalizedFilter = selectedMemberEmail.toLowerCase().trim();
        return normalizedAssignee === normalizedFilter;
      });
    });
  }
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

  const canViewMetrics = isAdmin || isCurrentProjectManager;

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getStatusBadge = (status, customClass = "") => {
    const statusConfig = {
      todo: { label: 'TODO', color: 'bg-slate-100/80 text-slate-500 hover:bg-slate-200/80' },
      in_progress: { label: 'ACTIVE', color: 'bg-indigo-50/80 text-indigo-600 hover:bg-indigo-100/80' },
      review: { label: 'REVIEW', color: 'bg-amber-50/80 text-amber-600 hover:bg-amber-100/80' },
      completed: { label: 'DONE', color: 'bg-emerald-50/80 text-emerald-600 hover:bg-emerald-100/80' },
    };
    const config = statusConfig[status] || statusConfig.todo;
    return (
      <Badge variant="secondary" className={cn("border-none font-extrabold text-[9px] px-2.5 py-0.5 rounded-full tracking-wider shadow-none transition-colors", config.color, customClass)}>
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority, customClass = "") => {
    const priorityConfig = {
      low: { label: 'LOW', color: 'bg-slate-100/80 text-slate-500 shadow-none' },
      medium: { label: 'MEDIUM', color: 'bg-indigo-50/80 text-indigo-500 shadow-none' },
      high: { label: 'HIGH', color: 'bg-amber-50/80 text-amber-600 shadow-none' },
      urgent: { label: 'URGENT', color: 'bg-rose-50/80 text-rose-600 shadow-none' },
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <Badge variant="secondary" className={cn("border-none font-extrabold text-[9px] px-2.5 py-0.5 rounded-full tracking-wider", config.color, customClass)}>
        <span className={cn("h-1 w-1 rounded-full mr-1.5",
          priority === 'urgent' ? "bg-rose-500" :
            priority === 'high' ? "bg-amber-500" :
              priority === 'medium' ? "bg-indigo-500" : "bg-slate-400"
        )} />
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

  const getStoryStatusBadge = (status, customClass = "") => {
    const statusConfig = {
      todo: { label: 'TODO', color: 'bg-slate-100/80 text-slate-500' },
      in_progress: { label: 'IN PROGRESS', color: 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/50' },
      in_review: { label: 'IN REVIEW', color: 'bg-rose-50/80 text-rose-600' },
      done: { label: 'DONE', color: 'bg-emerald-50/80 text-emerald-600' },
      blocked: { label: 'BLOCKED', color: 'bg-rose-600 text-white shadow-lg shadow-rose-200/50' },
      cancelled: { label: 'CANCELLED', color: 'bg-slate-500 text-white' },
    };
    const config = statusConfig[status] || statusConfig.todo;
    return (
      <Badge variant="secondary" className={cn("border-none font-extrabold text-[9px] px-3 py-1 rounded-full tracking-[0.05em] transition-all duration-300", config.color, customClass)}>
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
    setSelectedMemberEmail("all");
  };

  const handleManualRefresh = () => {
    refetchTasks();
    refetchSprints();
    toast.success('Refreshed!');
  };

  // === UPDATED: Data-Driven PDF Export ===
  const handleExportSprintReport = async () => {
    if (!selectedSprint) return;
    setIsExporting(true);

    try {
      toast.info('Generating AI Sprint Analysis...');

      // 1. Prepare data for AI
      const tasksForAI = sprintTasks.map(t => {
        // Find the actual name from the users list
        const assigneeVal = typeof t.assigned_to === 'string' ? t.assigned_to : (t.assigned_to?.email || t.assigned_to?.id);
        const user = users.find(u => (u.email?.toLowerCase() === assigneeVal?.toLowerCase()) || (u.id === assigneeVal));
        const resolvedName = user ? (user.full_name || user.name) : (t.assigned_to_name || t.assigned_to || 'Unassigned');

        return {
          task_id: t.id || t._id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          story_points: t.story_points || 0,
          assignee: resolvedName,
          created_date: t.created_date,
          due_date: t.due_date,
          completed_date: t.completed_date,
          estimated_hours: t.estimated_hours || 0,
          actual_hours: t.actual_hours || 0,
          progress_percentage: t.progress || 0
        };
      });

      // 2. Call backend AI service via groonabackend
      const aiReport = await groonabackend.ai.generateSprintReport({
        sprint: selectedSprint,
        tasks: tasksForAI,
        project: selectedProject
      });

      if (aiReport.error) {
        throw new Error(aiReport.error);
      }

      toast.info('Rendering Professional PDF Report...');

      // 3. Generate PDF with AI insights
      const pdfBlob = await generateSprintReportPDF(selectedSprint, sprintTasks, selectedProject, aiReport, users);

      if (pdfBlob) {
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
        a.download = `Sprint_Performance_Report_${selectedProject?.name.replace(/\s+/g, '_')}_${selectedSprint.name.replace(/\s+/g, '_')}_${timestamp}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Sprint report generated and downloaded!');
      }
    } catch (error) {
      console.error('[SprintBoard] AI Export error:', error);
      toast.error(`Failed to export sprint report: ${error.message}`);
    } finally {
      setIsExporting(false);
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
      <Card className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden transition-all duration-500 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
        <CardHeader className="p-6 pb-4 bg-white/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                <IconComponent className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-[17px] font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  {title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-100/80 text-slate-600 border-none text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {storiesList.length} {storiesList.length === 1 ? 'STORY' : 'STORIES'}
                  </Badge>
                  {taskCount > 0 && (
                    <Badge variant="secondary" className="bg-indigo-50/80 text-indigo-600 border-none text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {taskCount} {taskCount === 1 ? 'TASK' : 'TASKS'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {!isViewer && (
              <Button
                onClick={() => setShowCreateTaskDialog(true)}
                className="bg-slate-900 border-0 shadow-lg shadow-slate-200/50 hover:bg-black text-white h-10 rounded-full px-5 font-bold transition-all active:scale-[0.98] text-xs flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create New
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/40 border-y border-slate-100/50">
                  <th className="px-6 py-4 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Title</th>
                  <th className="px-4 py-4 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-4 py-4 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Assignee</th>
                  <th className="px-4 py-4 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Priority</th>
                  <th className="px-4 py-4 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Due Date</th>
                  <th className="px-6 py-4 text-right text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {storiesList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                          <BookOpen className="h-6 w-6 opacity-30" />
                        </div>
                        <p className="text-xs font-bold tracking-tight">No stories in this section</p>
                      </div>
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
                          className={cn(
                            "group transition-all duration-300 cursor-pointer border-l-4",
                            isExpanded ? "bg-slate-50/20 border-indigo-500" : "hover:bg-slate-50/40 border-transparent"
                          )}
                          onClick={() => setSelectedStoryId(storyId)}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-start gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStoryExpansion(storyId);
                                }}
                                className="h-6 w-6 p-0 mt-0.5 bg-white shadow-sm border border-slate-100 rounded-full hover:bg-slate-50 transition-transform active:scale-90"
                              >
                                <ChevronRight className={cn("h-3.5 w-3.5 text-slate-600 transition-transform duration-300", isExpanded && "rotate-90")} />
                              </Button>

                              <div className="flex-1 flex flex-col gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
                                    <BookOpen className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-extrabold text-slate-800 text-[14px] tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">{story.title}</div>
                                    {story.description && (
                                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-1 opacity-70 font-medium">
                                        {truncateDescription(story.description, 12)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {(() => {
                                  const progress = getStoryProgress(storyId);
                                  return progress.total > 0 ? (
                                    <div className="flex items-center gap-3 flex-shrink-0 max-w-[200px]">
                                      <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                                          style={{ width: `${progress.percentage}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] text-slate-500 font-extrabold tracking-tighter w-8">
                                        {progress.percentage}%
                                      </span>
                                    </div>
                                  ) : null;
                                })()}

                                {storyTasks.length > 0 && (
                                  <div className="flex items-center gap-1.5 opacity-60">
                                    <div className="flex -space-x-1.5">
                                      <div className="h-4 w-4 rounded-full bg-slate-200 border border-white" />
                                      <div className="h-4 w-4 rounded-full bg-slate-300 border border-white" />
                                    </div>
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{storyTasks.length} task{storyTasks.length !== 1 ? 's' : ''} linked</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            {isEditingStatus ? (
                              <Select
                                value={story.status}
                                onValueChange={(value) => handleStoryFieldUpdate(storyId, 'status', value)}
                                onOpenChange={(open) => !open && setEditingStoryId(null)}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <SelectTrigger className="w-32 h-8 text-[11px] font-bold rounded-full bg-white shadow-sm border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-slate-200">
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
                              >
                                {getStoryStatusBadge(story.status)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-5">
                            {isEditingAssignee ? (
                              <Select
                                value={storyAssignees[0] || "unassigned"}
                                onValueChange={(value) => {
                                  const newValue = value === "unassigned" ? [] : [value];
                                  handleStoryFieldUpdate(storyId, 'assigned_to', newValue);
                                }}
                                onOpenChange={(open) => !open && setEditingStoryId(null)}
                              >
                                <SelectTrigger className="w-40 h-8 text-[11px] font-bold rounded-full bg-white shadow-sm border-slate-200">
                                  <SelectValue placeholder="Select assignee" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-slate-200">
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
                                className="flex items-center"
                              >
                                {storyAssignees.length > 0 ? (
                                  <div className="flex items-center -space-x-2.5">
                                    {storyAssignees.slice(0, 3).map((email, idx) => {
                                      const user = users.find(u => u.email === email);
                                      const initials = user?.full_name ? getInitials(user.full_name) : getInitials(email?.split('@')[0] || '?');
                                      return (
                                        <Avatar key={email + idx} className="h-8 w-8 border-2 border-white ring-1 ring-slate-100 shadow-sm transition-transform hover:-translate-y-1">
                                          <AvatarImage src={user?.profile_image_url} />
                                          <AvatarFallback className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold">
                                            {initials}
                                          </AvatarFallback>
                                        </Avatar>
                                      );
                                    })}
                                    {storyAssignees.length > 3 && (
                                      <div className="h-8 w-8 rounded-full bg-white border-2 border-white ring-1 ring-slate-100 flex items-center justify-center text-[10px] font-extrabold text-slate-500 shadow-sm">
                                        +{storyAssignees.length - 3}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[18px] text-slate-300">
                                    <Plus className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-5">
                            {isEditingPriority ? (
                              <Select
                                value={story.priority}
                                onValueChange={(value) => handleStoryFieldUpdate(storyId, 'priority', value)}
                                onOpenChange={(open) => !open && setEditingStoryId(null)}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <SelectTrigger className="w-28 h-8 text-[11px] font-bold rounded-full bg-white shadow-sm border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-slate-200">
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
                              >
                                {getPriorityBadge(story.priority)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-5">
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
                                      "w-36 h-8 text-[11px] font-bold rounded-full bg-white shadow-sm border-slate-200 justify-start px-3",
                                      !story.due_date && "text-muted-foreground"
                                    )}
                                  >
                                    <Calendar className="mr-2 h-3 w-3 opacity-50" />
                                    {story.due_date ? format(new Date(story.due_date), 'MMM d, yyyy') : "Set date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200 overflow-hidden" align="start">
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
                                className="flex items-center gap-2 text-[12px] font-bold text-slate-500 whitespace-nowrap"
                              >
                                <Calendar className="h-3.5 w-3.5 opacity-40" />
                                {story.due_date ? format(new Date(story.due_date), 'MMM d, yyyy') : <span className="text-slate-300 uppercase tracking-tighter text-[10px]">No due date</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            {!isViewer && (
                              <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStory(story);
                                  }}
                                  className="h-8 w-8 p-0 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                                  title={selectedSprint?.locked_date ? "Sprint locked" : "Edit Story"}
                                  disabled={!!selectedSprint?.locked_date}
                                >
                                  <Edit className="h-3.5 w-3.5" />
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
                                  className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-100 text-slate-400 hover:text-red-500 transition-all"
                                  title="Delete Story"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                                  className="group/task transition-all duration-300 cursor-pointer bg-slate-50/10 hover:bg-white"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  <td className="px-6 py-4 pl-16">
                                    <div className="flex items-start gap-4">
                                      <div className="h-7 w-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-xs flex-shrink-0 group-hover/task:text-indigo-500 transition-colors">
                                        <ListTodo className="h-3.5 w-3.5" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-bold text-slate-700 text-[13px] tracking-tight group-hover/task:text-slate-900 transition-colors">{task.title}</div>
                                        {task.description && (
                                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-1 font-medium opacity-60">
                                            {truncateDescription(task.description, 10)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    {isEditingTaskStatus ? (
                                      <Select
                                        value={task.status}
                                        onValueChange={(value) => handleFieldUpdate(task.id, 'status', value)}
                                        onOpenChange={(open) => !open && setEditingTaskId(null)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                      >
                                        <SelectTrigger className="w-32 h-7 text-[10px] font-bold rounded-full bg-white shadow-sm border-slate-200">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl shadow-2xl border-slate-200">
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
                                      >
                                        {getStatusBadge(task.status, "text-[9px] px-2 py-0.5")}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-4">
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
                                        <SelectTrigger className="w-40 h-7 text-[10px] font-bold rounded-full bg-white shadow-sm border-slate-200">
                                          <SelectValue placeholder="Select assignee" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl shadow-2xl border-slate-200">
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
                                        className="flex items-center"
                                      >
                                        {assignees.length > 0 ? (
                                          <div className="flex items-center -space-x-2">
                                            {assignees.slice(0, 3).map((email, idx) => {
                                              const user = users.find(u => u.email === email);
                                              const initials = user?.full_name ? getInitials(user.full_name) : getInitials(email?.split('@')[0] || '?');
                                              return (
                                                <Avatar key={email + idx} className="h-6 w-6 border-2 border-white ring-1 ring-slate-100 shadow-sm">
                                                  <AvatarImage src={user?.profile_image_url} />
                                                  <AvatarFallback className="text-[8px] bg-slate-50 text-slate-500 font-extrabold">
                                                    {initials}
                                                  </AvatarFallback>
                                                </Avatar>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div className="h-6 w-6 rounded-full bg-white border border-dashed border-slate-200 flex items-center justify-center text-slate-200 transition-colors group-hover/task:border-indigo-200 group-hover/task:text-indigo-200">
                                            <Plus className="h-2 w-2" />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-4">
                                    {isEditingTaskPriority ? (
                                      <Select
                                        value={task.priority}
                                        onValueChange={(value) => handleFieldUpdate(task.id, 'priority', value)}
                                        onOpenChange={(open) => !open && setEditingTaskId(null)}
                                      >
                                        <SelectTrigger className="w-28 h-7 text-[10px] font-bold rounded-full bg-white shadow-sm border-slate-200">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl shadow-2xl border-slate-200">
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
                                      >
                                        {getPriorityBadge(task.priority, "text-[9px] px-2 py-0.5")}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-4">
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
                                              "w-32 h-7 text-[10px] font-bold rounded-full bg-white shadow-sm border-slate-200 justify-start px-2.5",
                                              !task.due_date && "text-muted-foreground"
                                            )}
                                          >
                                            <Calendar className="mr-1.5 h-2.5 w-2.5 opacity-50" />
                                            {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : "Set date"}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200 overflow-hidden" align="start">
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
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 whitespace-nowrap"
                                      >
                                        <Calendar className="h-3 w-3 opacity-40" />
                                        {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : <span className="text-slate-200 uppercase tracking-tighter text-[9px]">No date</span>}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {!isViewer && (
                                      <div className="flex justify-end gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTaskClick(task.id);
                                          }}
                                          className="h-7 w-7 p-0 rounded-full hover:bg-white text-slate-300 hover:text-indigo-500"
                                          title="Edit Task"
                                        >
                                          <Edit className="h-3 w-3" />
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
                                          className="h-7 w-7 p-0 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500"
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

  if (!currentUser || projectsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fa] w-full">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-5" />
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Crunching your data</h3>
        <p className="text-sm text-slate-500 font-medium animate-pulse mt-1">Loading projects and sprints...</p>
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
      <div className="flex flex-col bg-[#f8f9fa] min-h-screen w-full relative" ref={printRef}>
        <div className="max-w-full mx-auto w-full flex flex-col relative px-4 sm:px-6 lg:px-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Header Section */}
            <div className="sticky top-0 z-30 bg-[#f8f9fa]/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 pt-6 pb-2">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-slate-900 tracking-tight">
                    {isMarketingCompany ? "Campaign Board" : "Sprint Board"}
                  </h1>
                  <div className="flex items-center gap-2">
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
                    <p className="text-sm sm:text-base text-slate-500 font-medium">
                      {isMarketingCompany ? "Manage campaigns and track progress" : "Manage sprints and track progress"}
                    </p>
                    {selectedProject && (
                      <div className="hidden sm:flex items-center gap-2 ml-2">
                        <span className="text-slate-300">•</span>
                        <span className="text-sm text-slate-600 font-medium bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                          {selectedProject.name}
                        </span>
                        {selectedSprint && !isMarketingCompany && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 shadow-sm">
                              {selectedSprint.name}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  {selectedProjectId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualRefresh}
                      className="bg-white border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 h-10 rounded-lg px-4 font-medium transition-all"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${tasksLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                  {selectedSprintId && !isMarketingCompany && (
                    <Button
                      onClick={handleExportSprintReport}
                      variant="outline"
                      size="sm"
                      className="bg-white border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 h-10 rounded-lg px-4 font-medium transition-all"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      {isExporting ? 'Generating...' : 'Export PDF'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Wide Selection Dropdowns - Responsive */}
              {showSelectionSection && (
                <div className="flex flex-col sm:flex-row items-center gap-4 py-4 border-t border-slate-200/60 mt-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex-1 w-full sm:max-w-xs">
                    <div className="group flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg px-3 h-10 w-full transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400">
                      <Target className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                        <SelectTrigger className="h-9 w-full text-sm border-0 shadow-none focus:ring-0 bg-transparent px-1">
                          <SelectValue placeholder={`Select ${isMarketingCompany ? 'Campaign' : 'Project'} *`} />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
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
                  </div>

                  {canSeeMemberFilter && (
                    <div className="flex-1 w-full sm:max-w-xs">
                      <div className="group flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg px-3 h-10 w-full transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400">
                        <Users className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Select value={selectedMemberEmail} onValueChange={setSelectedMemberEmail}>
                          <SelectTrigger className="h-9 w-full text-sm border-0 shadow-none focus:ring-0 bg-transparent px-1">
                            <SelectValue placeholder="Filter by Member" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            <SelectItem value="all">
                              <div className="flex items-center gap-2 font-medium">
                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                  <Users className="h-3.5 w-3.5 text-slate-500" />
                                </div>
                                <span>All Members</span>
                              </div>
                            </SelectItem>
                            {selectedProject?.team_members?.map(member => {
                              const user = users.find(u =>
                                (member.email && u.email === member.email) ||
                                (member.id && u.id === member.id)
                              );
                              const displayName = user?.full_name || member.full_name || member.email || "Unknown Member";
                              const initials = getInitials(displayName);

                              return (
                                <SelectItem key={member.email || member.id} value={member.email || member.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={user?.profile_image_url} />
                                      <AvatarFallback className="text-[8px] bg-blue-100 text-blue-700 font-semibold">
                                        {initials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{displayName}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {!isMarketingCompany && (
                    <>
                      <div className="flex-1 w-full sm:max-w-xs">
                        <div className="group flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg px-3 h-10 w-full transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400">
                          <Calendar className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Select
                            value={selectedSprintId}
                            onValueChange={setSelectedSprintId}
                            disabled={!selectedProjectId}
                          >
                            <SelectTrigger className="h-9 w-full text-sm border-0 shadow-none focus:ring-0 bg-transparent px-1">
                              <SelectValue placeholder={selectedProjectId ? "Select Sprint" : "Select project first"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-80">
                              {sprints.length === 0 ? (
                                <SelectItem value="no-sprints" disabled>No sprints yet</SelectItem>
                              ) : (
                                sprints.map(sprint => (
                                  <SelectItem key={sprint.id} value={sprint.id}>
                                    <div className="flex items-center justify-between gap-2 w-full min-w-[200px]">
                                      <span>{sprint.name}</span>
                                      <Badge variant="outline" className={`ml-auto text-[10px] h-4 ${sprint.status === 'active' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                        {sprint.status}
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {selectedProjectId && !isViewer && (
                        <Button
                          onClick={() => setShowCreateSprint(true)}
                          size="sm"
                          className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-10 rounded-lg px-5 font-bold transition-all active:scale-[0.98] flex-shrink-0"
                        >
                          <Plus className="h-4.5 w-4.5 mr-2" />
                          New Sprint
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tabs Selection Section */}
              {selectedProjectId && selectedSprintId && selectedSprint && !isMarketingCompany && (
                <div className="mt-2 pb-2">
                  <TabsList className="bg-white border border-slate-200 shadow-sm p-1 rounded-xl h-auto flex-wrap gap-1">
                    <TabsTrigger value="board" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Sprint Board</TabsTrigger>
                    <TabsTrigger value="sprint-backlog" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Sprint Backlog</TabsTrigger>
                    <TabsTrigger value="backlog" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Backlog</TabsTrigger>
                    <TabsTrigger value="epics" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Epics</TabsTrigger>
                    {canViewMetrics && <TabsTrigger value="capacity" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Capacity</TabsTrigger>}
                    <TabsTrigger value="burndown" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Burndown</TabsTrigger>
                    {canViewMetrics && <TabsTrigger value="metrics" className="rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-none transition-all border-0 ring-0">Metrics</TabsTrigger>}
                  </TabsList>
                </div>
              )}
            </div>

            {/* Scrollable Content Section */}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 pt-6">
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
                          className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 text-white h-11 rounded-lg px-6 font-bold transition-all active:scale-[0.98]"
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
                    <Card className="bg-white border border-slate-200/60 shadow-sm rounded-xl">
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
                        <Card className="bg-white border border-slate-200/60 shadow-sm rounded-xl">
                          <CardContent className="p-12 text-center">
                            <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Tasks Assigned</h3>
                            <p className="text-slate-600">You don't have any tasks assigned in this sprint.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="bg-white border border-slate-200/60 shadow-sm rounded-xl">
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
                        <Card className="bg-white border border-slate-200/60 shadow-sm rounded-xl">
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
                        <Card className="bg-white border border-slate-200/60 shadow-sm rounded-xl">
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

                    <TabsContent value="epics" className="mt-8">
                      {sprintEpics.length === 0 && isTeamMember ? (
                        <Card className="bg-white border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden">
                          <CardContent className="p-20 text-center bg-white/70 backdrop-blur-xl">
                            <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                              <FolderKanban className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">No Epics Discovered</h3>
                            <p className="text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                              {selectedSprintId
                                ? "There are no epics with stories currently assigned to this sprint."
                                : "There are no epics with unassigned stories at the moment."}
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden group transition-all duration-500 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
                          <CardHeader className="p-8 pb-4 bg-white/40">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-5">
                                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                                  <FolderKanban className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                  <CardTitle className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                                    {selectedSprintId ? 'Sprint Epics' : 'Project Epics'}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-slate-100/80 text-slate-600 border-none text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest">
                                      {sprintEpics.length} {sprintEpics.length === 1 ? 'EPIC' : 'EPICS'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/40 border-y border-slate-100/50">
                                    <th className="px-8 py-5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Name</th>
                                    <th className="px-4 py-5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-4 py-5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Priority</th>
                                    <th className="px-4 py-5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Progress</th>
                                    <th className="px-4 py-5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Stories</th>
                                    <th className="px-4 py-5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Due Date</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/50">
                                  {sprintEpics.length === 0 ? (
                                    <tr>
                                      <td colSpan="7" className="px-8 py-20 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                          <FolderKanban className="h-10 w-10" />
                                          <p className="text-xs font-bold uppercase tracking-widest">No data available</p>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    sprintEpics.map((epic) => {
                                      const epicId = epic.id || epic._id;
                                      const progress = getEpicProgress(epicId);
                                      const epicStories = stories.filter(s => {
                                        const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
                                        if (String(storyEpicId) !== String(epicId)) return false;

                                        if (selectedSprintId) {
                                          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
                                          if (!storySprintId) return true;
                                          return String(storySprintId) === String(selectedSprintId);
                                        } else {
                                          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
                                          return !storySprintId;
                                        }
                                      });

                                      return (
                                        <tr
                                          key={epicId}
                                          className="group/row transition-all duration-300 cursor-pointer hover:bg-slate-50/40 border-l-4 border-transparent hover:border-indigo-500"
                                          onClick={() => setSelectedEpicId(epicId)}
                                        >
                                          <td className="px-8 py-6">
                                            <div className="flex items-start gap-5">
                                              <div
                                                className="w-1.5 h-12 rounded-full flex-shrink-0 mt-0.5 shadow-sm"
                                                style={{ backgroundColor: epic.color || "#6366f1" }}
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="font-extrabold text-slate-800 text-[15px] tracking-tight group-hover/row:text-indigo-600 transition-colors">{epic.name}</div>
                                                {epic.description && (
                                                  <div className="text-[11px] text-slate-500 mt-1.5 line-clamp-1 opacity-70 font-medium leading-relaxed">
                                                    {truncateDescription(epic.description, 18)}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-6">
                                            {getEpicStatusBadge(epic.status)}
                                          </td>
                                          <td className="px-4 py-6">
                                            {getPriorityBadge(epic.priority)}
                                          </td>
                                          <td className="px-4 py-6">
                                            {progress.total > 0 ? (
                                              <div className="flex items-center gap-4 min-w-[140px]">
                                                <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                                  <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${progress.percentage}%` }}
                                                  />
                                                </div>
                                                <span className="text-[11px] text-slate-500 font-extrabold tracking-tight w-8">
                                                  {progress.percentage}%
                                                </span>
                                              </div>
                                            ) : (
                                              <Badge variant="secondary" className="bg-slate-50 text-slate-300 border-none text-[9px] font-bold px-2 rounded-full uppercase tracking-tighter">
                                                No Stories
                                              </Badge>
                                            )}
                                          </td>
                                          <td className="px-4 py-6">
                                            <Badge variant="secondary" className="bg-indigo-50/50 text-indigo-600 border-none text-[11px] font-extrabold px-3 py-1 rounded-full shadow-xs">
                                              {epicStories.length} {epicStories.length === 1 ? 'STORY' : 'STORIES'}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-6">
                                            {epic.due_date ? (
                                              <div className="flex items-center gap-2 text-[12px] font-bold text-slate-500 whitespace-nowrap">
                                                <Calendar className="h-3.5 w-3.5 opacity-40 shadow-none" />
                                                <span>{format(new Date(epic.due_date), 'MMM d, yyyy')}</span>
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-tighter italic">Pending</span>
                                            )}
                                          </td>
                                          <td className="px-8 py-6 text-right">
                                            {!isViewer && (
                                              <div className="flex justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEpic(epic);
                                                    setShowCreateEpicDialog(true);
                                                  }}
                                                  className="h-9 w-9 p-0 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
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
                                                  className="h-9 w-9 p-0 rounded-full hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-100 text-slate-400 hover:text-red-500 transition-all"
                                                  title="Delete Epic"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
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

            {
              !isMarketingCompany && (
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
              )
            }

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
            {
              (selectedTaskId || taskIdParam) && (
                <TaskDetailDialog
                  open={!!selectedTaskId || !!taskIdParam}
                  onClose={handleCloseTaskDetail}
                  taskId={selectedTaskId || taskIdParam}
                  key="global-task-dialog-sprintboard"
                />
              )
            }

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
          </Tabs >
        </div >
      </div >
    </OnboardingProvider >
  );
}

