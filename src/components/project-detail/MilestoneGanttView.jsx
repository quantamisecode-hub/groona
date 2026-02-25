import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, startOfMonth, endOfMonth, addMonths, eachMonthOfInterval } from "date-fns";
import { Flag, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";

export default function MilestoneGanttView({ milestones = [], onMilestoneClick }) {
  if (milestones.length === 0) {
    return (
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500">No milestones to display</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate date range
  const dates = milestones.map(m => new Date(m.start_date || m.due_date));
  const minDate = startOfMonth(new Date(Math.min(...dates)));
  const maxDate = endOfMonth(addMonths(new Date(Math.max(...dates)), 1));
  const totalDays = differenceInDays(maxDate, minDate);
  
  // Generate months for header
  const months = eachMonthOfInterval({ start: minDate, end: maxDate });

  const statusColors = {
    pending: { bg: "bg-slate-400", text: "text-slate-700" },
    in_progress: { bg: "bg-blue-500", text: "text-blue-700" },
    completed: { bg: "bg-green-500", text: "text-green-700" },
    missed: { bg: "bg-red-500", text: "text-red-700" },
  };

  const getBarPosition = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startOffset = differenceInDays(start, minDate);
    const duration = differenceInDays(end, start) || 1;
    
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`
    };
  };

  // Sort milestones by start date
  const sortedMilestones = [...milestones].sort((a, b) => {
    const dateA = new Date(a.start_date || a.due_date);
    const dateB = new Date(b.start_date || b.due_date);
    return dateA - dateB;
  });

  return (
    <div className="space-y-4">
      {/* Timeline Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex border-b bg-slate-50">
            <div className="w-64 p-4 border-r font-semibold text-sm text-slate-700 flex items-center">
              <Flag className="w-4 h-4 mr-2" />
              Milestone
            </div>
            <div className="flex-1 relative">
              <div className="flex">
                {months.map((month, idx) => {
                  const monthDays = differenceInDays(endOfMonth(month), startOfMonth(month));
                  const width = (monthDays / totalDays) * 100;
                  
                  return (
                    <div
                      key={idx}
                      style={{ width: `${width}%` }}
                      className="border-r last:border-r-0 p-2 text-center"
                    >
                      <div className="text-xs font-semibold text-slate-700">
                        {format(month, "MMM yyyy")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Gantt Rows */}
          <div className="divide-y">
            {sortedMilestones.map((milestone, idx) => {
              const position = getBarPosition(
                milestone.start_date || milestone.due_date,
                milestone.due_date
              );
              const colors = statusColors[milestone.status];
              const hasDependencies = milestone.dependencies && milestone.dependencies.length > 0;

              return (
                <div key={milestone.id} className="flex hover:bg-slate-50 transition-colors">
                  <div className="w-64 p-4 border-r">
                    <div className="flex items-start gap-2">
                      {milestone.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Flag className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => onMilestoneClick && onMilestoneClick(milestone)}
                          className="text-sm font-medium text-slate-900 hover:text-blue-600 text-left truncate block w-full"
                        >
                          {milestone.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-xs ${colors.text} bg-opacity-20`}>
                            {milestone.status.replace('_', ' ')}
                          </Badge>
                          {milestone.progress > 0 && (
                            <span className="text-xs text-slate-500">{milestone.progress}%</span>
                          )}
                        </div>
                        {hasDependencies && (
                          <div className="flex items-center gap-1 mt-1">
                            <TrendingUp className="w-3 h-3 text-amber-500" />
                            <span className="text-xs text-amber-600">
                              {milestone.dependencies.length} dep.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 relative p-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            style={position}
                            className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-lg ${colors.bg} shadow-sm hover:shadow-md transition-all cursor-pointer group`}
                          >
                            <div className="absolute inset-0 rounded-lg overflow-hidden">
                              <div
                                className="h-full bg-white bg-opacity-30"
                                style={{ width: `${milestone.progress}%` }}
                              />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              {milestone.progress}%
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-xs space-y-1">
                            <p className="font-semibold">{milestone.name}</p>
                            {milestone.description && (
                              <p className="text-slate-400">{milestone.description}</p>
                            )}
                            <div className="pt-1 space-y-0.5">
                              {milestone.start_date && (
                                <p>Start: {format(new Date(milestone.start_date), "MMM d, yyyy")}</p>
                              )}
                              <p>Due: {format(new Date(milestone.due_date), "MMM d, yyyy")}</p>
                              <p>Progress: {milestone.progress}%</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Dependency Lines */}
                    {hasDependencies && (
                      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {milestone.dependencies.map(depId => {
                          const depMilestone = sortedMilestones.find(m => m.id === depId);
                          if (!depMilestone) return null;
                          
                          const depIdx = sortedMilestones.indexOf(depMilestone);
                          const currentIdx = idx;
                          
                          if (depIdx < currentIdx) {
                            // Draw line from dependency to current
                            return (
                              <div
                                key={depId}
                                className="absolute h-0.5 bg-amber-400 opacity-50"
                                style={{
                                  top: '50%',
                                  left: position.left,
                                  width: '20px',
                                  transform: 'translateX(-20px)'
                                }}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-400"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-amber-500" />
          <span>Has Dependencies</span>
        </div>
      </div>
    </div>
  );
}