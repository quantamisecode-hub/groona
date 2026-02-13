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
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Capacity</p>
                <p className="text-2xl font-bold text-slate-900">{Math.round(totalCapacity)}h</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Estimated Work</p>
                <p className="text-2xl font-bold text-slate-900">{Math.round(totalEstimatedHours)}h</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Overloaded</p>
                <p className="text-2xl font-bold text-red-600">{overloadedUsers}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Underutilized</p>
                <p className="text-2xl font-bold text-blue-600">{underutilizedUsers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Member Workloads */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle>Team Member Capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userWorkloads.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No team members or tasks found.</p>
              <p className="text-xs mt-1">Add members to the project or assign tasks to see capacity.</p>
            </div>
          ) : (
            userWorkloads.map(user => {
              const levelConfig = workloadColors[user.workloadLevel];
              const Icon = levelConfig.icon;

              return (
                <Card key={user.email} className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-slate-200">
                            {/* CRITICAL FIX: Use profile_image_url with AvatarImage component */}
                            <AvatarImage src={user.profile_image_url} alt={user.full_name} className="object-cover" />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold text-slate-900">{user.full_name}</h4>
                            <p className="text-sm text-slate-600">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <Settings2 className="h-3 w-3 text-slate-400" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Daily Capacity (hours)</label>
                                        <Input 
                                            type="number" 
                                            min="0" 
                                            max="24"
                                            value={capacityOverrides[user.email] !== undefined ? capacityOverrides[user.email] : 8}
                                            onChange={(e) => handleCapacityChange(user.email, e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                            
                            {/* CRITICAL FIX: Added 'capitalize' class to fix status text casing */}
                            <Badge className={`${levelConfig.bg} ${levelConfig.text} flex items-center gap-1 capitalize`}>
                              <Icon className="h-3 w-3" />
                              {user.workloadLevel}
                            </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            {user.totalHours}h / {user.totalCapacity}h capacity
                          </span>
                          <span className="font-medium text-slate-900">
                            {Math.round(user.utilizationPercent)}%
                          </span>
                        </div>
                        <Progress value={user.utilizationPercent} className="h-2" />
                      </div>

                      <div className="flex gap-4 text-sm text-slate-600 items-center flex-wrap">
                        <span>{user.tasksCount} tasks</span>
                        <span>{user.completedTasks} completed</span>

                        {user.leaves.length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 flex gap-1 items-center cursor-help">
                                  <CalendarOff className="h-3 w-3" />
                                  {user.leaveDays} days off
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-1">
                                  {user.leaves.map(l => (
                                    <div key={l.id}>
                                      {l.leave_type_name}: {format(parseISO(l.start_date), 'MMM d')} - {format(parseISO(l.end_date), 'MMM d')}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

