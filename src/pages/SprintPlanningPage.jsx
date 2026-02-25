import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext } from "@hello-pangea/dnd";
import { groonabackend } from "@/api/groonabackend";
import { useSearchParams, useLocation } from "react-router-dom";
import SprintSummary from "@/components/sprint/SprintSummary";
import BacklogPanel from "@/components/sprint/BacklogPanel";
import SprintBacklogPanel from "@/components/sprint/SprintBacklogPanel";
import WorkloadView from "@/components/sprint/WorkloadView";
import ChangeLogView from "@/components/sprint/ChangeLogView";
import SprintSnapshotView from "@/components/sprint/SprintSnapshotView";
import DailyStandupView from "@/components/sprint/DailyStandupView";
import VelocityTracker from "@/components/sprint/VelocityTracker";
import ImpedimentTracker from "@/components/sprint/ImpedimentTracker";
import SprintBurndown from "@/components/sprint/SprintBurndown";
import SprintMetrics from "@/components/sprint/SprintMetrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, AlertCircle, Users, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfWeek, endOfWeek, parseISO, isWithinInterval, format, differenceInBusinessDays, addDays, isValid } from "date-fns";

export default function SprintPlanningPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const sprintId = searchParams.get("sprintId");
  const projectId = searchParams.get("projectId");
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Dialog State for Change Requests
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", description: "" });

  useEffect(() => {
    groonabackend.auth.me()
      .then(user => {
        setCurrentUser(user);
        setIsUserLoading(false);
      })
      .catch(() => {
        setIsUserLoading(false);
      });
  }, []);

  // --- QUERIES ---

  const { data: sprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprint', sprintId, projectId],
    queryFn: async () => {
      try {
        const directResults = await groonabackend.entities.Sprint.filter({ id: sprintId });
        if (directResults && directResults.length > 0) return directResults[0];
      } catch (e) { console.warn("Direct fetch failed", e); }

      if (projectId) {
        const projectSprints = await groonabackend.entities.Sprint.filter({ project_id: projectId });
        const found = projectSprints.find(s => s.id == sprintId);
        if (found) return found;
      }
      return null;
    },
    initialData: location.state?.sprint,
    staleTime: location.state?.sprint ? 5 * 60 * 1000 : 0,
    enabled: !!sprintId
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await groonabackend.entities.Project.filter({ id: projectId });
      return projects[0] || null;
    },
    enabled: !!projectId
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => groonabackend.entities.Task.filter({ project_id: projectId }),
    enabled: !!projectId,
    refetchInterval: 3000,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => groonabackend.entities.Story.filter({ project_id: projectId }),
    enabled: !!projectId,
    refetchInterval: 3000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  // Fetch leaves for this week - with refetching for real-time updates
  const { data: allLeaves = [], isLoading: leavesLoading, refetch: refetchLeaves } = useQuery({
    queryKey: ['leaves', effectiveTenantId],
    queryFn: async () => {
      try {
        // Fetch all leaves for the tenant first, then filter by status
        // This ensures we get all data even if the API filter doesn't work correctly
        const allTenantLeaves = await groonabackend.entities.Leave.filter({
          tenant_id: effectiveTenantId
        });

        // Filter to only approved leaves
        const approvedLeaves = (allTenantLeaves || []).filter(leave =>
          leave.status === 'approved'
        );

        return approvedLeaves;
      } catch (error) {
        console.error('Error fetching leaves:', error);
        return [];
      }
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to ensure fresh data
  });

  const { data: changeLogs = [] } = useQuery({
    queryKey: ['changeLogs', sprintId],
    queryFn: () => groonabackend.entities.ChangeLog.filter({ sprint_id: sprintId }, '-timestamp'),
    enabled: !!sprintId && sprint?.status !== 'draft'
  });

  // Fetch Tasks marked as 'Scope Change' for this sprint
  const { data: changeRequests = [] } = useQuery({
    queryKey: ['changeRequests', sprintId],
    queryFn: async () => {
      const sprintTasks = await groonabackend.entities.Task.filter({ sprint_id: sprintId, project_id: projectId });
      return sprintTasks.filter(t => t.labels && t.labels.includes('Scope Change'));
    },
    enabled: !!sprintId
  });

  const { data: projectSprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => groonabackend.entities.Sprint.filter({ project_id: projectId }, '-start_date'),
    enabled: !!projectId,
  });

  // --- HELPERS ---

  // Get stories assigned to this sprint
  const sprintStories = stories.filter(s => {
    const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
    return String(storySprintId) === String(sprintId);
  });

  // Pre-calculate set of story ids in this sprint
  const sprintStoryIds = useMemo(() => {
    return new Set(sprintStories.map(s => s.id || s._id).map(String));
  }, [sprintStories]);

  const sprintTasks = useMemo(() => {
    if (!sprint || !tasks) return [];
    return tasks.filter(t => {
      // 1. Explicitly assigned to this sprint
      const taskSprintId = t.sprint_id?.id || t.sprint_id?._id || t.sprint_id;
      if (String(taskSprintId) === String(sprintId)) return true;

      // 2. Implicitly assigned via Story
      const storyId = t.story_id?.id || t.story_id?._id || t.story_id;
      if (storyId && sprintStoryIds.has(String(storyId))) {
        // If Sprint is NOT locked, include it
        if (!sprint.locked_date) return true;

        // If Sprint IS locked, only include if task was created BEFORE lock
        const created = new Date(t.created_date);
        const locked = new Date(sprint.locked_date);
        if (isValid(created) && isValid(locked) && created < locked) {
          return true;
        }
        // Otherwise (created after lock), it does NOT join the sprint automatically
        return false;
      }
      return false;
    });
  }, [tasks, sprintId, sprint, sprintStoryIds]);

  const backlogTasks = useMemo(() => {
    if (!tasks) return [];
    // Exclude tasks that are in the sprint (sprintTasks)
    // And also generally ensure they aren't in some OTHER sprint
    const sprintTaskIds = new Set(sprintTasks.map(t => t.id));

    return tasks.filter(t => {
      if (sprintTaskIds.has(t.id)) return false; // Already in sprint column

      // Check if assigned to ANY OTHER sprint
      const taskSprintId = t.sprint_id?.id || t.sprint_id?._id || t.sprint_id;
      if (taskSprintId && taskSprintId !== 'null' && taskSprintId !== '') return false;

      return true;
    });
  }, [tasks, sprintTasks]);

  const projectTeamMembers = useMemo(() => {
    if (!project?.team_members?.length) {
      // If no members defined, only show current user if they are not client
      return currentUser && currentUser.custom_role !== 'client' ? [currentUser] : [];
    }
    const memberEmails = project.team_members.map(m => m.email);
    return users.filter(u => memberEmails.includes(u.email) && u.custom_role !== 'client');
  }, [project, users, currentUser]);

  // Calculate sprint capacity in story points
  // Capacity = (business days - leave days) * hours per day * team members
  // Convert hours to story points using standard conversion (1 point = 2 hours)
  const sprintCapacity = useMemo(() => {
    if (!sprint?.start_date || !sprint?.end_date || !projectTeamMembers.length) {
      return 0;
    }

    try {
      const sprintStart = parseISO(sprint.start_date);
      const sprintEnd = parseISO(sprint.end_date);

      if (!isValid(sprintStart) || !isValid(sprintEnd)) {
        return 0;
      }

      const businessDays = differenceInBusinessDays(addDays(sprintEnd, 1), sprintStart);

      let totalCapacityHours = 0;

      projectTeamMembers.forEach(member => {
        const userEmail = member.email;
        const userLeaves = allLeaves.filter(l => l.user_email === userEmail);

        let leaveDays = 0;
        userLeaves.forEach(leave => {
          if (!leave.start_date || !leave.end_date) return;

          try {
            const lStart = parseISO(leave.start_date);
            const lEnd = parseISO(leave.end_date);

            if (!isValid(lStart) || !isValid(lEnd)) return;

            // Calculate intersection with sprint dates
            const start = lStart > sprintStart ? lStart : sprintStart;
            const end = lEnd < sprintEnd ? lEnd : sprintEnd;

            if (start <= end) {
              const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
              leaveDays += days;
            }
          } catch (error) {
            console.warn('Error calculating leave days:', error);
          }
        });

        const effectiveDays = Math.max(0, businessDays - leaveDays);
        // Use capacity override if available, otherwise default to 8 hours per day
        const hoursPerDay = sprint.capacity_override?.[userEmail] !== undefined
          ? sprint.capacity_override[userEmail]
          : 8;
        totalCapacityHours += effectiveDays * hoursPerDay;
      });

      // Convert hours to story points (1 point = 2 hours)
      // This matches the conversion used in CreateStoryDialog
      return Math.round(totalCapacityHours / 2);
    } catch (error) {
      console.error('Error calculating sprint capacity:', error);
      return 0;
    }
  }, [sprint, projectTeamMembers, allLeaves]);

  // Calculate this week's date range
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  // Get team members unavailable this week (on leave) - improved logic
  const unavailableThisWeek = useMemo(() => {
    if (!projectTeamMembers.length) return [];
    if (!allLeaves || allLeaves.length === 0) return [];

    const unavailable = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    projectTeamMembers.forEach(member => {
      const memberEmail = member.email?.toLowerCase();
      if (!memberEmail) return;

      const memberLeaves = allLeaves.filter(leave => {
        // Check email field (case-insensitive)
        const leaveEmail = (leave.user_email || '').toLowerCase().trim();
        if (!leaveEmail || leaveEmail !== memberEmail) return false;

        // Parse dates safely - handle both date and datetime formats
        if (!leave.start_date || !leave.end_date) return false;

        try {
          // Parse dates - handle ISO date strings
          let leaveStart = typeof leave.start_date === 'string'
            ? parseISO(leave.start_date.split('T')[0]) // Extract date part if datetime
            : new Date(leave.start_date);
          let leaveEnd = typeof leave.end_date === 'string'
            ? parseISO(leave.end_date.split('T')[0]) // Extract date part if datetime
            : new Date(leave.end_date);

          // Validate dates
          if (isNaN(leaveStart.getTime()) || isNaN(leaveEnd.getTime())) {
            return false;
          }

          // Set time to start/end of day for accurate comparison
          leaveStart.setHours(0, 0, 0, 0);
          leaveEnd.setHours(23, 59, 59, 999);

          // Get week boundaries
          const weekStart = new Date(thisWeekStart);
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(thisWeekEnd);
          weekEnd.setHours(23, 59, 59, 999);

          // Check if leave overlaps with this week
          // Leave overlaps if it starts before week ends AND ends after week starts
          return (leaveStart <= weekEnd && leaveEnd >= weekStart);
        } catch (error) {
          console.warn('Error parsing leave dates:', error, leave);
          return false;
        }
      });

      if (memberLeaves.length > 0) {
        unavailable.push({ member, leaves: memberLeaves });
      }
    });

    return unavailable;
  }, [allLeaves, projectTeamMembers, thisWeekStart, thisWeekEnd]);

  // --- MUTATIONS ---

  const updateSprintMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Sprint.update(sprintId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
    onError: (error) => toast.error(`Failed to update sprint: ${error.message}`)
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (error) => toast.error(`Failed to update task: ${error.message}`)
  });

  const logChangeMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.ChangeLog.create({
      ...data,
      tenant_id: currentUser?.tenant_id,
      sprint_id: sprintId,
      user_email: currentUser?.email,
      user_name: currentUser?.full_name,
      timestamp: new Date().toISOString()
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changeLogs', sprintId] })
  });

  const addImpedimentMutation = useMutation({
    mutationFn: async (impediment) => {
      const newImpediments = [...(sprint.impediments || []), {
        ...impediment,
        id: Date.now().toString(),
        created_date: new Date().toISOString(),
        reported_by: currentUser?.email
      }];
      return groonabackend.entities.Sprint.update(sprintId, { impediments: newImpediments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId, projectId] });
      toast.success('Impediment reported');
    }
  });

  const updateImpedimentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updatedImpediments = (sprint.impediments || []).map(imp =>
        imp.id === id ? { ...imp, ...data } : imp
      );
      return groonabackend.entities.Sprint.update(sprintId, { impediments: updatedImpediments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId, projectId] });
      toast.success('Impediment updated');
    }
  });

  const deleteImpedimentMutation = useMutation({
    mutationFn: async (id) => {
      const updatedImpediments = (sprint.impediments || []).filter(imp => imp.id !== id);
      return groonabackend.entities.Sprint.update(sprintId, { impediments: updatedImpediments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId, projectId] });
      toast.success('Impediment deleted');
    }
  });

  // Mutation to Create Change Request Task
  const createChangeRequestMutation = useMutation({
    mutationFn: async (data) => {
      return await groonabackend.entities.Task.create({
        tenant_id: currentUser?.tenant_id,
        project_id: projectId,
        sprint_id: sprintId,
        title: `Change Request: ${data.title}`,
        description: data.description,
        task_type: 'story',
        status: 'todo', // Admin can move to done
        priority: 'high',
        labels: ['Scope Change'], // Tagging it
        reporter: currentUser?.email,
        assigned_to: [] // Unassigned initially
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['changeRequests', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success("Request submitted successfully");
      setShowRequestDialog(false);
      setRequestForm({ title: "", description: "" });

      // Log the creation
      if (sprint.status !== 'draft') {
        logChangeMutation.mutate({
          change_type: 'added',
          item_type: 'request',
          item_id: data.id,
          item_name: data.title,
          details: 'New Scope Change Request Submitted'
        });
      }
    },
    onError: (err) => toast.error("Failed to submit request: " + err.message)
  });

  // UPDATED: Mutation to Update Request Status (Approve/Reject/etc)
  const updateRequestStatusMutation = useMutation({
    mutationFn: async ({ requestId, status, requestTitle }) => {
      // Determine labels based on status
      let labels = ['Scope Change'];
      if (status === 'in_progress') labels.push('Approved');
      if (status === 'completed') labels.push('Implemented');

      return await groonabackend.entities.Task.update(requestId, {
        status: status,
        labels: labels
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['changeRequests', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });

      const { status, requestTitle } = variables;
      const statusLabel = status === 'in_progress' ? 'Approved (In Progress)' :
        status === 'completed' ? 'Completed' :
          status === 'todo' ? 'Re-opened' : status;

      // Log the status change to history so it appears in ChangeLogView
      logChangeMutation.mutate({
        change_type: 'status_change',
        item_type: 'request',
        item_id: data.id,
        item_name: requestTitle || data.title,
        details: `Request status updated to: ${statusLabel}`
      });

      toast.success(`Request marked as ${statusLabel}`);
    },
    onError: (err) => toast.error("Failed to update request: " + err.message)
  });

  // --- HANDLERS ---

  const handleDragEnd = (result) => {
    // Disable drag and drop if sprint is locked (scope locked)
    if (sprint?.locked_date) {
      return;
    }

    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const task = tasks.find(t => String(t.id) === String(draggableId));
    if (!task) return;

    const isAdding = source.droppableId === 'backlog' && destination.droppableId === String(sprintId);
    const isRemoving = source.droppableId === String(sprintId) && destination.droppableId === 'backlog';

    let newSprintId = task.sprint_id;
    if (isAdding) newSprintId = sprintId;
    if (isRemoving) newSprintId = null;

    updateTaskMutation.mutate({ id: task.id, data: { sprint_id: newSprintId } });

    if (sprint.status !== 'draft') {
      if (isAdding) {
        logChangeMutation.mutate({ change_type: 'added', item_type: 'task', item_id: task.id, item_name: task.title, details: `Added to sprint` });
      } else if (isRemoving) {
        logChangeMutation.mutate({ change_type: 'removed', item_type: 'task', item_id: task.id, item_name: task.title, details: `Removed from sprint` });
      }
    }
  };

  const handleLockSprint = () => {
    // Calculate committed points from stories in the sprint (Story = Commitment to value)
    const sprintStories = stories.filter(s => {
      const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
      return String(storySprintId) === String(sprintId);
    });
    const totalPoints = sprintStories.reduce((acc, s) => acc + (s.story_points || 0), 0);
    updateSprintMutation.mutate(
      { status: 'planned', locked_date: new Date().toISOString(), committed_points: totalPoints },
      { onSuccess: () => toast.success('Sprint Scope Locked Successfully') }
    );
  };

  const handleStartSprint = () => {
    updateSprintMutation.mutate(
      { status: 'active' },
      { onSuccess: () => toast.success('Sprint Started! Good luck team.') }
    );
  };

  const handleSubmitRequest = () => {
    if (!requestForm.title || !requestForm.description) {
      toast.error("Please fill in title and description");
      return;
    }
    createChangeRequestMutation.mutate(requestForm);
  };

  if (sprintLoading || tasksLoading || isUserLoading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-slate-200 p-4 shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 p-6 grid grid-cols-2 gap-6 overflow-hidden">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-slate-200 max-w-md mx-auto">
          <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Sprint Not Found</h3>
          <Button onClick={() => window.history.back()} variant="outline">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <SprintSummary
        sprint={sprint}
        totalPoints={sprintStories.reduce((acc, s) => acc + (Number(s.story_points) || 0), 0)}
        capacity={sprintCapacity}
        onUpdate={(data) => updateSprintMutation.mutate(data)}
        onLock={handleLockSprint}
        onStart={handleStartSprint}
        onExport={() => document.getElementById('snapshot-tab')?.click()}
        onBack={() => window.history.back()}
        isUpdating={updateSprintMutation.isPending}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue={searchParams.get("tab") || "planning"} className="h-full flex flex-col">
          <div className="bg-white border-b border-slate-200 px-4 overflow-x-auto shrink-0">
            <TabsList className="inline-flex">
              <TabsTrigger value="planning">Planning</TabsTrigger>
              <TabsTrigger value="standup">Standup</TabsTrigger>
              {/* Hide Team Availability for viewer only */}
              {currentUser && currentUser.custom_role !== 'viewer' && (
                <TabsTrigger value="availability">Team Availability</TabsTrigger>
              )}
              <TabsTrigger value="burndown">Burndown</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="velocity">Velocity</TabsTrigger>
              <TabsTrigger value="blockers">Blockers</TabsTrigger>
              {/* Hide Workload, Changes, and Snapshot for viewer only */}
              {currentUser && currentUser.custom_role !== 'viewer' && (
                <>
                  <TabsTrigger value="workload">Workload</TabsTrigger>
                  <TabsTrigger value="changes" disabled={sprint.status === 'draft'}>Changes</TabsTrigger>
                  <TabsTrigger value="snapshot" id="snapshot-tab" disabled={sprint.status === 'draft'}>Snapshot</TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <TabsContent value="planning" className="flex-1 mt-0 h-full overflow-hidden">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-2 h-full min-h-0">
                <BacklogPanel
                  tasks={backlogTasks}
                  onUpdate={(id, data) => {
                    const updates = { ...data };
                    if (data.status) {
                      if (data.status === 'completed') {
                        updates.completed_date = new Date().toISOString();
                      } else {
                        updates.completed_date = null;
                      }
                    }
                    updateTaskMutation.mutate({ id, data: updates })
                  }}
                  onDelete={(id) => updateTaskMutation.mutate({ id, data: { sprint_id: null } })}
                  isLocked={!!sprint?.locked_date}
                />
                <SprintBacklogPanel
                  tasks={sprintTasks}
                  sprint={sprint}
                  onUpdate={(id, data) => {
                    const updates = { ...data };
                    if (data.status) {
                      if (data.status === 'completed') {
                        updates.completed_date = new Date().toISOString();
                      } else {
                        updates.completed_date = null;
                      }
                    }
                    updateTaskMutation.mutate({ id, data: updates })
                  }}
                  onDelete={(id) => updateTaskMutation.mutate({ id, data: { sprint_id: null } })}
                  onRemoveFromSprint={(taskId) => {
                    const task = tasks.find(t => t.id === taskId);
                    updateTaskMutation.mutate({ id: taskId, data: { sprint_id: null } });
                    if (sprint.status !== 'draft') {
                      logChangeMutation.mutate({ change_type: 'removed', item_type: 'task', item_id: task.id, item_name: task.title, details: `Removed from sprint` });
                    }
                  }}
                  isLocked={!!sprint?.locked_date}
                />
              </div>
            </DragDropContext>
          </TabsContent>

          <TabsContent value="standup" className="p-6 overflow-y-auto"><DailyStandupView sprint={sprint} tasks={sprintTasks} /></TabsContent>

          {/* Hide Team Availability content for viewer only */}
          {currentUser && currentUser.custom_role !== 'viewer' && (
            <TabsContent value="availability" className="p-6 overflow-y-auto">
              <Card className="bg-white border-blue-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Team Availability - This Week
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchLeaves()}
                      disabled={leavesLoading}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${leavesLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {leavesLoading ? (
                    <div className="text-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                      <p className="text-sm text-slate-600">Loading team availability...</p>
                    </div>
                  ) : unavailableThisWeek.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">All Team Members Available</p>
                      <p className="text-sm text-slate-600">No team members are on leave this week.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600 mb-4">
                        {unavailableThisWeek.length} team member{unavailableThisWeek.length !== 1 ? 's' : ''} {unavailableThisWeek.length !== 1 ? 'are' : 'is'} unavailable this week:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {unavailableThisWeek.map(({ member, leaves }) => (
                          <Card key={member.email} className="bg-white border-blue-200">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-12 w-12 flex-shrink-0">
                                  <AvatarImage src={member.profile_image_url} />
                                  <AvatarFallback className="bg-blue-100 text-blue-700">
                                    {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || member.email.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-900 mb-1">
                                    {member.full_name || member.email}
                                  </p>
                                  <p className="text-xs text-slate-600 mb-3">{member.email}</p>
                                  <div className="space-y-2">
                                    {leaves.map((leave, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                        <div className="flex items-center gap-2 flex-1">
                                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            {format(parseISO(leave.start_date), 'MMM d')} - {format(parseISO(leave.end_date), 'MMM d')}
                                          </Badge>
                                          {leave.duration === 'half_day' && (
                                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                                              Half Day
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    {leaves[0]?.leave_type_name && (
                                      <p className="text-xs text-slate-600 mt-1 ml-6">
                                        {leaves[0].leave_type_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="burndown" className="p-6 overflow-y-auto"><SprintBurndown sprint={sprint} tasks={sprintTasks} /></TabsContent>

          <TabsContent value="metrics" className="p-6 overflow-y-auto">
            <SprintMetrics
              sprint={sprint}
              tasks={sprintTasks}
              projectId={projectId}
              hideAI={currentUser?.custom_role === 'client'}
              currentUser={currentUser}
            />
          </TabsContent>

          <TabsContent value="velocity" className="p-6 overflow-y-auto"><VelocityTracker sprints={projectSprints} allStories={stories} allTasks={tasks} sprintId={sprintId} /></TabsContent>
          <TabsContent value="blockers" className="p-6 overflow-y-auto">
            <ImpedimentTracker
              sprint={sprint}
              projectId={projectId}
              impediments={sprint?.impediments || []}
              highlightImpedimentId={searchParams.get("impedimentId")}
            />
          </TabsContent>

          {/* Hide Workload, Changes, and Snapshot content for viewer only */}
          {currentUser && currentUser.custom_role !== 'viewer' && (
            <>
              <TabsContent value="workload" className="p-6 overflow-y-auto">
                <WorkloadView
                  sprintTasks={sprintTasks}
                  teamMembers={projectTeamMembers}
                  sprint={sprint}
                  stories={stories}
                  allLeaves={allLeaves}
                />
              </TabsContent>

              <TabsContent value="changes" className="p-6 overflow-y-auto">
                <ChangeLogView
                  logs={changeLogs}
                  requests={changeRequests}
                  isLocked={!!sprint.locked_date}
                  onRequestChange={() => setShowRequestDialog(true)}
                  currentUser={currentUser}
                  onUpdateStatus={(requestId, status, title) =>
                    updateRequestStatusMutation.mutate({ requestId, status, requestTitle: title })
                  }
                />
              </TabsContent>

              <TabsContent value="snapshot" className="p-6 overflow-y-auto"><SprintSnapshotView sprint={sprint} tasks={sprintTasks} users={users} /></TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Change Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Change</DialogTitle>
            <DialogDescription>
              Submit a request for changes in this locked sprint. The team will review and update the status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Request Title</Label>
              <Input
                placeholder="e.g. Update button color, Change text copy..."
                value={requestForm.title}
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea
                placeholder="Describe the required changes..."
                rows={4}
                value={requestForm.description}
                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={createChangeRequestMutation.isPending}>
              {createChangeRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

