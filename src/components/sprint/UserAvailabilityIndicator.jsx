import React from "react";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarOff } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function UserAvailabilityIndicator({ userEmail, sprintStartDate, sprintEndDate, compact = false }) {
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['user-leaves', userEmail, sprintStartDate, sprintEndDate],
    queryFn: async () => {
      if (!userEmail || !sprintStartDate || !sprintEndDate) return [];
      
      const allLeaves = await groonabackend.entities.Leave.filter({ 
        user_email: userEmail,
        status: 'approved'
      });
      
      const sprintStart = parseISO(sprintStartDate);
      const sprintEnd = parseISO(sprintEndDate);
      
      return allLeaves.filter(leave => {
        const leaveStart = parseISO(leave.start_date);
        const leaveEnd = parseISO(leave.end_date);
        return (leaveStart <= sprintEnd && leaveEnd >= sprintStart);
      });
    },
    enabled: !!userEmail && !!sprintStartDate && !!sprintEndDate,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading || leaves.length === 0) return null;

  const totalDays = leaves.reduce((sum, leave) => sum + (leave.total_days || 0), 0);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            {/* CHANGED: Icon color to text-white for visibility on gradient headers */}
            <CalendarOff className="h-4 w-4 text-white" />
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div className="font-semibold">On Leave: {totalDays} days</div>
              {leaves.map(l => (
                <div key={l.id}>
                  {format(parseISO(l.start_date), 'MMM d')} - {format(parseISO(l.end_date), 'MMM d')}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 flex gap-1 items-center cursor-help">
            <CalendarOff className="h-3 w-3" />
            {totalDays} days off
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            {leaves.map(l => (
              <div key={l.id}>
                {l.leave_type_name}: {format(parseISO(l.start_date), 'MMM d')} - {format(parseISO(l.end_date), 'MMM d')}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

