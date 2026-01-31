import React, { useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/components/shared/UserContext";

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

  const { data: sprints = [] } = useQuery({
    queryKey: ['all-sprints', effectiveTenantId],
    queryFn: async () => {
      const list = await groonabackend.entities.Sprint.list();
      return effectiveTenantId ? list.filter(s => s.tenant_id === effectiveTenantId) : [];
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['all-stories', effectiveTenantId],
    queryFn: async () => {
      const list = await groonabackend.entities.Story.list();
      return effectiveTenantId ? list.filter(s => s.tenant_id === effectiveTenantId) : [];
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000,
  });

  const resourceData = useMemo(() => {
    if (!users.length || !sprints.length) return [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find current and future sprints (not past sprints)
    // A sprint is "current/future" if:
    // - It has no end_date (ongoing/planned)
    // - Or its end_date is today or in the future
    const relevantSprints = sprints
      .filter(sprint => {
        if (!sprint.start_date) return false;
        const sprintStart = new Date(sprint.start_date);
        sprintStart.setHours(0, 0, 0, 0);

        // Include sprints that start today or in the future
        // OR sprints that are currently active (started before today, end after today)
        if (sprint.end_date) {
          const sprintEnd = new Date(sprint.end_date);
          sprintEnd.setHours(23, 59, 59, 999);
          return sprintEnd >= now; // Sprint ends today or later
        }

        // If no end_date, include if it starts today or later
        return sprintStart >= now;
      })
      .sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date) : new Date(0);
        const dateB = b.start_date ? new Date(b.start_date) : new Date(0);
        return dateA - dateB;
      })
      .slice(0, 2); // Take only first 2 sprints (current + next)

    // If no sprints found, create a 2-week window from today
    let windowStart = now;
    let windowEnd = new Date(now);
    windowEnd.setDate(now.getDate() + 14); // 2 weeks = 2 sprints

    if (relevantSprints.length > 0) {
      // Use the earliest sprint start date
      windowStart = relevantSprints[0].start_date ? new Date(relevantSprints[0].start_date) : now;
      windowStart.setHours(0, 0, 0, 0);

      // Use the latest sprint end date (or calculate if missing)
      const lastSprint = relevantSprints[relevantSprints.length - 1];
      if (lastSprint.end_date) {
        windowEnd = new Date(lastSprint.end_date);
        windowEnd.setHours(23, 59, 59, 999);
      } else if (relevantSprints.length === 2 && relevantSprints[1].start_date) {
        // If we have 2 sprints, calculate end date (assuming 1 week per sprint)
        windowEnd = new Date(relevantSprints[1].start_date);
        windowEnd.setDate(windowEnd.getDate() + 6); // Add 6 days for end of second sprint
        windowEnd.setHours(23, 59, 59, 999);
      } else {
        windowEnd = new Date(windowStart);
        windowEnd.setDate(windowStart.getDate() + 13); // 2 weeks
        windowEnd.setHours(23, 59, 59, 999);
      }
    }

    const relevantSprintIds = new Set(relevantSprints.map(s => s.id));

    return users.map(user => {
      const userEmail = (user.email || '').toLowerCase();

      // Get all stories assigned to this user
      const assignedStories = stories.filter(s => {
        const assigned = s.assigned_to || [];
        if (Array.isArray(assigned)) {
          return assigned.some(email => (email || '').toLowerCase() === userEmail);
        }
        return (assigned || '').toLowerCase() === userEmail;
      });

      // Calculate User Load (hours) = SUM(hours of stories assigned to user)
      // Convert story points to hours: 1 story point = 2 hours
      const userLoadHours = assignedStories.reduce((sum, story) => {
        const points = Number(story.story_points) || 0;
        return sum + (points * 2);
      }, 0);

      // Utilization % = (User Load ÷ 40) × 100
      const FIXED_CAPACITY_HOURS = 40;
      const rawWorkloadPercentage = (userLoadHours / FIXED_CAPACITY_HOURS) * 100;
      const workloadPercentage = Math.min(rawWorkloadPercentage, 100);

      let workloadLevel = 'optimal';
      if (rawWorkloadPercentage > 100) workloadLevel = 'overloaded';
      else if (rawWorkloadPercentage > 80) workloadLevel = 'high';
      else if (rawWorkloadPercentage < 20) workloadLevel = 'underutilized';

      // Get tasks for display purposes (active tasks count, etc.)
      const assignedTasks = tasks.filter(t =>
        (Array.isArray(t.assigned_to) && t.assigned_to.includes(user.email)) ||
        t.assigned_to === user.email
      );
      const activeTasks = assignedTasks.filter(t => ['todo', 'in_progress', 'review'].includes(t.status));
      const completedTasks = assignedTasks.filter(t => t.status === 'completed');

      // Count unique projects from stories
      const projectIds = new Set(assignedStories.map(s => s.project_id).filter(Boolean));
      const projectCount = projectIds.size;

      // Count unique sprints from stories
      const sprintIds = new Set(assignedStories.map(s => {
        const sprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
        return sprintId;
      }).filter(Boolean));
      const sprintCount = sprintIds.size;

      return {
        user,
        activeTasks: activeTasks.length,
        completedTasks: completedTasks.length,
        totalEstimatedHours: userLoadHours, // Using story hours as total estimated hours
        projectCount,
        sprintCount,
        workloadPercentage,
        workloadLevel,
        rawWorkloadPercentage
      };
    });
  }, [users, stories, tasks, sprints]);

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
          {/* Summary Cards */}
          <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar snap-x snap-mandatory">
            <Card className="min-w-[260px] flex-1 flex-shrink-0 snap-center bg-white/60 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Resources</p>
                    <p className="text-xl font-bold text-slate-900">{users.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[260px] flex-1 flex-shrink-0 snap-center bg-white/60 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Overloaded</p>
                    <p className="text-xl font-bold text-red-600">{overloadedUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[260px] flex-1 flex-shrink-0 snap-center bg-white/60 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Underutilized</p>
                    <p className="text-xl font-bold text-blue-600">{underutilizedUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[260px] flex-1 flex-shrink-0 snap-center bg-white/60 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Avg Workload</p>
                    <p className="text-xl font-bold text-slate-900">{avgWorkload.toFixed(0)}%</p>
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={resource.user.profile_image_url} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {getInitials(resource.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{resource.user.full_name || 'Unknown User'}</p>
                            <p className="text-sm text-slate-600 truncate">{resource.user.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                          <Badge variant="outline" className="whitespace-nowrap">
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
                              } border capitalize whitespace-nowrap`}
                          >
                            {resource.workloadLevel.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            Workload Capacity ({resource.totalEstimatedHours.toFixed(1)}h / 40h)
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
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