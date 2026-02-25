import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  Play,
  Pause as PauseIcon,
  Square,
  MapPin,
  Settings,
  Flag,
  AlertCircle,
  RefreshCw,
  Projector,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClockInOutTimer({
  currentUser,
  effectiveTenantId,
  onTimesheetCreated
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalPausedSeconds, setTotalPausedSeconds] = useState(0);
  const [activeClockEntry, setActiveClockEntry] = useState(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedStory, setSelectedStory] = useState("");
  const [selectedSprint, setSelectedSprint] = useState(""); // Auto-set
  const [selectedTask, setSelectedTask] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [selectedWorkType, setSelectedWorkType] = useState("development");
  const [workDescription, setWorkDescription] = useState("");
  const [remark, setRemark] = useState("");
  const [location, setLocation] = useState(null);
  const queryClient = useQueryClient();

  // Check for existing active clock entry on mount
  const { data: existingClockEntry } = useQuery({
    queryKey: ['active-clock-entry', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const entries = await groonabackend.entities.ClockEntry.filter({
        user_email: currentUser.email,
        is_clocked_in: true
      });
      return entries[0] || null;
    },
    enabled: !!currentUser,
  });

  // Restore active session if found
  useEffect(() => {
    if (existingClockEntry && !activeClockEntry) {
      console.log('[ClockInOutTimer] Restoring active session:', existingClockEntry);
      setActiveClockEntry(existingClockEntry);
      setIsRunning(true);
      setIsPaused(existingClockEntry.is_paused || false);

      const pausedSeconds = existingClockEntry.total_paused_seconds || 0;
      setTotalPausedSeconds(pausedSeconds);

      // Restore project/sprint/task selections
      if (existingClockEntry.project_id) {
        setSelectedProject(existingClockEntry.project_id);
      }
      if (existingClockEntry.story_id) {
        setSelectedStory(existingClockEntry.story_id);
      }
      if (existingClockEntry.sprint_id) {
        setSelectedSprint(existingClockEntry.sprint_id);
      }
      if (existingClockEntry.task_id) {
        setSelectedTask(existingClockEntry.task_id);
      }
      if (existingClockEntry.milestone_id) {
        setSelectedMilestone(existingClockEntry.milestone_id);
      }
      if (existingClockEntry.description) {
        setWorkDescription(existingClockEntry.description);
      }
      if (existingClockEntry.work_type) {
        setSelectedWorkType(existingClockEntry.work_type);
      }

      const startTime = new Date(existingClockEntry.clock_in_time);
      let totalElapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);

      // If currently paused, we should account for the time since last_paused_at
      if (existingClockEntry.is_paused && existingClockEntry.last_paused_at) {
        const currentPauseDuration = Math.floor((Date.now() - new Date(existingClockEntry.last_paused_at).getTime()) / 1000);
        totalElapsed -= (pausedSeconds + currentPauseDuration);
      } else {
        totalElapsed -= pausedSeconds;
      }

      setElapsedSeconds(Math.max(0, totalElapsed));

      toast.info('Resumed active timer from previous session');
    }
  }, [existingClockEntry]);

  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';

  // Centralized Work Hierarchy Fetch
  const { data: hierarchy = { projects: [], stories: [], tasks: [] }, isLoading: hierarchyLoading } = useQuery({
    queryKey: ['user-work-hierarchy', currentUser?.email, effectiveTenantId],
    queryFn: () => groonabackend.functions.invoke('getUserWorkHierarchy', {
      userEmail: currentUser.email,
      userId: currentUser?.id,
      tenantId: effectiveTenantId,
      isAdmin,
      isOwner: currentUser?.custom_role === 'owner',
      isProjectManager: currentUser?.custom_role === 'project_manager'
    }),
    enabled: !!currentUser?.email && !!effectiveTenantId,
  });

  const { projects = [], stories: rawStories = [], tasks: myAssignedTasks = [] } = hierarchy;

  const myProjectIds = React.useMemo(() => {
    return new Set(projects.map(p => p.id));
  }, [projects]);

  // Fetch existing timesheets to prevent duplicate logging
  const { data: existingTimesheets = [] } = useQuery({
    queryKey: ['timesheet-duplicates', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return groonabackend.entities.Timesheet.filter({ user_email: currentUser.email });
    },
    enabled: !!currentUser?.email,
  });

  // Fetch notifications to check for timesheet alerts/alarms
  const { data: notifications = [] } = useQuery({
    queryKey: ['timesheet-enforcement-check', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return groonabackend.entities.Notification.filter({
        recipient_email: currentUser.email,
        status: 'OPEN'
      });
    },
    enabled: !!currentUser?.email,
  });

  const hasTimesheetAlert = (notifications || []).some(n =>
    (n.status === 'OPEN' || n.status === 'APPEALED') && (
      n.type === 'timesheet_missing_alert' ||
      n.type === 'timesheet_missing_alarm' ||
      n.type === 'task_delay_alarm' ||
      n.type === 'timesheet_incomplete_alert'
    )
  );

  const submittedTaskIds = React.useMemo(() => new Set(
    existingTimesheets
      .filter(t => t.status !== 'rejected')
      .map(t => t.task_id)
      .filter(Boolean)
  ), [existingTimesheets]);

  // Raw Tasks and Stories are now provided by the hierarchy query
  const rawTasks = myAssignedTasks;

  // Filtered Tasks
  const tasks = React.useMemo(() => {
    if (!rawTasks) return [];
    return rawTasks.filter(task => {
      // 1. Assignment Check
      const assigneeEmail = (task.assignee_id?.email || task.assignee_email || task.assignee || '').toLowerCase().trim();
      const targetEmail = currentUser?.email?.toLowerCase().trim();
      if (!targetEmail || assigneeEmail !== targetEmail) return false;

      // 2. Project Filter
      const pId = task.project_id?.id || task.project_id?._id || task.project_id;
      if (selectedProject && String(pId) !== String(selectedProject)) return false;

      // 3. Story Filter
      const sId = task.story_id?.id || task.story_id?._id || task.story_id;
      if (selectedStory) {
        if (String(sId) !== String(selectedStory)) return false;
      } else {
        // If "No Story" selected, only show tasks with no story
        if (sId) return false;
      }

      return true;
    });
  }, [rawTasks, currentUser, selectedProject, selectedStory, submittedTaskIds]);

  // Fetch milestones for the selected project
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      return groonabackend.entities.Milestone.filter({ project_id: selectedProject });
    },
    enabled: !!selectedProject,
  });

  // Fetch current project to check status
  const { data: currentProject } = useQuery({
    queryKey: ['project', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: selectedProject });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ id: selectedProject });
      }
      return projects[0] || null;
    },
    enabled: !!selectedProject,
  });

  const isLocked = React.useMemo(() => {
    if (!selectedProject) return false;
    // 1. Project-wide lock
    if (currentProject?.status === 'completed') return true;

    // 2. Milestone lock
    if (selectedMilestone) {
      const milestone = milestones.find(m => (m.id || m._id) === selectedMilestone);
      return milestone?.status === 'completed';
    }
    return false;
  }, [selectedProject, selectedMilestone, currentProject, milestones]);


  // rawStories is provided by hierarchy query above

  // Filtered Stories
  const stories = React.useMemo(() => {
    if (!rawStories) return [];
    const validStoryIds = new Set(
      myAssignedTasks
        .filter(task => {
          const pId = task.project_id?.id || task.project_id?._id || task.project_id;
          if (String(pId) !== String(selectedProject)) return false;

          const assigneeEmail = (task.assignee_id?.email || task.assignee_email || task.assignee || '').toLowerCase().trim();
          const targetEmail = currentUser?.email?.toLowerCase().trim();
          const isAssigned = targetEmail && assigneeEmail === targetEmail;

          // Always block if already submitted for Timer (no initialData check needed here usually or same logic)
          return isAssigned;
        })
        .map(t => {
          const sId = t.story_id?.id || t.story_id?._id || t.story_id;
          return sId ? String(sId) : null;
        })
        .filter(Boolean)
    );
    return rawStories.filter(s => validStoryIds.has(String(s.id)));
  }, [rawStories, myAssignedTasks, selectedProject, currentUser, submittedTaskIds]);

  // Fetch epics
  const { data: epics = [] } = useQuery({
    queryKey: ['epics', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      return groonabackend.entities.Epic.filter({ project_id: selectedProject });
    },
    enabled: !!selectedProject,
  });

  // Fetch sprints
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      return groonabackend.entities.Sprint.filter({ project_id: selectedProject });
    },
    enabled: !!selectedProject,
  });

  // Milestone inheritance from Sprint
  useEffect(() => {
    if (selectedSprint && selectedSprint !== "unassigned" && !selectedMilestone) {
      const sprint = sprints.find(s => (s.id || s._id) === selectedSprint);
      if (sprint?.milestone_id) {
        setSelectedMilestone(sprint.milestone_id);
      }
    }
  }, [selectedSprint, sprints, selectedMilestone]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Format elapsed time
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Capture location
  const captureLocation = async () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${locationData.latitude}&longitude=${locationData.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            locationData.city = data.city || data.locality || '';
            locationData.country = data.countryName || '';
            locationData.address = [data.locality, data.city, data.principalSubdivision, data.countryName].filter(Boolean).join(', ');
          } catch (err) {
            console.error('Failed to get address:', err);
          }

          resolve(locationData);
        },
        (error) => {
          console.error('Location error:', error);
          resolve(null);
        }
      );
    });
  };

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProject || !selectedTask) {
        throw new Error('Please select project and task before starting');
      }

      const loc = await captureLocation();
      setLocation(loc);

      const clockEntry = await groonabackend.entities.ClockEntry.create({
        tenant_id: effectiveTenantId,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        clock_in_time: new Date().toISOString(),
        clock_in_location: loc,
        is_clocked_in: true,
        project_id: selectedProject,
        story_id: selectedStory || null,
        sprint_id: selectedSprint || null,
        task_id: selectedTask,
        milestone_id: selectedMilestone || null,
        work_type: selectedWorkType,
        description: workDescription,
      });

      return clockEntry;
    },
    onSuccess: (entry) => {
      console.log('[ClockInOutTimer] Timer started:', entry);
      setActiveClockEntry(entry);
      setIsRunning(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      setTotalPausedSeconds(0);
      queryClient.invalidateQueries({ queryKey: ['active-clock-entry'] });
      toast.success('Timer started! Location captured.');
    },
    onError: (error) => {
      console.error('[ClockInOutTimer] Start failed:', error);
      toast.error(error.message || 'Failed to start timer');
    },
  });

  // Pause timer mutation
  const pauseTimerMutation = useMutation({
    mutationFn: async () => {
      if (!activeClockEntry) return;
      const now = new Date().toISOString();
      await groonabackend.entities.ClockEntry.update(activeClockEntry.id, {
        is_paused: true,
        last_paused_at: now
      });
      return now;
    },
    onSuccess: (pauseTime) => {
      setIsPaused(true);
      setActiveClockEntry(prev => ({
        ...prev,
        is_paused: true,
        last_paused_at: pauseTime
      }));
      toast.info('Timer paused');
    }
  });

  // Resume timer mutation
  const resumeTimerMutation = useMutation({
    mutationFn: async () => {
      if (!activeClockEntry || !activeClockEntry.last_paused_at) return;

      const now = new Date();
      const lastPausedAt = new Date(activeClockEntry.last_paused_at);
      const pauseDuration = Math.floor((now.getTime() - lastPausedAt.getTime()) / 1000);
      const newTotalPausedSeconds = (activeClockEntry.total_paused_seconds || 0) + pauseDuration;

      await groonabackend.entities.ClockEntry.update(activeClockEntry.id, {
        is_paused: false,
        last_paused_at: null,
        total_paused_seconds: newTotalPausedSeconds
      });

      return { pauseDuration, newTotalPausedSeconds };
    },
    onSuccess: (data) => {
      setIsPaused(false);
      setTotalPausedSeconds(data.newTotalPausedSeconds);
      setActiveClockEntry(prev => ({
        ...prev,
        is_paused: false,
        last_paused_at: null,
        total_paused_seconds: data.newTotalPausedSeconds
      }));
      toast.success('Timer resumed');
    }
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      console.log('[ClockInOutTimer] Stopping timer...');
      console.log('[ClockInOutTimer] Active entry:', activeClockEntry);

      if (!activeClockEntry) {
        throw new Error('No active clock entry found');
      }

      // Always use project/task from the active clock entry
      const projectId = activeClockEntry.project_id;
      const storyId = activeClockEntry.story_id;
      const sprintId = activeClockEntry.sprint_id;
      const taskId = activeClockEntry.task_id;
      const milestoneId = activeClockEntry.milestone_id;

      if (!projectId || !taskId) {
        throw new Error('Project and task information is missing from clock entry');
      }

      const loc = await captureLocation();
      const endTime = new Date();
      const totalMinutes = Math.floor(elapsedSeconds / 60);

      console.log('[ClockInOutTimer] Updating clock entry...');

      // Update clock entry
      const updatedClockEntry = await groonabackend.entities.ClockEntry.update(activeClockEntry.id, {
        clock_out_time: endTime.toISOString(),
        clock_out_location: loc,
        is_clocked_in: false,
        total_minutes: totalMinutes,
        description: workDescription,
      });

      console.log('[ClockInOutTimer] Clock entry updated:', updatedClockEntry);

      // Fetch project/sprint/task details
      const fetchedProjects = await groonabackend.entities.Project.filter({ _id: projectId });
      const projectName = fetchedProjects[0]?.name || '';

      let sprintName = null;
      if (sprintId) {
        const fetchedSprints = await groonabackend.entities.Sprint.filter({ _id: sprintId });
        sprintName = fetchedSprints[0]?.name || null;
      }

      const fetchedTasks = await groonabackend.entities.Task.filter({ _id: taskId });
      const taskTitle = fetchedTasks[0]?.title || '';

      let finalMilestoneId = milestoneId;
      let milestoneName = null;
      if (finalMilestoneId) {
        const fetchedMilestones = await groonabackend.entities.Milestone.filter({ _id: finalMilestoneId });
        milestoneName = fetchedMilestones[0]?.name || null;
      }

      console.log('[ClockInOutTimer] Creating timesheet entry...');

      // Create timesheet entry
      const timesheet = await groonabackend.entities.Timesheet.create({
        tenant_id: effectiveTenantId,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        date: format(new Date(activeClockEntry.clock_in_time), 'yyyy-MM-dd'),
        project_id: projectId,
        project_name: projectName,
        story_id: storyId || null,
        sprint_id: sprintId || null,
        sprint_name: sprintName || null,
        task_id: taskId,
        task_title: taskTitle,
        milestone_id: finalMilestoneId || null,
        milestone_name: milestoneName || null,
        start_time: activeClockEntry.clock_in_time,
        end_time: endTime.toISOString(),
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        total_minutes: totalMinutes,
        description: workDescription,
        remark: remark,
        location: loc || activeClockEntry.clock_in_location, // FIXED: location_data -> location
        entry_type: 'clock_in_out',
        status: 'draft',
        is_billable: true,
        is_locked: false,
        // Snapshot Data
        snapshot_hourly_rate: currentUser.hourly_rate || 0,
        snapshot_total_cost: (totalMinutes / 60) * (currentUser.hourly_rate || 0),
      });

      console.log('[ClockInOutTimer] Timesheet created:', timesheet);

      // Link timesheet to clock entry
      await groonabackend.entities.ClockEntry.update(updatedClockEntry.id, {
        timesheet_id: timesheet.id,
      });

      // Log activity
      try {
        await groonabackend.entities.Activity.create({
          tenant_id: effectiveTenantId,
          action: 'created',
          entity_type: 'task',
          entity_id: timesheet.task_id,
          entity_name: timesheet.task_title,
          project_id: timesheet.project_id,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          details: `Logged ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m via timer on ${timesheet.task_title}`,
        });
      } catch (error) {
        console.error('[ClockInOutTimer] Failed to log activity:', error);
      }

      return timesheet;
    },
    onSuccess: (timesheet) => {
      console.log('[ClockInOutTimer] Timer stopped successfully:', timesheet);
      setIsRunning(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      setTotalPausedSeconds(0);
      setActiveClockEntry(null);
      setSelectedProject("");
      setSelectedStory("");
      setSelectedSprint("");
      setSelectedTask("");
      setSelectedMilestone("");
      setSelectedWorkType("development");
      setWorkDescription("");
      setRemark("");
      setLocation(null);

      queryClient.invalidateQueries({ queryKey: ['active-clock-entry'] });
      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });

      toast.success('Timer stopped! Timesheet entry created.');

      if (onTimesheetCreated) {
        onTimesheetCreated(timesheet);
      }
    },
    onError: (error) => {
      console.error('[ClockInOutTimer] Stop failed:', error);
      toast.error(error.message || 'Failed to stop timer');
    },
  });

  const handleStartTimer = () => {
    if (!selectedProject) {
      toast.error('Please select a project before starting timer');
      return;
    }
    if (!selectedTask) {
      toast.error('Please select a task before starting timer');
      return;
    }
    startTimerMutation.mutate();
  };

  const handleStopTimer = () => {
    if (!activeClockEntry?.project_id || !activeClockEntry?.task_id) {
      toast.error('Clock entry is missing project or task information. Cannot stop timer.');
      return;
    }

    if (confirm('Stop timer and create timesheet entry?')) {
      stopTimerMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Timer Display */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Clock className={`h-8 w-8 ${isRunning ? 'text-green-600 animate-pulse' : 'text-slate-400'}`} />
              <div className="text-5xl font-bold text-slate-900 font-mono">
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {isRunning ? (
                <Badge className={`${isPaused ? 'bg-amber-500' : 'bg-green-600'} text-white`}>
                  <span className={`inline-block w-2 h-2 rounded-full bg-white mr-2 ${isPaused ? '' : 'animate-pulse'}`}></span>
                  {isPaused ? 'Timer Paused' : 'Timer Running'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-600">
                  Timer Stopped
                </Badge>
              )}
            </div>

            {location && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4" />
                <span>{location.city || location.address || 'Location captured'}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project/Task Selection */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Work Type *</Label>
          <Select
            value={selectedWorkType}
            onValueChange={setSelectedWorkType}
            disabled={isRunning}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select work type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">💻 Development</SelectItem>
              <SelectItem value="qa">🔍 QA</SelectItem>
              <SelectItem value="rework">🔄 Rework</SelectItem>
              <SelectItem value="bug">🐞 Bug</SelectItem>
              <SelectItem value="meeting">👥 Meeting</SelectItem>
              <SelectItem value="support">🛠️ Support</SelectItem>
              <SelectItem value="idle">⏸️ Idle</SelectItem>
              <SelectItem value="overtime">⏰ Overtime</SelectItem>
              <SelectItem value="other">📌 Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conditional Remark Field for Timer */}
        {(selectedWorkType === 'rework' || selectedWorkType === 'bug' || selectedWorkType === 'overtime') && (
          <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Label className="text-amber-900 font-semibold italic">
              Remark (Mandatory for {selectedWorkType === 'overtime' ? 'Overtime' : selectedWorkType}) *
            </Label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={`Reason for ${selectedWorkType}...`}
              className="border-amber-300 focus:ring-amber-500"
              disabled={isRunning}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Project *</Label>
          <Select
            value={selectedProject}
            onValueChange={(val) => {
              setSelectedProject(val);
              setSelectedSprint("");
              setSelectedTask("");
            }}
            disabled={isRunning}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.length === 0 ? (
                <SelectItem value="no-projects" disabled>No projects available</SelectItem>
              ) : (
                projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedProject && (
          <div className="space-y-2">
            <Label>Story *</Label>
            <Select
              value={selectedStory}
              onValueChange={(val) => {
                setSelectedStory(val);
                const story = stories.find(s => s.id === val);
                setSelectedSprint(story?.sprint_id || "");
                setSelectedTask("");
              }}
              disabled={isRunning}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select story..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No Story</SelectItem>
                {stories.map(story => (
                  <SelectItem key={story.id} value={story.id}>
                    {story.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Display Related Epic and Sprint Badges */}
            {selectedStory && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {(() => {
                  const currentStory = stories.find(s => s.id === selectedStory);
                  if (!currentStory) return null;
                  const epic = currentStory.epic_id ? epics.find(e => e.id === currentStory.epic_id) : null;
                  const sprint = currentStory.sprint_id ? sprints.find(s => s.id === currentStory.sprint_id) : null;

                  return (
                    <>
                      {epic && (
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
                          Epic: {epic.name}
                        </div>
                      )}
                      {sprint && (
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800">
                          Sprint: {sprint.name}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {selectedProject && (
          <div className="space-y-2">
            <Label>Task *</Label>
            <Select
              value={selectedTask}
              onValueChange={(val) => {
                setSelectedTask(val);
                const task = tasks.find(t => t.id === val);
                // Auto-inherit milestone from task if available
                if (task?.milestone_id) {
                  setSelectedMilestone(task.milestone_id);
                }
              }}
              disabled={isRunning}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.length === 0 ? (
                  <SelectItem value="no-tasks" disabled>No tasks available</SelectItem>
                ) : (
                  tasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Milestone Selection */}
        {selectedProject && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-blue-500" />
              Project Milestone
            </Label>
            <Select
              value={selectedMilestone}
              onValueChange={setSelectedMilestone}
              disabled={isRunning}
            >
              <SelectTrigger className="bg-white/50 border-slate-200/60">
                <SelectValue placeholder="Select milestone (Optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Milestone</SelectItem>
                {milestones
                  .filter(m => m.status === 'in_progress' || (selectedMilestone && (m.id === selectedMilestone || m._id === selectedMilestone)))
                  .map(m => (
                    <SelectItem key={m.id || m._id} value={m.id || m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLocked && !isRunning && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700">
            <Lock className="h-5 w-5 text-red-500" />
            <div className="text-sm">
              <p className="font-bold">Project Phase Settled</p>
              <p>Selection is locked. You cannot log time to a completed phase.</p>
            </div>
          </div>
        )}


        <div className="space-y-2">
          <Label>Work Description</Label>
          <Textarea
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            placeholder="Describe what you're working on..."
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!isRunning ? (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 h-16 text-xl font-bold"
              onClick={() => startTimerMutation.mutate()}
              disabled={!selectedProject || !selectedTask || startTimerMutation.isPending || isLocked}
            >
              {startTimerMutation.isPending ? (
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              ) : (
                <Play className="h-6 w-6 mr-2" />
              )}
              Start Work Timer
            </Button>
            {hasTimesheetAlert && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1.5 justify-center bg-red-50 p-2 rounded border border-red-100 italic">
                <AlertCircle className="h-3.5 w-3.5" />
                Work start blocked. Please log pending timesheets first.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {isPaused ? (
                <Button
                  onClick={() => resumeTimerMutation.mutate()}
                  disabled={resumeTimerMutation.isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  size="lg"
                >
                  {resumeTimerMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Resume
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => pauseTimerMutation.mutate()}
                  disabled={pauseTimerMutation.isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  size="lg"
                >
                  {pauseTimerMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <PauseIcon className="h-5 w-5 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={handleStopTimer}
                disabled={stopTimerMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                size="lg"
              >
                {stopTimerMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Stop
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-slate-500 italic">
              Timer is tracking your work. You can pause if you take a break.
            </p>
          </div>
        )}

        {!isRunning && (!selectedProject || !selectedTask) ? (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>Select project and task to start tracking</span>
          </div>
        ) : isRunning ? (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle className="h-4 w-4" />
            <span>Timer is tracking your work. Click "Stop & Save" when done.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

