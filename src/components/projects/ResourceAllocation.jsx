import React, { useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/components/shared/UserContext";
import { startOfWeek, endOfWeek, isBefore, isWithinInterval, parseISO } from "date-fns";

export default function ResourceAllocation({ showSummaryOnly = false, showResourceListOnly = false }) {
  // Use global user context instead of local state to prevent loading spinner on every visit
  const { user: currentUser, effectiveTenantId } = useUser();

  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      const list = await groonabackend.entities.User.list();
      return effectiveTenantId
        ? list.filter(u =>
          u.tenant_id === effectiveTenantId &&
          u.role !== 'client' &&
          u.custom_role !== 'client'
        )
        : [];
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['all-tasks', effectiveTenantId],
    queryFn: async () => {
      const list = await groonabackend.entities.Task.list();
      return effectiveTenantId ? list.filter(t => t.tenant_id === effectiveTenantId) : [];
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });





  const resourceData = useMemo(() => {
    if (!users.length) return [];

    // Define current week window: Monday to Saturday
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday (adjust if strictly Sat needed, but endOfWeek usually fine)
    // Adjust to Saturday end if strictly required:
    const satEnd = new Date(currentWeekEnd);
    satEnd.setDate(satEnd.getDate() - 1);
    satEnd.setHours(23, 59, 59, 999);

    const weekStart = currentWeekStart;
    const weekEnd = satEnd;

    return users.map(user => {
      const userEmail = (user.email || '').toLowerCase();

      // Filter tasks assigned to this user
      const userTasks = tasks.filter(t => {
        const assigned = t.assigned_to || [];
        if (Array.isArray(assigned)) {
          return assigned.some(email => (email || '').toLowerCase() === userEmail);
        }
        return (assigned || '').toLowerCase() === userEmail;
      });

      // 1. Overdue Tasks: Pending and Due Date < this week's start
      const overdueTasks = userTasks.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        const isPending = !['completed', 'done', 'closed', 'resolved'].includes((t.status || '').toLowerCase());

        // Check if strictly before this week started
        return isPending && isBefore(dueDate, weekStart);
      });

      // 2. Current Week Tasks: Due Date within Mon-Sat of this week
      const currentWeekTasks = userTasks.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);

        return isWithinInterval(dueDate, { start: weekStart, end: weekEnd });
      });

      // 3. Active Work: Tasks that are actively being worked on (In Progress/Review), regardless of date
      const activeWorkTasks = userTasks.filter(t =>
        ['in_progress', 'review'].includes((t.status || '').toLowerCase())
      );

      // Combine relevant tasks for workload calculation (Unique tasks)
      // "Overdue pending tasks" + "Tasks for this week" + "Active Work"
      const uniqueTaskIds = new Set();
      const relevantTasks = [];

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      [...overdueTasks, ...currentWeekTasks, ...activeWorkTasks].forEach(t => {
        if (!uniqueTaskIds.has(t.id)) {
          // EXCLUDE tasks that are Overdue (Due Date < Today)
          // As per requirement: "if it is exceeded from the present date then dont calculate it"
          if (t.due_date) {
            const dueDate = new Date(t.due_date);
            // We compare against startOfToday to ensure tasks due TODAY are included, but tasks due YESTERDAY are excluded.
            if (isBefore(dueDate, startOfToday)) {
              return;
            }
          }

          uniqueTaskIds.add(t.id);
          relevantTasks.push(t);
        }
      });

      // Calculate Hours
      const userLoadHours = relevantTasks.reduce((sum, task) => {
        // Use estimated_hours if available, else fallback to story_points * 2, else 0
        let hours = Number(task.estimated_hours) || 0;
        if (!hours && task.story_points) {
          hours = Number(task.story_points) * 2;
        }
        return sum + hours;
      }, 0);

      // Capacity: Mon-Sat = 6 days * 8 hours = 48 hours
      const FIXED_CAPACITY_HOURS = 48;

      const rawWorkloadPercentage = (userLoadHours / FIXED_CAPACITY_HOURS) * 100;
      const workloadPercentage = Math.min(rawWorkloadPercentage, 100);

      let workloadLevel = 'optimal';
      if (rawWorkloadPercentage > 100) workloadLevel = 'overloaded';
      else if (rawWorkloadPercentage > 80) workloadLevel = 'high';
      else if (rawWorkloadPercentage < 20) workloadLevel = 'underutilized';

      // Active Tasks Count (Global)
      const activeTasks = userTasks.filter(t =>
        ['todo', 'in_progress', 'review'].includes((t.status || '').toLowerCase())
      );
      const completedTasks = userTasks.filter(t => (t.status || '').toLowerCase() === 'completed');

      // Count unique projects
      const projectIds = new Set(userTasks.map(t => t.project_id).filter(Boolean));
      const projectCount = projectIds.size;

      // Count unique sprints from tasks
      const sprintIds = new Set(userTasks.map(t => t.sprint_id).filter(Boolean));
      const sprintCount = sprintIds.size;

      return {
        user,
        activeTasks: activeTasks.length,
        completedTasks: completedTasks.length,
        totalEstimatedHours: userLoadHours,
        projectCount,
        sprintCount,
        workloadPercentage,
        workloadLevel,
        rawWorkloadPercentage
      };
    });
  }, [users, tasks]);

  const overloadedUsers = resourceData.filter(r => r.workloadLevel === 'overloaded');
  const underutilizedUsers = resourceData.filter(r => r.workloadLevel === 'underutilized');
  const avgWorkload = resourceData.length > 0
    ? resourceData.reduce((sum, r) => sum + r.rawWorkloadPercentage, 0) / resourceData.length
    : 0;

  const workloadColors = {
    optimal: 'bg-green-500',
    high: 'bg-amber-500',
    overloaded: 'bg-red-500',
    underutilized: 'bg-blue-500',
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Removed the explicit loader return here since useUser handles initial auth state better
  if (!currentUser) {
    return null; // Or a minimal skeleton if absolutely necessary, but context usually has user ready
  }

  return (
    <>
      {!showResourceListOnly && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[280px] md:w-auto">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Resources</p>
                    <p className="text-2xl font-bold text-slate-900">{users.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[280px] md:w-auto">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Overloaded</p>
                    <p className="text-2xl font-bold text-red-600">{overloadedUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[280px] md:w-auto">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Underutilized</p>
                    <p className="text-2xl font-bold text-blue-600">{underutilizedUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 flex-shrink-0 w-[280px] md:w-auto">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Avg Workload</p>
                    <p className="text-2xl font-bold text-slate-900">{avgWorkload.toFixed(0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!showSummaryOnly && (
        <div className="space-y-6">
          {/* Resource List */}
          <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-600" />
                Resource Allocation Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No team members found for this organization.
                </div>
              ) : (
                <div className="space-y-4">
                  {resourceData.map((resource) => (
                    <div
                      key={resource.user.email}
                      className="p-4 rounded-lg border border-slate-200 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={resource.user.profile_image_url} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {getInitials(resource.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-900">{resource.user.full_name || 'Unknown User'}</p>
                            <p className="text-sm text-slate-600">{resource.user.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="hidden sm:inline-flex">
                            {resource.activeTasks} Active Tasks
                          </Badge>
                          <Badge
                            className={`${resource.workloadLevel === 'overloaded'
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : resource.workloadLevel === 'high'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : resource.workloadLevel === 'underutilized'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : 'bg-green-100 text-green-700 border-green-200'
                              } border capitalize`}
                          >
                            {resource.workloadLevel.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            Workload Capacity ({resource.totalEstimatedHours.toFixed(1)}h / 48h)
                          </span>
                          <span className="font-semibold text-slate-900">
                            {resource.rawWorkloadPercentage.toFixed(0)}%
                          </span>
                        </div>
                        <Progress
                          value={resource.workloadPercentage}
                          className="h-2"
                          indicatorClassName={workloadColors[resource.workloadLevel]}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                        <div>
                          <p className="text-xs text-slate-600">Active Tasks</p>
                          <p className="text-lg font-bold text-slate-900">{resource.activeTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Completed</p>
                          <p className="text-lg font-bold text-green-600">{resource.completedTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Projects</p>
                          <p className="text-lg font-bold text-purple-600">{resource.projectCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Sprints</p>
                          <p className="text-lg font-bold text-indigo-600">{resource.sprintCount}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

