import React, { useMemo } from "react";
import { differenceInBusinessDays, addDays } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertCircle, Info, ChevronDown } from "lucide-react";
import UserAvailabilityIndicator from "./UserAvailabilityIndicator";

export default function WorkloadView({
  sprintTasks = [],
  teamMembers = [],
  sprint = null,
  stories = [],
  allLeaves = []
}) {
  // Fixed capacity: Every team member has 40 hours per sprint
  const FIXED_CAPACITY_HOURS = 40;

  // Calculate workload per user based on stories assigned to them
  // Calculate workload per user based on tasks and stories assigned to them
  const workload = useMemo(() => {
    if (!sprint || (!sprintTasks.length && !stories.length)) {
      return teamMembers.map(user => ({
        user,
        points: 0,
        assignedHours: 0,
        capacityHours: FIXED_CAPACITY_HOURS,
        load: 0,
        status: 'healthy'
      }));
    }

    // Helpers
    const parseDate = (d) => {
      if (!d) return null;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    const sprintStart = parseDate(sprint.start_date);
    const sprintEnd = parseDate(sprint.end_date);

    // Get stories assigned to this sprint (Entity: Story)
    const assignedStories = stories.filter(s => {
      const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
      return String(storySprintId) === String(sprint.id);
    });

    return teamMembers.map(user => {
      // 1. Calculate Individual Capacity
      let userCapacityHours = FIXED_CAPACITY_HOURS; // Default

      if (sprintStart && sprintEnd) {
        // Calculate business days
        const businessDays = Math.max(0, differenceInBusinessDays(addDays(sprintEnd, 1), sprintStart));

        // Calculate leave days intersection
        let leaveDays = 0;
        const userLeaves = allLeaves.filter(l =>
          (l.user_email || '').toLowerCase() === (user.email || '').toLowerCase()
        );

        userLeaves.forEach(leave => {
          const lStart = parseDate(leave.start_date);
          const lEnd = parseDate(leave.end_date);
          if (lStart && lEnd) {
            const start = lStart > sprintStart ? lStart : sprintStart;
            const end = lEnd < sprintEnd ? lEnd : sprintEnd;
            if (start <= end) {
              const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
              leaveDays += days;
            }
          }
        });

        const effectiveDays = Math.max(0, businessDays - leaveDays);
        // Default 8h/day or override
        const hoursPerDay = sprint.capacity_override?.[user.email] !== undefined
          ? sprint.capacity_override[user.email]
          : 8;

        // Calculate capacity but cap at 40 hours maximum
        const calculatedCapacity = effectiveDays * hoursPerDay;
        userCapacityHours = Math.min(calculatedCapacity, FIXED_CAPACITY_HOURS);
      }

      // 2. Calculate Assigned Workload
      const userEmail = (user.email || '').toLowerCase();

      // Filter tasks for this user (Entity: Task)
      const userTasks = sprintTasks.filter(t => {
        const assigned = t.assigned_to || [];
        if (Array.isArray(assigned)) {
          return assigned.some(email => (email || '').toLowerCase() === userEmail);
        }
        return (assigned || '').toLowerCase() === userEmail;
      });

      // Filter stories for this user (Entity: Story)
      const userStories = assignedStories.filter(s => {
        const assigned = s.assigned_to || [];
        if (Array.isArray(assigned)) {
          return assigned.some(email => (email || '').toLowerCase() === userEmail);
        }
        return (assigned || '').toLowerCase() === userEmail;
      });

      // Calculate hours from tasks: prefer estimated_hours, split among assignees
      const taskHours = userTasks.reduce((acc, t) => {
        // If task has estimated_hours, use that (split among assignees)
        if (t.estimated_hours && Number(t.estimated_hours) > 0) {
          const assignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
          const assigneeCount = Math.max(assignees.length, 1);
          return acc + (Number(t.estimated_hours) / assigneeCount);
        }
        // Fall back to story_points conversion (1 point = 2 hours)
        const points = Number(t.story_points) || 0;
        return acc + (points * 2);
      }, 0);

      // Calculate hours from stories: use story_points conversion
      const storyHours = userStories.reduce((acc, s) => {
        const points = Number(s.story_points) || 0;
        return acc + (points * 2);
      }, 0);

      const assignedHours = taskHours + storyHours;
      
      // Calculate total points for display
      const taskPoints = userTasks.reduce((acc, t) => acc + (Number(t.story_points) || 0), 0);
      const storyPoints = userStories.reduce((acc, s) => acc + (Number(s.story_points) || 0), 0);
      const totalPoints = taskPoints + storyPoints;

      // Calculate workload percentage
      const capacity = userCapacityHours > 0 ? userCapacityHours : 1; // Prevent division by zero
      const load = (assignedHours / capacity) * 100;

      // Determine status based on thresholds
      let status = 'healthy';
      if (load < 60) {
        status = 'underloaded';
      } else if (load > 100) {
        status = 'overloaded';
      }

      return {
        user,
        points: totalPoints,
        assignedHours,
        capacityHours: Math.round(userCapacityHours),
        load,
        status
      };
    });
  }, [teamMembers, sprint, stories, sprintTasks, allLeaves]);

  if (!sprint || !stories.length) {
    return (
      <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
        <p>Assign stories to the sprint to see workload here.</p>
      </div>
    );
  }

  const getInitials = (name) => (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getStatusColor = (status) => {
    switch (status) {
      case 'overloaded':
        return 'bg-red-500';
      case 'healthy':
        return 'bg-green-500';
      case 'underloaded':
        return 'bg-blue-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'overloaded':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Overloaded</Badge>;
      case 'healthy':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Healthy</Badge>;
      case 'underloaded':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Underloaded</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-500 px-4">
        <div className="col-span-4">Team Member</div>
        <div className="col-span-2 text-center">Assigned Hours</div>
        <div className="col-span-2 text-center">Capacity</div>
        <div className="col-span-4">Workload</div>
      </div>

      {workload.map((item) => (
        <Card key={item.user.id} className="border-slate-200">
          <div className="p-3 grid grid-cols-12 gap-4 items-center">
            <div className="col-span-4 flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={item.user.profile_image_url} />
                <AvatarFallback>{getInitials(item.user.full_name)}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-slate-900 truncate">{item.user.full_name}</span>
            </div>

            <div className="col-span-2 text-center">
              <div className="font-medium text-slate-900">
                {item.assignedHours.toFixed(1)}h
              </div>
              <div className="text-xs text-slate-500">
                ({item.points} pts)
              </div>
            </div>

            <div className="col-span-2 text-center text-slate-500">
              {item.capacityHours}h
            </div>

            <div className="col-span-4 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getStatusColor(item.status)}`}
                  style={{ width: `${Math.min(100, item.load)}%` }}
                />
              </div>

              <span className="text-sm font-medium text-slate-700 min-w-[50px] text-right">
                {item.load.toFixed(1)}%
              </span>

              {getStatusBadge(item.status)}

              {sprint && (
                <UserAvailabilityIndicator
                  userEmail={item.user.email}
                  sprintStartDate={sprint.start_date}
                  sprintEndDate={sprint.end_date}
                  compact={true}
                />
              )}

              {item.status === 'overloaded' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This team member is over capacity.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Info Guide */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Card className="bg-white border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-slate-600 flex-shrink-0" />
                  <h4 className="font-semibold text-slate-900">How Workload is Calculated</h4>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-600" />
              </div>
            </CardContent>
          </Card>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <div className="p-4 space-y-3">
            <div className="text-sm space-y-2">
              <p><strong>Capacity Calculation:</strong> Based on Sprint duration minus Leave days (8h/day), capped at 40 hours maximum.</p>
              <p><strong>Workload Calculation:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Tasks with <strong>estimated_hours</strong>: Uses estimated hours directly (split among assignees if multiple)</li>
                <li>Tasks/Stories with <strong>story_points</strong>: Converts to hours (1 Story Point = 2 hours)</li>
                <li>If both exist, <strong>estimated_hours</strong> takes priority</li>
              </ul>
              <p><strong>Utilization Formula:</strong> Workload % = (Total Assigned Hours ÷ User Capacity) × 100</p>
              <p className="mt-2"><strong>Example:</strong> If a team member has:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Task with 20h estimated (solo) = 20 hours</li>
                <li>Stories totaling 10 points = 20 hours</li>
                <li>Total = 40 hours</li>
                <li>Workload = 40 ÷ 40 × 100 = 100%</li>
              </ul>
              <p className="mt-2"><strong>Status Thresholds:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>&lt; 60%: <span className="font-medium">Underloaded</span></li>
                <li>60% – 100%: <span className="font-medium">Healthy</span></li>
                <li>&gt; 100%: <span className="font-medium">Overloaded</span></li>
              </ul>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}