import React, { useState, useEffect, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, TrendingUp, AlertTriangle, CheckCircle, CalendarOff, Loader2, Settings2 } from "lucide-react";
import { format, differenceInBusinessDays, parseISO, addDays, isValid } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function SprintCapacityView({ sprint, tasks, projectId, onUpdateSprint }) {
  const [projectMembers, setProjectMembers] = useState([]);
  const [capacityOverrides, setCapacityOverrides] = useState(sprint.capacity_override || {});

  // Fixed capacity: Every team member has 40 hours per sprint maximum
  const FIXED_CAPACITY_HOURS = 40;

  // Sync local state if prop changes
  useEffect(() => {
    if (sprint.capacity_override) {
      setCapacityOverrides(sprint.capacity_override);
    }
  }, [sprint.capacity_override]);

  const handleCapacityChange = (userEmail, hours) => {
    const newOverrides = { ...capacityOverrides, [userEmail]: parseFloat(hours) };
    setCapacityOverrides(newOverrides);
    if (onUpdateSprint) {
      onUpdateSprint(sprint.id, { capacity_override: newOverrides });
    }
  };

  // Fetch project data
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      // Try both id and _id to ensure we get the project
      let projects = await groonabackend.entities.Project.filter({ id: projectId });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ _id: projectId });
      }
      const foundProject = projects[0] || null;

      // Debug logging
      if (foundProject) {
        console.log('SprintCapacityView - Project loaded:', {
          projectId,
          teamMembersCount: foundProject.team_members?.length || 0,
          teamMembers: foundProject.team_members
        });
      }

      return foundProject;
    },
    enabled: !!projectId
  });

  // Fetch all users to enrich member data with names and profile images
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (project) {
      // Use project.team_members if available, otherwise defaulting to empty array
      const rawMembers = project.team_members || [];

      // Always set members, even if allUsers hasn't loaded yet (will enrich when allUsers loads)
      const enrichedMembers = rawMembers.map(member => {
        const user = allUsers.find(u => u.email === member.email);
        return {
          ...member,
          name: user?.full_name || member.email,
          full_name: user?.full_name || member.email,
          id: user?.id || member.email,
          role: user?.role || member.role,
          // CRITICAL FIX: Map the correct profile_image_url field from the User entity
          profile_image_url: user?.profile_image_url || member.profile_image_url
        };
      });
      setProjectMembers(enrichedMembers);
    } else {
      // Reset when project is not available
      setProjectMembers([]);
    }
  }, [project, allUsers]);

  // Fetch leaves overlapping with the sprint
  const { data: leaves = [], isLoading: loadingLeaves } = useQuery({
    queryKey: ['leaves', sprint.id, sprint.start_date, sprint.end_date],
    queryFn: async () => {
      if (!sprint.start_date || !sprint.end_date) return [];
      const allLeaves = await groonabackend.entities.Leave.filter({ status: 'approved' });

      const sprintStart = parseISO(sprint.start_date);
      const sprintEnd = parseISO(sprint.end_date);

      return allLeaves.filter(leave => {
        const leaveStart = parseISO(leave.start_date);
        const leaveEnd = parseISO(leave.end_date);
        return (leaveStart <= sprintEnd && leaveEnd >= sprintStart);
      });
    },
    enabled: !!sprint.start_date && !!sprint.end_date
  });

  // Get all team members from project - this is the source of truth
  // Always use project.team_members as the primary source, enrich with user data when available
  const allProjectTeamMembers = useMemo(() => {
    // Always use project.team_members as the source of truth
    if (!project?.team_members || project.team_members.length === 0) {
      return [];
    }

    // Enrich team members with user data from allUsers or projectMembers
    return project.team_members.map(m => {
      const memberEmail = m.email || m;

      // Try to find in enriched projectMembers first
      const enrichedMember = projectMembers.find(pm => pm.email === memberEmail);
      if (enrichedMember) {
        return enrichedMember;
      }

      // Otherwise enrich from allUsers
      const user = allUsers.find(u => u.email === memberEmail);
      return {
        email: memberEmail,
        name: user?.full_name || m.name || memberEmail,
        full_name: user?.full_name || m.name || memberEmail,
        id: user?.id || memberEmail,
        role: user?.role || m.role || 'Contributor',
        profile_image_url: user?.profile_image_url || m.profile_image_url
      };
    });
  }, [project?.team_members, projectMembers, allUsers]);

  // Derive comprehensive list of users to analyze
  // Include ALL project team members PLUS any users with tasks who aren't in team_members
  const usersToAnalyze = useMemo(() => {
    const uniqueUsersMap = new Map();

    // 1. FIRST: Add ALL Explicit Project Members (this is the priority)
    allProjectTeamMembers.forEach(m => {
      if (m.email) uniqueUsersMap.set(m.email, m);
    });

    // 2. THEN: Add Users found in Task Assignments who aren't already in team_members
    tasks.forEach(task => {
      const assignees = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
      assignees.forEach(email => {
        if (email && !uniqueUsersMap.has(email)) {
          const userProfile = allUsers.find(u => u.email === email);
          uniqueUsersMap.set(email, {
            email,
            name: userProfile?.full_name || email,
            full_name: userProfile?.full_name || email,
            role: userProfile?.role || 'Contributor',
            id: userProfile?.id || email,
            // CRITICAL FIX: Ensure task-only users also get their image
            profile_image_url: userProfile?.profile_image_url
          });
        }
      });
    });

    return Array.from(uniqueUsersMap.values());
  }, [allProjectTeamMembers, tasks, allUsers]);

  // Calculate total capacity based on actual project team members only
  // Sum their actual available capacity (considering leaves) but cap each at 40h
  // This must be before any early returns to follow React hooks rules
  const totalCapacity = useMemo(() => {
    // Use allProjectTeamMembers which includes all team members from project
    // Fallback to project.team_members directly if allProjectTeamMembers is empty
    let teamMembers = allProjectTeamMembers;

    // If allProjectTeamMembers is empty but project.team_members exists, use it directly
    if (teamMembers.length === 0 && project?.team_members && project.team_members.length > 0) {
      teamMembers = project.team_members.map(m => ({
        email: m.email || m,
        name: m.name || m.email || m,
        full_name: m.name || m.email || m
      }));
    }

    // If no members at all, return 0
    if (teamMembers.length === 0) {
      return 0;
    }

    // If sprint dates are missing, use default 40h per member
    if (!sprint.start_date || !sprint.end_date) {
      return teamMembers.length * FIXED_CAPACITY_HOURS;
    }

    try {
      const sprintStart = parseISO(sprint.start_date);
      const sprintEnd = parseISO(sprint.end_date);

      if (!isValid(sprintStart) || !isValid(sprintEnd)) {
        return teamMembers.length * FIXED_CAPACITY_HOURS;
      }

      const businessDays = differenceInBusinessDays(addDays(sprintEnd, 1), sprintStart);
      let totalCapacityHours = 0;

      teamMembers.forEach(member => {
        const userEmail = member.email;
        if (!userEmail) return;

        const userLeaves = leaves.filter(l => l.user_email === userEmail);

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
        const hoursPerDay = capacityOverrides[userEmail] !== undefined ? capacityOverrides[userEmail] : 8;
        const calculatedCapacity = effectiveDays * hoursPerDay;

        // Cap each member's capacity at 40 hours
        totalCapacityHours += Math.min(calculatedCapacity, FIXED_CAPACITY_HOURS);
      });

      return totalCapacityHours;
    } catch (error) {
      console.error('Error calculating total capacity:', error);
      return teamMembers.length * FIXED_CAPACITY_HOURS;
    }
  }, [sprint.start_date, sprint.end_date, allProjectTeamMembers, leaves, capacityOverrides]);

  // Show loading if project is loading or leaves are loading
  if (loadingProject || loadingLeaves) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  }

  // If project is loaded but has no team members, show a message
  if (project && (!project.team_members || project.team_members.length === 0)) {
    return (
      <div className="space-y-6">
        <Card className="bg-white border border-slate-200/60 shadow-sm rounded-xl">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Team Members</h3>
            <p className="text-slate-600">Add team members to the project to view capacity information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate workload per user - show ALL project team members, even if they have no tasks
  // This ensures consistency with total capacity calculation
  const userWorkloads = usersToAnalyze.map(member => {
    const userEmail = member.email;
    const userTasks = tasks.filter(t => {
      if (Array.isArray(t.assigned_to)) {
        return t.assigned_to.includes(userEmail);
      }
      return t.assigned_to === userEmail;
    });
    const totalHours = userTasks.reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);
    const completedTasks = userTasks.filter(t => t.status === 'completed' || t.status === 'done').length;

    // Calculate capacity based on business days in sprint minus leaves
    // Default to 40 hours if sprint dates are not available
    let totalCapacity = FIXED_CAPACITY_HOURS;
    let businessDays = 0;
    let leaveDays = 0;
    const userLeaves = leaves.filter(l => l.user_email === userEmail);

    if (sprint.start_date && sprint.end_date) {
      const sprintStart = parseISO(sprint.start_date);
      const sprintEnd = parseISO(sprint.end_date);

      if (isValid(sprintStart) && isValid(sprintEnd)) {
        businessDays = differenceInBusinessDays(addDays(sprintEnd, 1), sprintStart);

        // Subtract leave days
        userLeaves.forEach(leave => {
          const lStart = parseISO(leave.start_date);
          const lEnd = parseISO(leave.end_date);

          // Calculate intersection
          const start = lStart > sprintStart ? lStart : sprintStart;
          const end = lEnd < sprintEnd ? lEnd : sprintEnd;

          if (start <= end) {
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            leaveDays += days;
          }
        });

        const effectiveDays = Math.max(0, businessDays - leaveDays);
        const hoursPerDay = capacityOverrides[userEmail] !== undefined ? capacityOverrides[userEmail] : 8;

        // Calculate capacity but cap at 40 hours maximum
        const calculatedCapacity = effectiveDays * hoursPerDay;
        totalCapacity = Math.min(calculatedCapacity, FIXED_CAPACITY_HOURS);
      }
    } else {
      // If no sprint dates, use default 40 hours per team member
      totalCapacity = FIXED_CAPACITY_HOURS;
    }

    const utilizationPercent = totalCapacity > 0 ? Math.min((totalHours / totalCapacity) * 100, 100) : (totalHours > 0 ? 100 : 0);

    let workloadLevel = 'optimal';
    if (totalCapacity === 0 && totalHours > 0) workloadLevel = 'overloaded';
    else if (totalHours > totalCapacity * 1.1) workloadLevel = 'overloaded';
    else if (totalHours > totalCapacity * 0.85) workloadLevel = 'high';
    else if (totalHours < totalCapacity * 0.5) workloadLevel = 'underutilized';

    return {
      email: userEmail,
      full_name: member.full_name || member.name || userEmail,
      profile_image_url: member.profile_image_url, // Pass the image URL down
      role: member.role,
      totalHours,
      totalCapacity,
      utilizationPercent,
      workloadLevel,
      tasksCount: userTasks.length,
      completedTasks,
      leaves: userLeaves,
      leaveDays
    };
  });

  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);

  const overloadedUsers = userWorkloads.filter(u => u.workloadLevel === 'overloaded').length;
  const underutilizedUsers = userWorkloads.filter(u => u.workloadLevel === 'underutilized').length;

  const workloadColors = {
    optimal: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle },
    high: { bg: "bg-yellow-100", text: "text-yellow-800", icon: TrendingUp },
    overloaded: { bg: "bg-red-100", text: "text-red-800", icon: AlertTriangle },
    underutilized: { bg: "bg-blue-100", text: "text-blue-800", icon: Users },
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Summary Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Capacity', value: `${Math.round(totalCapacity)}h`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', subtext: 'Project team' },
          { label: 'Estimated Work', value: `${Math.round(totalEstimatedHours)}h`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', subtext: 'Assigned tasks' },
          { label: 'Overloaded', value: overloadedUsers, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', subtext: 'Requires attention' },
          { label: 'Underutilized', value: underutilizedUsers, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', subtext: 'Capacity available' }
        ].map((stat, idx) => (
          <Card key={idx} className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px] overflow-hidden transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`h-11 w-11 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} shadow-sm border border-white/50`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-60">
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.subtext}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Member Workloads */}
      <Card className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 shadow-sm border border-slate-100">
                <Users className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-extrabold text-slate-800 tracking-tight">Team Member Capacity</CardTitle>
                <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">Resource availability for current sprint</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/50 border border-slate-200 text-slate-600 font-extrabold text-[10px] px-3 py-1 rounded-full tracking-widest shadow-xs">
              {userWorkloads.length} RESOURCES
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-6 space-y-6">
          {userWorkloads.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50 rounded-[20px] border border-dashed border-slate-200">
              <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Users className="h-8 w-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">No Resources found</h3>
              <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">Add team members to the project or assign tasks to see capacity analysis.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {userWorkloads.map(user => {
                const levelConfig = {
                  overloaded: { bg: "bg-rose-50", text: "text-rose-600", icon: AlertTriangle, progress: "bg-rose-500", label: "OVERLOADED" },
                  high: { bg: "bg-amber-50", text: "text-amber-600", icon: TrendingUp, progress: "bg-amber-500", label: "HIGH" },
                  optimal: { bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle, progress: "bg-emerald-500", label: "OPTIMAL" },
                  underutilized: { bg: "bg-indigo-50", text: "text-indigo-600", icon: Users, progress: "bg-indigo-500", label: "UNDERUTILIZED" }
                }[user.workloadLevel] || { bg: "bg-slate-50", text: "text-slate-600", icon: CheckCircle, progress: "bg-slate-500", label: "NORMAL" };

                const ProgressIcon = levelConfig.icon;

                return (
                  <div key={user.email} className="group/resource bg-white/40 border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-[0_8px_30px_rgb(99,102,241,0.06)] rounded-[24px] p-6 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover/resource:opacity-100 transition-opacity">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white shadow-sm border border-slate-100/50 text-slate-400 hover:text-indigo-600 hover:bg-slate-50">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-5 rounded-[20px] shadow-2xl border-slate-100/50">
                          <div className="space-y-3">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Adjust Capacity</p>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500">DAIL HOURS</label>
                              <Input
                                type="number"
                                min="0"
                                max="24"
                                value={capacityOverrides[user.email] !== undefined ? capacityOverrides[user.email] : 8}
                                onChange={(e) => handleCapacityChange(user.email, e.target.value)}
                                className="h-9 text-[13px] font-bold rounded-xl border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-300"
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Changes apply immediately to this sprint's capacity calculation.</p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                      {/* Left: User Info */}
                      <div className="flex items-center gap-4 min-w-[280px]">
                        <div className="relative">
                          <Avatar className="h-14 w-14 border-2 border-white ring-1 ring-slate-100 shadow-sm">
                            <AvatarImage src={user.profile_image_url} alt={user.full_name} className="object-cover" />
                            <AvatarFallback className="bg-slate-50 text-slate-400 font-black text-sm">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${levelConfig.bg} ${levelConfig.text}`}>
                            <ProgressIcon className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-slate-800 tracking-tight text-lg group-hover/resource:text-indigo-600 transition-colors uppercase">{user.full_name}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 truncate max-w-[150px]">{user.email}</span>
                            <span className="text-[10px] font-black text-indigo-400/50 tracking-tighter uppercase">{user.role || 'Member'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Center: Progress & Stats */}
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-end">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Workload Analysis</span>
                              <Badge className={`${levelConfig.bg} ${levelConfig.text} border-none font-black text-[9px] px-2 py-0.5 rounded-full tracking-widest shadow-none`}>
                                {levelConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black text-slate-800 tracking-tighter">{user.totalHours}h</span>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">/ {user.totalCapacity}h available</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-2xl font-black tracking-tighter ${user.utilizationPercent > 100 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {Math.round(user.utilizationPercent)}%
                            </span>
                          </div>
                        </div>

                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full ${levelConfig.progress} rounded-full transition-all duration-1000 ease-out shadow-sm`}
                            style={{ width: `${Math.min(user.utilizationPercent, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full">
                              <span className="text-[11px] font-black text-slate-700">{user.tasksCount}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasks</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50/50 rounded-full">
                              <span className="text-[11px] font-black text-emerald-600">{user.completedTasks}</span>
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Done</span>
                            </div>
                          </div>

                          {user.leaves.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 rounded-full border border-rose-100/50 cursor-help transition-all hover:bg-rose-100">
                                    <CalendarOff className="h-3 w-3 text-rose-500 shadow-none" />
                                    <span className="text-[11px] font-black text-rose-600">{user.leaveDays}D OFF</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-xl shadow-2xl border-slate-200">
                                  <div className="text-[11px] font-bold space-y-1.5 p-1">
                                    <p className="text-rose-500 uppercase tracking-widest pb-1 border-b border-slate-100">Leave Schedule</p>
                                    {user.leaves.map(l => (
                                      <div key={l.id} className="flex justify-between gap-4 text-slate-600 font-black">
                                        <span>{l.leave_type_name}</span>
                                        <span className="text-slate-400">{format(parseISO(l.start_date), 'MMM d')} - {format(parseISO(l.end_date), 'MMM d')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
