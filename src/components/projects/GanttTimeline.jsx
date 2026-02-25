import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Calendar, AlertCircle } from "lucide-react";

export default function GanttTimeline({ tasks, projects }) {
  const timelineData = useMemo(() => {
    if (!tasks.length) return { tasks: [], dateRange: [], startDate: new Date(), endDate: new Date() };

    // Find date range
    const tasksWithDates = tasks.filter(t => t.due_date);
    if (!tasksWithDates.length) return { tasks: [], dateRange: [], startDate: new Date(), endDate: new Date() };

    const dates = tasksWithDates.map(t => new Date(t.due_date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    const startDate = startOfMonth(minDate);
    const endDate = endOfMonth(maxDate);
    const totalDays = differenceInDays(endDate, startDate) + 1;
    
    // Generate date range for header
    const dateRange = [];
    for (let i = 0; i < totalDays; i++) {
      dateRange.push(addDays(startDate, i));
    }

    // Process tasks with positioning
    const processedTasks = tasks
      .filter(t => t.due_date)
      .map(task => {
        const taskDate = new Date(task.due_date);
        const daysFromStart = differenceInDays(taskDate, startDate);
        const position = (daysFromStart / totalDays) * 100;
        
        // Estimate task duration (default 1 day if not specified)
        const duration = task.estimated_hours ? Math.ceil(task.estimated_hours / 8) : 1;
        const width = (duration / totalDays) * 100;
        
        return {
          ...task,
          position,
          width: Math.max(width, 2), // Minimum 2% width for visibility
          isOverdue: new Date() > taskDate && task.status !== 'completed',
        };
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    return {
      tasks: processedTasks,
      dateRange,
      startDate,
      endDate,
      totalDays,
    };
  }, [tasks]);

  const getProjectName = (projectId) => {
    const project = projects?.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const statusColors = {
    todo: 'bg-slate-400',
    in_progress: 'bg-blue-500',
    review: 'bg-purple-500',
    completed: 'bg-green-500',
  };

  if (!timelineData.tasks.length) {
    return (
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardContent className="p-12 text-center">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="font-semibold text-slate-900 mb-2">No Timeline Data</h3>
          <p className="text-slate-600">Add due dates to tasks to see the Gantt timeline</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-600" />
          Project Timeline (Gantt View)
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">
          {format(timelineData.startDate, 'MMM d, yyyy')} - {format(timelineData.endDate, 'MMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Timeline Header */}
            <div className="flex border-b border-slate-200 pb-2 mb-4">
              <div className="w-64 flex-shrink-0 pr-4">
                <p className="text-sm font-semibold text-slate-700">Task</p>
              </div>
              <div className="flex-1 relative">
                <div className="flex">
                  {timelineData.dateRange
                    .filter((_, i) => i % 7 === 0) // Show weekly markers
                    .map((date, index) => (
                      <div
                        key={index}
                        className="flex-1 text-xs text-slate-600"
                      >
                        {format(date, 'MMM d')}
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Timeline Rows */}
            <div className="space-y-3">
              {timelineData.tasks.map((task) => (
                <div key={task.id} className="flex items-center group">
                  <div className="w-64 flex-shrink-0 pr-4">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {getProjectName(task.project_id)}
                    </p>
                  </div>
                  <div className="flex-1 relative h-10">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: Math.ceil(timelineData.totalDays / 7) }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 border-r border-slate-100"
                        />
                      ))}
                    </div>
                    
                    {/* Task bar */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
                      style={{
                        left: `${task.position}%`,
                        width: `${task.width}%`,
                      }}
                    >
                      <div
                        className={`h-full rounded-lg flex items-center px-2 ${
                          statusColors[task.status]
                        } ${task.isOverdue ? 'ring-2 ring-red-500' : ''}`}
                      >
                        <span className="text-xs text-white font-medium truncate">
                          {task.isOverdue && (
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                          )}
                          {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      </div>
                      
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl whitespace-nowrap">
                          <p className="font-semibold mb-1">{task.title}</p>
                          <p>Due: {format(new Date(task.due_date), 'MMM d, yyyy')}</p>
                          <p>Status: <Badge className="ml-1" variant="outline">{task.status}</Badge></p>
                          {task.assigned_to && <p className="mt-1">Assigned: {task.assigned_to}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Today marker */}
            <div className="relative mt-4">
              <div className="flex">
                <div className="w-64 flex-shrink-0" />
                <div className="flex-1 relative h-px">
                  {(() => {
                    const today = new Date();
                    const daysFromStart = differenceInDays(today, timelineData.startDate);
                    const position = (daysFromStart / timelineData.totalDays) * 100;
                    
                    if (position >= 0 && position <= 100) {
                      return (
                        <div
                          className="absolute top-0 bottom-0"
                          style={{ left: `${position}%` }}
                        >
                          <div className="w-px bg-red-500 h-full relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                              Today
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-700">Status:</p>
              {Object.entries(statusColors).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${color}`} />
                  <span className="text-sm text-slate-600 capitalize">
                    {status.replace('_', ' ')}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-slate-600">Overdue</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}