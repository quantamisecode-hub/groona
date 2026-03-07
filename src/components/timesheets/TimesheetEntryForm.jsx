import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Clock, Save, Send, Loader2, DollarSign, Flag, Lock } from "lucide-react";
import { format, isValid } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";
import LocationTracker from "./LocationTracker";
import ClockInOutTimer from "./ClockInOutTimer";

export default function TimesheetEntryForm({
  currentUser,
  effectiveTenantId,
  onSubmit,
  onCancel,
  initialData = null,
  loading = false,
  selectedUserEmail = null, // For admin editing
  forceRemark = false,
  remarkLabel = "Remark",
  hideCancel = false,
  extraButtons = null,
  preSelectedDate = null // Missing timesheet date for enforcement
}) {
  // --- REAL-TIME USER STATUS CHECK ---
  // The global UserContext might be stale (1 min cache).
  // We fetch the specific user status again to ensure 'is_overloaded' is fresh.
  const { data: realtimeUser } = useQuery({
    queryKey: ['user-realtime-status', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const users = await groonabackend.entities.User.filter({ email: currentUser.email });
      return users[0] || null;
    },
    enabled: !!currentUser?.email,
    staleTime: 0, // Always fetch fresh
  });

  // Use realtime status if available, fallback to context user
  const effectiveUser = realtimeUser || currentUser;

  const isValidDate = (d) => d instanceof Date && !isNaN(d);
  const safeFormat = (date, fmt) => {
    const d = date instanceof Date ? date : new Date(date);
    return isValidDate(d) ? format(d, fmt) : '';
  };

  const [entryMode, setEntryMode] = useState("manual");
  const [formData, setFormData] = useState({
    date: preSelectedDate ? safeFormat(preSelectedDate, 'yyyy-MM-dd') :
      (initialData?.date ? safeFormat(initialData.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
    project_id: initialData?.project_id || '',
    story_id: initialData?.story_id || '',
    sprint_id: initialData?.sprint_id || '',
    task_id: initialData?.task_id || '',
    hours: initialData?.hours || 0,
    minutes: initialData?.minutes || 0,
    start_time: initialData?.start_time ? safeFormat(initialData.start_time, 'HH:mm') : '',
    end_time: initialData?.end_time ? safeFormat(initialData.end_time, 'HH:mm') : '',
    description: initialData?.description || '',
    remark: initialData?.remark || '',
    work_type: initialData?.work_type || 'development',
    is_billable: initialData?.is_billable !== undefined ? initialData.is_billable : true,
    hourly_rate: initialData?.hourly_rate || null,
    currency: initialData?.currency || 'USD',
    milestone_id: initialData?.milestone_id || '',
  });
  const [location, setLocation] = useState(initialData?.location || null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = preSelectedDate ? new Date(preSelectedDate) : (initialData?.date ? new Date(initialData.date) : new Date());
    return isValidDate(d) ? d : new Date();
  });

  // Determine the user context (for admin editing)
  const targetUserEmail = selectedUserEmail || currentUser?.email;

  // Check if user is admin or project manager
  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.id, formData.project_id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser?.id,
      project_id: formData.project_id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !!formData.project_id && currentUser?.role !== 'admin' && !currentUser?.is_super_admin,
  });

  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';
  const isProjectManager = projectRoles.length > 0;

  // Rule 1: "Billable Time" option should NOT show for 'viewer' or 'project_manager'
  const canSeeBillableOption =
    currentUser?.custom_role !== 'viewer' &&
    currentUser?.custom_role !== 'project_manager';

  // Rule 2: "Billing Rate Configuration" should show ONLY for admins (who are NOT project managers) and 'owners'
  // Even if user is Admin, if they have 'project_manager' custom role, it should be hidden.
  const canConfigureRate = (isAdmin && currentUser?.custom_role !== 'project_manager') || currentUser?.custom_role === 'owner';

  // Centralized Work Hierarchy Fetch
  const { data: hierarchy = { projects: [], stories: [], tasks: [] }, isLoading: hierarchyLoading } = useQuery({
    queryKey: ['user-work-hierarchy', targetUserEmail, effectiveTenantId],
    queryFn: () => groonabackend.functions.invoke('getUserWorkHierarchy', {
      userEmail: targetUserEmail,
      userId: currentUser?.id,
      tenantId: effectiveTenantId,
      isAdmin,
      isOwner: currentUser?.custom_role === 'owner',
      isProjectManager: currentUser?.custom_role === 'project_manager'
    }),
    enabled: !!targetUserEmail && !!effectiveTenantId,
  });

  const { projects = [], stories: rawStories = [], tasks: myAssignedTasks = [] } = hierarchy;

  const myProjectIds = React.useMemo(() => {
    return new Set(projects.map(p => p.id));
  }, [projects]);

  // Fetch existing timesheets to prevent duplicate logging
  const { data: existingTimesheets = [] } = useQuery({
    queryKey: ['timesheet-duplicates', targetUserEmail],
    queryFn: async () => {
      if (!targetUserEmail) return [];
      return groonabackend.entities.Timesheet.filter({ user_email: targetUserEmail });
    },
    enabled: !!targetUserEmail,
  });

  // Fetch project status and milestones
  const { data: currentProject } = useQuery({
    queryKey: ['project', formData.project_id],
    queryFn: async () => {
      if (!formData.project_id) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: formData.project_id });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ id: formData.project_id });
      }
      return projects[0] || null;
    },
    enabled: !!formData.project_id,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', formData.project_id],
    queryFn: async () => {
      if (!formData.project_id) return [];
      return groonabackend.entities.Milestone.filter({ project_id: formData.project_id });
    },
    enabled: !!formData.project_id,
  });

  // --- Holiday Synchronization ---
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', effectiveTenantId],
    queryFn: () => groonabackend.entities.Holiday.filter({
      tenant_id: effectiveTenantId
    }),
    enabled: !!effectiveTenantId,
    staleTime: 0, // Ensure fresh data on every render/tab switch
    refetchOnWindowFocus: true,
  });

  // --- Individual Work Schedule from DB ---
  const { data: employeeSchedule } = useQuery({
    queryKey: ['employee-work-schedules', effectiveTenantId, effectiveUser?.email],
    queryFn: async () => {
      if (!effectiveUser?.email || !effectiveTenantId) return null;
      const results = await groonabackend.entities.EmployeeWorkSchedule.filter({
        tenant_id: effectiveTenantId,
        user_email: effectiveUser.email
      });
      return results[0] || null;
    },
    enabled: !!effectiveTenantId && !!effectiveUser?.email,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Derive the working days for this user: DB schedule → user model fallback → Mon-Sat default
  const userWorkingDays = React.useMemo(() => {
    if (employeeSchedule?.working_days?.length) return employeeSchedule.working_days;
    if (effectiveUser?.working_days?.length) return effectiveUser.working_days;
    return [1, 2, 3, 4, 5, 6]; // Default Mon-Sat
  }, [employeeSchedule, effectiveUser]);

  const getIndianHolidays = (year) => {
    const holidayData = {
      2025: [{ m: 0, d: 26, n: 'Republic Day' }, { m: 1, d: 26, n: 'Maha Shivaratri' }, { m: 2, d: 14, n: 'Holi' }, { m: 2, d: 31, n: 'Eid-ul-Fitr' }, { m: 3, d: 6, n: 'Ram Navami' }, { m: 3, d: 10, n: 'Mahavir Jayanti' }, { m: 3, d: 18, n: 'Good Friday' }, { m: 4, d: 12, n: 'Buddha Purnima' }, { m: 5, d: 7, n: 'Eid-ul-Zuha' }, { m: 6, d: 6, n: 'Muharram' }, { m: 7, d: 15, n: 'Independence Day' }, { m: 7, d: 16, n: 'Janmashtami' }, { m: 8, d: 5, n: 'Milad-un-Nabi' }, { m: 9, d: 2, n: 'Gandhi Jayanti' }, { m: 9, d: 2, n: 'Dussehra' }, { m: 9, d: 20, n: 'Diwali' }, { m: 10, d: 5, n: 'Guru Nanak Jayanti' }, { m: 11, d: 25, n: 'Christmas' }],
      2026: [{ m: 0, d: 26, n: 'Republic Day' }, { m: 2, d: 4, n: 'Holi' }, { m: 2, d: 21, n: 'Eid-ul-Fitr' }, { m: 2, d: 26, n: 'Ram Navami' }, { m: 2, d: 31, n: 'Mahavir Jayanti' }, { m: 3, d: 3, n: 'Good Friday' }, { m: 4, d: 1, n: 'Buddha Purnima' }, { m: 4, d: 27, n: 'Eid-ul-Zuha' }, { m: 5, d: 26, n: 'Muharram' }, { m: 7, d: 15, n: 'Independence Day' }, { m: 7, d: 26, n: 'Eid-e-Milad' }, { m: 8, d: 4, n: 'Janmashtami' }, { m: 9, d: 2, n: 'Gandhi Jayanti' }, { m: 9, d: 20, n: 'Dussehra' }, { m: 10, d: 8, n: 'Diwali' }, { m: 10, d: 24, n: 'Guru Nanak Jayanti' }, { m: 11, d: 25, n: 'Christmas' }],
      2027: [{ m: 0, d: 26, n: 'Republic Day' }, { m: 2, d: 10, n: 'Eid-ul-Fitr' }, { m: 2, d: 22, n: 'Holi' }, { m: 2, d: 25, n: 'Good Friday' }, { m: 3, d: 15, n: 'Ram Navami' }, { m: 3, d: 20, n: 'Mahavir Jayanti' }, { m: 4, d: 17, n: 'Eid-ul-Zuha' }, { m: 4, d: 20, n: 'Buddha Purnima' }, { m: 6, d: 16, n: 'Muharram' }, { m: 7, d: 15, n: 'Independence Day' }, { m: 7, d: 16, n: 'Milad-un-Nabi' }, { m: 7, d: 25, n: 'Janmashtami' }, { m: 9, d: 2, n: 'Gandhi Jayanti' }, { m: 9, d: 10, n: 'Dussehra' }, { m: 9, d: 29, n: 'Diwali' }, { m: 10, d: 14, n: 'Guru Nanak Jayanti' }, { m: 11, d: 25, n: 'Christmas' }]
    };
    return holidayData[year] || [];
  };

  const holidayList = React.useMemo(() => {
    const list = new Set();
    const currentYear = new Date().getFullYear();

    // 1. Add Indian Govt Holidays
    [currentYear - 1, currentYear, currentYear + 1].forEach(year => {
      getIndianHolidays(year).forEach(h => {
        // Create local date correctly
        const date = new Date(year, h.m, h.d);
        list.add(format(date, 'yyyy-MM-dd'));
      });
    });

    // 2. Add Custom/Regional Holidays from DB
    holidays.forEach(h => {
      if (h.date) {
        // Safely extract YYYY-MM-DD from string to avoid timezone shifts
        const dbDate = typeof h.date === 'string' ? h.date.split('T')[0] : format(new Date(h.date), 'yyyy-MM-dd');
        list.add(dbDate);
      }
    });

    return list;
  }, [holidays]);

  const isLocked = React.useMemo(() => {
    if (!formData.project_id) return false;

    // 1. Project-wide lock
    if (currentProject?.status === 'completed') return true;

    // 2. Milestone-specific lock
    if (formData.milestone_id) {
      const milestone = milestones.find(m => (m.id || m._id) === formData.milestone_id);
      return milestone?.status === 'completed';
    }

    return false;
  }, [currentProject, milestones, formData.project_id, formData.milestone_id]);

  const submittedTaskIds = React.useMemo(() => new Set(
    existingTimesheets
      .filter(t => t.status !== 'rejected')
      .map(t => t.task_id)
      .filter(Boolean)
  ), [existingTimesheets]);

  // Logic to calculate "filled" dates in the current month (>= 8 hours)
  const filledDates = React.useMemo(() => {
    const dailyMinutes = {};
    existingTimesheets.forEach(t => {
      // Use date string to avoid timezone issues for grouping
      const dateStr = safeFormat(t.date, 'yyyy-MM-dd');
      if (t.status !== 'rejected') {
        dailyMinutes[dateStr] = (dailyMinutes[dateStr] || 0) + (t.total_minutes || 0);
      }
    });

    return Object.keys(dailyMinutes).filter(date => dailyMinutes[date] >= 480);
  }, [existingTimesheets]);

  const isDateDisabled = (date) => {
    if (!date) return false;
    const now = new Date();
    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Block future dates
    if (date > now) return true;

    // 2. Block previous months
    if (date < startOfCurrentMonth && !isAdmin) return true; // Admins can log for past months if needed

    // 3. Block Non-Working Days & Holidays
    // Uses schedule from EmployeeWorkSchedule DB table (with fallbacks)
    const dayOfWeek = date.getDay();

    if (!userWorkingDays.includes(dayOfWeek)) return true; // Block if not a working day
    if (holidayList.has(dateStr)) return true; // Block if it's a global/tenant holiday

    // 4. Block filled dates (8+ hours)
    // EXCEPTION: if we are editing an initial entry, don't block its OWN date
    const initialDateStr = initialData?.date ? safeFormat(initialData.date, 'yyyy-MM-dd') : null;
    if (filledDates.includes(dateStr) && dateStr !== initialDateStr) return true;

    return false;
  };

  // Fetch epics
  const { data: epics = [] } = useQuery({
    queryKey: ['epics', formData.project_id],
    queryFn: async () => {
      if (!formData.project_id) return [];
      return groonabackend.entities.Epic.filter({ project_id: formData.project_id });
    },
    enabled: !!formData.project_id,
  });

  // Fetch sprints
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', formData.project_id],
    queryFn: async () => {
      if (!formData.project_id) return [];
      return groonabackend.entities.Sprint.filter({ project_id: formData.project_id });
    },
    enabled: !!formData.project_id,
  });

  // Raw Stories and Tasks are now provided by the hierarchy query
  const rawTasks = myAssignedTasks;

  // Filtered Stories: Only show stories that have tasks assigned to the user
  const stories = React.useMemo(() => {
    if (!rawStories) return [];

    console.log('Debugging Story Filter:', {
      project_id: formData.project_id,
      targetUserEmail,
      rawStoriesCount: rawStories.length,
      allAssignedTasksCount: myAssignedTasks.length
    });

    // Use myAssignedTasks filtered by current project ID
    const validStoryIds = new Set(
      myAssignedTasks
        .filter(task => {
          const pId = task.project_id?.id || task.project_id?._id || task.project_id;

          const isProjectMatch = String(pId) === String(formData.project_id);

          const assigneeEmail = (task.assignee_id?.email || task.assignee_email || task.assignee || '').toLowerCase().trim();
          const targetEmail = targetUserEmail?.toLowerCase().trim();
          const isAssigned = targetEmail && assigneeEmail === targetEmail;

          // Show if not submitted OR if we are editing this task's entry
          // REMOVED: const isAvailable = !submittedTaskIds.has(task.id) || initialData?.task_id === task.id;
          const isAvailable = true;

          if (isProjectMatch) {
            console.log('Task in Project:', {
              id: task.id,
              title: task.title,
              story_id: task.story_id,
              assigneeEmail,
              match: isAssigned && isAvailable
            });
          }

          return isProjectMatch && isAssigned && isAvailable;
        })
        .map(t => {
          const sId = t.story_id?.id || t.story_id?._id || t.story_id;
          return sId ? String(sId) : null;
        })
        .filter(Boolean)
    );

    console.log('Valid Story IDs:', Array.from(validStoryIds));

    return rawStories.filter(s => validStoryIds.has(String(s.id)));
  }, [rawStories, myAssignedTasks, formData.project_id, targetUserEmail, submittedTaskIds, initialData]);

  // Filtered Tasks
  const tasks = React.useMemo(() => {
    if (!rawTasks) return [];

    return rawTasks.filter(task => {
      // 1. Assignment Check
      // 1. Assignment Check
      const targetEmail = targetUserEmail?.toLowerCase().trim();
      if (!targetEmail) return false;

      const directAssignee = (task.assignee_id?.email || task.assignee_email || task.assignee || '').toLowerCase().trim();
      const isDirect = directAssignee === targetEmail;

      let isShared = false;
      if (Array.isArray(task.assigned_to)) {
        isShared = task.assigned_to.some(a => {
          const e = (typeof a === 'string' ? a : a?.email || '').toLowerCase().trim();
          return e === targetEmail;
        });
      }

      // Explicitly check logical assignment
      if (!isDirect && !isShared) return false;

      // 2. Project Filter
      const pId = task.project_id?.id || task.project_id?._id || task.project_id;
      if (String(pId) !== String(formData.project_id)) return false;

      // 3. Story Filter
      if (formData.work_type !== 'impediment') {
        const sId = task.story_id?.id || task.story_id?._id || task.story_id;
        const selectedSId = formData.story_id;
        if (selectedSId) {
          if (String(sId) !== String(selectedSId)) return false;
        } else {
          // If "No Story" selected, only show tasks with no story
          if (sId) return false;
        }
      }

      // 4. Duplicate Check - DISABLED to allow multiple entries (e.g. Rework + Dev)
      // if (submittedTaskIds.has(task.id) && initialData?.task_id !== task.id) {
      //   return false;
      // }

      // 4. Sprint Locked Check
      let taskSprintId = task.sprint_id?.id || task.sprint_id?._id || task.sprint_id;
      if (!taskSprintId && task.story_id) {
        const sId = task.story_id?.id || task.story_id?._id || task.story_id;
        const taskStory = rawStories.find(s => String(s.id || s._id) === String(sId));
        if (taskStory) {
          taskSprintId = taskStory.sprint_id?.id || taskStory.sprint_id?._id || taskStory.sprint_id;
        }
      }

      if (taskSprintId && taskSprintId !== 'unassigned') {
        const sprint = sprints.find(s => String(s.id || s._id) === String(taskSprintId));
        if (sprint && !sprint.locked_date) {
          return false;
        }
      }

      return true;
    });
  }, [rawTasks, targetUserEmail, formData.project_id, formData.story_id, sprints, rawStories, formData.work_type]);

  // Fetch impediments if work type is impediment
  const { data: targetUserEntity } = useQuery({
    queryKey: ['target-user-entity-timesheet', targetUserEmail],
    queryFn: async () => {
      if (!targetUserEmail) return null;
      if (targetUserEmail === currentUser?.email) return currentUser;
      const users = await groonabackend.entities.User.filter({ email: targetUserEmail });
      return users[0] || null;
    },
    enabled: !!targetUserEmail && formData.work_type === 'impediment',
  });

  const { data: userImpediments = [] } = useQuery({
    queryKey: ['user-impediments-timesheet', targetUserEntity?.id],
    queryFn: async () => {
      if (!targetUserEntity?.id) return [];
      const imps = await groonabackend.entities.Impediment.filter({});
      return imps.filter(imp =>
        imp.assigned_to === targetUserEntity.id ||
        imp.assigned_to?.id === targetUserEntity.id ||
        imp.reported_by?.id === targetUserEntity.id ||
        imp.reported_by?.email === targetUserEntity.email ||
        imp.project_manager_id === targetUserEntity.id
      );
    },
    enabled: !!targetUserEntity?.id && formData.work_type === 'impediment',
  });

  const availableProjects = React.useMemo(() => {
    if (formData.work_type === 'impediment') {
      const impProjectIds = new Set(userImpediments.map(imp => imp.project_id?.id || imp.project_id?._id || imp.project_id).filter(Boolean));
      return projects.filter(p => impProjectIds.has(String(p.id)));
    }
    return projects;
  }, [projects, formData.work_type, userImpediments]);

  const availableStories = React.useMemo(() => {
    if (formData.work_type === 'impediment') {
      const filteredImps = userImpediments.filter(imp => String(imp.project_id?.id || imp.project_id?._id || imp.project_id) === String(formData.project_id));
      const impStoryIds = new Set(filteredImps.map(imp => imp.story_id?.id || imp.story_id?._id || imp.story_id).filter(Boolean));
      return stories.filter(s => impStoryIds.has(String(s.id)));
    }
    return stories;
  }, [stories, formData.work_type, userImpediments, formData.project_id]);

  const availableTasks = React.useMemo(() => {
    if (formData.work_type === 'impediment') {
      const filteredImps = userImpediments.filter(imp => String(imp.project_id?.id || imp.project_id?._id || imp.project_id) === String(formData.project_id));
      const impTaskIds = new Set(filteredImps.map(imp => imp.task_id?.id || imp.task_id?._id || imp.task_id).filter(Boolean));
      return tasks.filter(t => impTaskIds.has(String(t.id)));
    }
    return tasks;
  }, [tasks, formData.work_type, userImpediments, formData.project_id]);

  // Auto-select most recent project/task if available
  useEffect(() => {
    if (projects.length > 0 && !formData.project_id && !initialData) {
      setFormData(prev => ({ ...prev, project_id: projects[0].id }));
    }
  }, [projects, initialData]);

  // Sync preSelectedDate if it changes (e.g. after one day is filled)
  useEffect(() => {
    if (preSelectedDate) {
      const d = new Date(preSelectedDate);
      if (isValidDate(d)) {
        setSelectedDate(d);
        setFormData(prev => ({ ...prev, date: format(d, 'yyyy-MM-dd') }));
      }
    }
  }, [preSelectedDate]);

  // Auto-select the first available date in the current month if today is filled
  useEffect(() => {
    if (!initialData && !preSelectedDate && isDateDisabled(selectedDate)) {
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Find first non-disabled date from start of month to today
      let candidate = new Date(startOfCurrentMonth);
      while (candidate <= now && candidate <= endOfCurrentMonth) {
        if (!isDateDisabled(candidate)) {
          handleDateSelect(candidate);
          break;
        }
        candidate.setDate(candidate.getDate() + 1);
      }
    }
  }, [filledDates, initialData, preSelectedDate]);
  // Milestone inheritance from Sprint
  useEffect(() => {
    if (formData.sprint_id && formData.sprint_id !== "unassigned" && !formData.milestone_id) {
      const sprint = sprints.find(s => (s.id || s._id) === formData.sprint_id);
      if (sprint?.milestone_id) {
        setFormData(prev => ({ ...prev, milestone_id: sprint.milestone_id }));
      }
    }
  }, [formData.sprint_id, sprints, formData.milestone_id]);

  const handleDateSelect = (date) => {
    if (date && isValidDate(date)) {
      setSelectedDate(date);
      setFormData(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
    }
  };

  const handleProjectChange = (projectId) => {
    const selectedProject = projects.find(p => p.id === projectId);
    setFormData(prev => ({
      ...prev,
      project_id: projectId,
      story_id: '',
      sprint_id: '',
      task_id: '',
      currency: selectedProject?.currency || 'USD', // Auto-set currency
    }));
  };

  const isRemarkMandatory = forceRemark || (formData.work_type === 'rework' || formData.work_type === 'bug' || formData.work_type === 'overtime' || formData.work_type === 'impediment');

  const handleSubmit = (status = 'draft') => {
    if (isDateDisabled(selectedDate)) {
      toast.error("You cannot log time for this date (future, past month, or already filled).");
      return;
    }
    if (isRemarkMandatory && !formData.remark?.trim()) {
      toast.error(`Please provide a ${remarkLabel.toLowerCase()}`);
      return;
    }
    const selectedProject = projects.find(p => p.id === formData.project_id);
    const selectedSprint = sprints.find(s => s.id === formData.sprint_id);
    const selectedTask = tasks.find(t => t.id === formData.task_id);
    const selectedMilestone = milestones.find(m => (m.id || m._id) === formData.milestone_id) ||
      milestones.find(m => (m.id || m._id) === selectedTask?.milestone_id);

    const totalMinutes = (formData.hours * 60) + formData.minutes;

    const timesheetData = {
      tenant_id: effectiveTenantId,
      user_email: targetUserEmail,
      user_name: currentUser.full_name,
      date: formData.date,
      project_id: formData.project_id,
      project_name: selectedProject?.name || '',
      story_id: formData.story_id || null,
      sprint_id: formData.sprint_id || null,
      sprint_name: selectedSprint?.name || null,
      task_id: formData.task_id || null,
      task_title: selectedTask?.title || null,
      milestone_id: selectedMilestone?.id || selectedMilestone?._id || null,
      milestone_name: selectedMilestone?.name || null,
      start_time: (() => {
        if (!formData.start_time) return null;
        // 1. Get the date string (e.g., "2023-10-27")
        const dateStr = format(new Date(formData.date), 'yyyy-MM-dd');
        // 2. Combine with time (e.g., "2023-10-27T10:00")
        const dateTimeStr = `${dateStr}T${formData.start_time}`;
        // 3. Create a Date object as if it were in the User's Timezone
        // logic: treat the string as being in the target timezone, then get the UTC equivalent
        const zonedDate = fromZonedTime(dateTimeStr, currentUser.timezone || 'Asia/Kolkata');
        return zonedDate.toISOString();
      })(),
      end_time: (() => {
        if (!formData.end_time) return null;
        const dateStr = format(new Date(formData.date), 'yyyy-MM-dd');
        const dateTimeStr = `${dateStr}T${formData.end_time}`;
        const zonedDate = fromZonedTime(dateTimeStr, currentUser.timezone || 'Asia/Kolkata');
        return zonedDate.toISOString();
      })(),
      hours: formData.hours,
      minutes: formData.minutes,
      total_minutes: totalMinutes,

      // FIXED: Mapped correctly to backend schema
      description: formData.description,
      remark: formData.remark,
      location: location,
      timezone: currentUser.timezone || 'Asia/Kolkata', // Save the timezone used

      work_type: formData.work_type,
      is_within_work_zone: false,
      entry_type: entryMode,

      status: status === 'draft' ? 'draft' :
        (currentUser?.custom_role === 'owner' ? 'approved' :
          (currentUser?.custom_role === 'project_manager' ? 'pending_admin' : 'pending_pm')),
      is_billable: formData.is_billable,
      hourly_rate: formData.hourly_rate || null,
      currency: formData.currency || 'USD',

      // Snapshot financial data for historical accuracy
      snapshot_hourly_rate: formData.hourly_rate || currentUser.hourly_rate || 0,
      snapshot_total_cost: (() => {
        const rate = formData.hourly_rate || currentUser.hourly_rate || 0;
        return (totalMinutes / 60) * rate;
      })(),
    };

    onSubmit(timesheetData);
  };

  const handleTimerComplete = () => {
    // When timer creates a timesheet, close the form
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {initialData ? 'Edit Timesheet Entry' : 'Log Time'}
          {selectedUserEmail && (
            <span className="text-sm font-normal text-slate-600 ml-2">
              (Editing for: {selectedUserEmail})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={entryMode} onValueChange={setEntryMode} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="clock_in_out">Clock In/Out Timer</TabsTrigger>
          </TabsList>

          {isLocked && (
            <div className="mb-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-3 text-slate-600">
              <Lock className="h-5 w-5 text-slate-400" />
              <div className="text-sm">
                <p className="font-bold">Entry Locked / Project Settled</p>
                <p>You cannot log time against a completed project phase.</p>
              </div>
            </div>
          )}

          {/* Manual Entry Tab */}
          <TabsContent value="manual">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit('draft'); }} className="space-y-4 mt-4">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                      disabled={!!preSelectedDate}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={isDateDisabled}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Work Type */}
              <div className="space-y-2">
                <Label>Work Type *</Label>
                <Select
                  value={formData.work_type}
                  onValueChange={(val) => setFormData(prev => ({
                    ...prev,
                    work_type: val,
                    remark: (val === 'rework' || val === 'bug' || val === 'overtime' || val === 'impediment') ? prev.remark : '',
                    story_id: val === 'impediment' ? '' : prev.story_id
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">💻 Development</SelectItem>
                    <SelectItem value="qa">🔍 QA</SelectItem>
                    <SelectItem value="rework">🔄 Rework</SelectItem>
                    <SelectItem value="bug">🐞 Bug</SelectItem>
                    <SelectItem value="impediment">🚧 Impediment</SelectItem>
                    <SelectItem value="meeting">👥 Meeting</SelectItem>
                    <SelectItem value="support">🛠️ Support</SelectItem>
                    <SelectItem value="idle">⏸️ Idle</SelectItem>
                    <SelectItem value="overtime" disabled={effectiveUser?.is_overloaded}>
                      ⏰ Overtime {effectiveUser?.is_overloaded ? '(Locked - Overwork Limit Reached)' : ''}
                    </SelectItem>
                    <SelectItem value="other">📌 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label>Project *</Label>
                <Select value={formData.project_id} onValueChange={handleProjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Story Selection */}
              {formData.project_id && formData.work_type !== 'impediment' && (
                <div className="space-y-2">
                  <Label>Story *</Label>
                  <Select
                    value={formData.story_id}
                    onValueChange={(val) => {
                      const selectedStory = stories.find(s => s.id === val);
                      setFormData(prev => ({
                        ...prev,
                        story_id: val,
                        // Auto-set sprint from story
                        sprint_id: selectedStory?.sprint_id || '',
                        task_id: '' // Clear task when story changes
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select story..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>No Story (Unassigned)</SelectItem>
                      {availableStories.map(story => (
                        <SelectItem key={story.id} value={story.id}>
                          {story.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Display Related Epic and Sprint Badges */}
                  {formData.story_id && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(() => {
                        const selectedStory = stories.find(s => s.id === formData.story_id);
                        if (!selectedStory) return null;
                        const epic = selectedStory.epic_id ? epics.find(e => e.id === selectedStory.epic_id) : null;
                        const sprint = selectedStory.sprint_id ? sprints.find(s => s.id === selectedStory.sprint_id) : null;

                        return (
                          <>
                            {epic && (
                              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200">
                                Epic: {epic.name}
                              </div>
                            )}
                            {sprint && (
                              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200">
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

              {/* Task Selection */}
              {formData.project_id && (
                <div className="space-y-2">
                  <Label>Task *</Label>
                  <Select
                    value={formData.task_id}
                    onValueChange={(val) => {
                      const selectedTask = tasks.find(t => t.id === val);
                      setFormData(prev => ({
                        ...prev,
                        task_id: val,
                        // Auto-inherit milestone from task if available
                        milestone_id: selectedTask?.milestone_id || prev.milestone_id
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select task..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTasks.map(task => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Milestone Selection (Optional override or for non-task entries) - Hide for T&M and Retainer */}
              {formData.project_id && (currentProject?.billing_model !== 'time_and_materials' && currentProject?.billing_model !== 'retainer') && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-blue-500" />
                    Project Milestone
                  </Label>
                  <Select
                    value={formData.milestone_id}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, milestone_id: val === "unassigned" ? "" : val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select milestone (Optional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">No Milestone</SelectItem>
                      {milestones
                        .filter(m => m.status === 'in_progress' || (formData.milestone_id && (m.id === formData.milestone_id || m._id === formData.milestone_id)))
                        .map(m => (
                          <SelectItem key={m.id || m._id} value={m.id || m._id}>
                            {m.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Duration - Now using Start Time and End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <TimePicker
                    value={formData.start_time}
                    onChange={(startTime) => {
                      setFormData(prev => {
                        const newData = { ...prev, start_time: startTime };
                        if (newData.start_time && newData.end_time) {
                          const dateStr = format(new Date(newData.date), 'yyyy-MM-dd');
                          const start = new Date(`${dateStr}T${newData.start_time}`);
                          const end = new Date(`${dateStr}T${newData.end_time}`);
                          let diff = (end - start) / (1000 * 60);
                          if (diff < 0) diff += 24 * 60; // Handle overnight
                          newData.hours = Math.floor(diff / 60);
                          newData.minutes = Math.round(diff % 60);
                        }
                        return newData;
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <TimePicker
                    value={formData.end_time}
                    onChange={(endTime) => {
                      setFormData(prev => {
                        const newData = { ...prev, end_time: endTime };
                        if (newData.start_time && newData.end_time) {
                          const dateStr = format(new Date(newData.date), 'yyyy-MM-dd');
                          const start = new Date(`${dateStr}T${newData.start_time}`);
                          const end = new Date(`${dateStr}T${newData.end_time}`);
                          let diff = (end - start) / (1000 * 60);
                          if (diff < 0) diff += 24 * 60; // Handle overnight
                          newData.hours = Math.floor(diff / 60);
                          newData.minutes = Math.round(diff % 60);
                        }
                        return newData;
                      });
                    }}
                  />
                </div>
              </div>

              {/* Calculated Duration Display */}
              {(formData.hours > 0 || formData.minutes > 0) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600">Calculated Duration:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formData.hours}h {formData.minutes}m ({formData.hours * 60 + formData.minutes} minutes)
                  </span>
                </div>
              )}



              {/* Remark Field (Conditional or Forced) */}
              {(isRemarkMandatory) && (
                <div className={cn(
                  "space-y-2 p-3 rounded-lg border",
                  (formData.work_type === 'rework' || formData.work_type === 'bug' || formData.work_type === 'overtime' || formData.work_type === 'impediment')
                    ? "bg-amber-50 border-amber-200"
                    : "bg-blue-50 border-blue-200"
                )}>
                  <Label className={cn(
                    "font-semibold italic",
                    (formData.work_type === 'rework' || formData.work_type === 'bug' || formData.work_type === 'overtime')
                      ? "text-amber-900"
                      : "text-blue-900"
                  )}>
                    {remarkLabel} {forceRemark ? "*" : `(Mandatory for ${formData.work_type === 'overtime' ? 'Overtime' : formData.work_type}) *`}
                  </Label>
                  <Input
                    value={formData.remark}
                    onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                    placeholder={`Please provide ${remarkLabel.toLowerCase()}...`}
                    className={cn(
                      (formData.work_type === 'rework' || formData.work_type === 'bug' || formData.work_type === 'overtime')
                        ? "border-amber-300 focus:ring-amber-500"
                        : "border-blue-300 focus:ring-blue-500"
                    )}
                    required
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label>Activity Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what you worked on..."
                  rows={4}
                />
              </div>

              {/* Billable Toggle (Restricted Visibility) */}
              {canSeeBillableOption && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="billable"
                    checked={formData.is_billable}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_billable: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="billable" className="cursor-pointer">
                    This is billable time
                  </Label>
                </div>
              )}

              {/* Billing Rate Configuration (Admin/PM Only) */}
              {canConfigureRate && formData.is_billable && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                    <DollarSign className="h-4 w-4" />
                    <span>Billing Rate Configuration</span>
                    <span className="text-xs text-blue-600 ml-2">(Admin/Owner Only)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hourly Rate</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.hourly_rate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: parseFloat(e.target.value) || null }))}
                        placeholder="e.g., 50.00"
                      />
                      <p className="text-xs text-slate-500">Leave empty to use project default rate</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                          <SelectItem value="AUD">AUD (A$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Tracker */}
              <div className="space-y-2">
                <Label>Work Location</Label>
                <LocationTracker onLocationCaptured={setLocation} showMap={false} />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                {extraButtons}
                {!hideCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleSubmit('submitted')}
                  disabled={loading || isLocked}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Now
                    </>
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || isLocked}
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Clock In/Out Timer Tab */}
          <TabsContent value="clock_in_out">
            <div className="mt-4">
              <ClockInOutTimer
                currentUser={currentUser}
                effectiveTenantId={effectiveTenantId}
                onTimesheetCreated={handleTimerComplete}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

