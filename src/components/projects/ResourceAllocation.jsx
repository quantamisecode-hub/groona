import React, { useMemo, useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/components/shared/UserContext";
import StatsCard from "../dashboard/StatsCard";

export default function ResourceAllocation({ showSummaryOnly = false, showResourceListOnly = false, highlightUserId = null }) {
  // Use global user context instead of local state to prevent loading spinner on every visit
  const { user: currentUser, effectiveTenantId } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();

  // Temporary highlighting state
  const [activeHighlightId, setActiveHighlightId] = useState(null);

  useEffect(() => {
    if (highlightUserId) {
      setActiveHighlightId(highlightUserId);

      // Scroll to the highlighted element quickly
      setTimeout(() => {
        const el = document.getElementById(`resource-card-${highlightUserId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);

      // Remove highlighting after 8 seconds
      const timer = setTimeout(() => {
        setActiveHighlightId(null);
        // Clean URL
        const newParams = new URLSearchParams(searchParams);
        if (newParams.has('highlightUser')) {
          newParams.delete('highlightUser');
          setSearchParams(newParams, { replace: true });
        }
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [highlightUserId, searchParams, setSearchParams]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
            <StatsCard
              title="Total Resources"
              value={users.length}
              icon={Users}
              iconColor="text-blue-600"
            />
            <StatsCard
              title="Overloaded"
              value={overloadedUsers.length}
              icon={AlertTriangle}
              iconColor="text-red-600"
            />
            <StatsCard
              title="Underutilized"
              value={underutilizedUsers.length}
              icon={CheckCircle2}
              iconColor="text-green-600"
            />
            <StatsCard
              title="Avg Workload"
              value={`${avgWorkload.toFixed(0)}%`}
              icon={TrendingUp}
              iconColor="text-purple-600"
            />
          </div>
        </div>
      )}

      {!showSummaryOnly && (
        <div className="space-y-6">
          {/* Resource List */}
          <Card className="bg-white border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[28px] overflow-hidden">
            <CardHeader className="px-6 py-5 border-b border-slate-100/60 bg-slate-50/30">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Users className="h-5 w-5 text-blue-500" />
                Resource Allocation Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {users.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No team members found for this organization.
                </div>
              ) : (
                <div className="space-y-4">
                  {resourceData.map((resource) => {
                    const isHighlighted = resource.user._id === activeHighlightId;
                    const isCritical = isHighlighted && resource.rawWorkloadPercentage > 120;

                    const cardClass = isCritical
                      ? "p-5 sm:p-6 rounded-2xl border border-red-100 bg-red-50/50 hover:bg-red-50 transition-all duration-300 shadow-sm"
                      : isHighlighted
                        ? "p-5 sm:p-6 rounded-2xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-all duration-300 shadow-sm"
                        : "p-5 sm:p-6 rounded-2xl border border-slate-100/60 bg-white hover:border-slate-200/80 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300";

                    return (
                      <div
                        key={resource.user.email}
                        id={`resource-card-${resource.user._id}`}
                        className={cardClass}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <Avatar className="h-12 w-12 flex-shrink-0 relative shadow-sm border border-slate-100">
                              {isHighlighted && (
                                <div className="absolute -top-1 -right-1 z-10">
                                  <AlertTriangle className={`h-4 w-4 animate-pulse ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
                                </div>
                              )}
                              <AvatarImage src={resource.user.profile_image_url} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium">
                                {getInitials(resource.user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[16px] font-semibold text-slate-900 tracking-tight truncate">
                                {resource.user.full_name || 'Unknown User'}
                              </p>
                              <p className="text-[13px] font-medium text-slate-500 truncate mt-0.5">
                                {resource.user.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 font-medium px-3 py-1 text-xs">
                              {resource.activeTasks} Active Tasks
                            </Badge>
                            <Badge
                              className={`${resource.workloadLevel === 'overloaded'
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : resource.workloadLevel === 'high'
                                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                                  : resource.workloadLevel === 'underutilized'
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : 'bg-green-50 text-green-600 border-green-100'
                                } border capitalize font-medium px-3 py-1 shadow-none text-xs`}
                            >
                              {resource.workloadLevel.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-slate-500">
                              Workload Capacity <span className="text-slate-400 font-normal ml-1">({resource.totalEstimatedHours.toFixed(1)}h / 40h)</span>
                            </span>
                            <span className="text-[14px] font-semibold text-slate-900 tracking-tight">
                              {resource.rawWorkloadPercentage.toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={resource.workloadPercentage}
                            className="h-2.5 bg-slate-100 rounded-full overflow-hidden"
                            indicatorClassName={`${workloadColors[resource.workloadLevel]} rounded-full transition-all duration-700 ease-in-out`}
                          />
                        </div>

                        <div className="flex flex-wrap gap-6 sm:gap-12 mt-6 pt-5 border-t border-slate-100/60">
                          <div className="flex flex-col">
                            <span className="text-[12px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Active Tasks</span>
                            <span className="text-xl font-bold text-slate-800">{resource.activeTasks}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[12px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Completed</span>
                            <span className="text-xl font-bold text-slate-800">{resource.completedTasks}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[12px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Projects</span>
                            <span className="text-xl font-bold text-slate-800">{resource.projectCount}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[12px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Sprints</span>
                            <span className="text-xl font-bold text-slate-800">{resource.sprintCount}</span>
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
      )}
    </>
  );
}