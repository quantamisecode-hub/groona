import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  ZoomIn, 
  ZoomOut, 
  ChevronRight, 
  ChevronDown,
  Minus
} from "lucide-react";
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";

export default function GanttChart({ projects, tasks, users }) {
  const [zoomLevel, setZoomLevel] = useState("weekly"); // daily, weekly, monthly
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [selectedProject, setSelectedProject] = useState("all");

  // Filter projects and tasks
  const filteredProjects = selectedProject === "all" 
    ? projects.filter(p => p.start_date && p.deadline)
    : projects.filter(p => p.id === selectedProject && p.start_date && p.deadline);

  const filteredTasks = selectedProject === "all"
    ? tasks.filter(t => t.due_date && projects.find(p => p.id === t.project_id))
    : tasks.filter(t => t.project_id === selectedProject && t.due_date);

  // Calculate timeline range
  const { minDate, maxDate } = useMemo(() => {
    const allDates = [
      ...filteredProjects.map(p => new Date(p.start_date)),
      ...filteredProjects.map(p => new Date(p.deadline)),
      ...filteredTasks.map(t => new Date(t.due_date)),
    ].filter(d => !isNaN(d));

    if (allDates.length === 0) {
      const now = new Date();
      return { 
        minDate: startOfMonth(now), 
        maxDate: endOfMonth(addDays(now, 90)) 
      };
    }

    const min = new Date(Math.min(...allDates));
    const max = new Date(Math.max(...allDates));
    
    return {
      minDate: startOfMonth(addDays(min, -7)),
      maxDate: endOfMonth(addDays(max, 7))
    };
  }, [filteredProjects, filteredTasks]);

  // Generate time columns based on zoom level
  const timeColumns = useMemo(() => {
    if (zoomLevel === "daily") {
      return eachDayOfInterval({ start: minDate, end: maxDate });
    } else if (zoomLevel === "weekly") {
      return eachWeekOfInterval({ start: minDate, end: maxDate });
    } else {
      return eachMonthOfInterval({ start: minDate, end: maxDate });
    }
  }, [minDate, maxDate, zoomLevel]);

  const totalDays = differenceInDays(maxDate, minDate);
  const columnWidth = zoomLevel === "daily" ? 40 : zoomLevel === "weekly" ? 80 : 120;

  const toggleProject = (projectId) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const calculateBarPosition = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysFromStart = differenceInDays(start, minDate);
    const duration = differenceInDays(end, start) + 1;
    
    const left = (daysFromStart / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  const getStatusColor = (status) => {
    const colors = {
      planning: "bg-slate-400",
      todo: "bg-slate-500",
      active: "bg-blue-500",
      in_progress: "bg-blue-500",
      review: "bg-amber-500",
      on_hold: "bg-orange-500",
      completed: "bg-emerald-500",
    };
    return colors[status] || "bg-slate-400";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "border-blue-300",
      medium: "border-amber-300",
      high: "border-orange-400",
      urgent: "border-red-500",
    };
    return colors[priority] || "border-slate-300";
  };

  const getAssigneeName = (email) => {
    const user = users.find(u => u.email === email);
    return user ? user.full_name : "Unassigned";
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  if (filteredProjects.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Project Timeline - Gantt Chart
          </CardTitle>
          
          <div className="flex items-center gap-3">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.filter(p => p.start_date && p.deadline).map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <Button
                variant={zoomLevel === "daily" ? "default" : "ghost"}
                size="sm"
                onClick={() => setZoomLevel("daily")}
                className="h-8"
              >
                Day
              </Button>
              <Button
                variant={zoomLevel === "weekly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setZoomLevel("weekly")}
                className="h-8"
              >
                Week
              </Button>
              <Button
                variant={zoomLevel === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setZoomLevel("monthly")}
                className="h-8"
              >
                Month
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex h-[600px]">
          {/* Left Panel - Task List */}
          <div className="w-80 border-r border-slate-200 bg-slate-50/50">
            <div className="h-14 border-b border-slate-200 flex items-center px-4 bg-white sticky top-0 z-10">
              <span className="text-sm font-semibold text-slate-700">Projects & Tasks</span>
            </div>
            <ScrollArea className="h-[calc(600px-3.5rem)]">
              <div className="p-2 space-y-1">
                {filteredProjects.map(project => {
                  const projectTasks = filteredTasks.filter(t => t.project_id === project.id);
                  const isExpanded = expandedProjects.has(project.id);

                  return (
                    <div key={project.id}>
                      {/* Project Row */}
                      <div
                        className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white transition-colors cursor-pointer group"
                        onClick={() => toggleProject(project.id)}
                      >
                        {projectTasks.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          )
                        ) : (
                          <Minus className="h-4 w-4 text-slate-300 flex-shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {project.name}
                            </span>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {project.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {format(new Date(project.start_date), 'MMM d')} - {format(new Date(project.deadline), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>

                      {/* Task Rows */}
                      {isExpanded && projectTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 px-2 py-2 pl-8 rounded-lg hover:bg-white transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-700 truncate">
                                {task.title}
                              </span>
                              {task.priority && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs flex-shrink-0 ${
                                    task.priority === 'urgent' ? 'border-red-500 text-red-700' :
                                    task.priority === 'high' ? 'border-orange-500 text-orange-700' : ''
                                  }`}
                                >
                                  {task.priority}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                              {task.assigned_to && (
                                <span className="inline-flex items-center gap-1">
                                  • {getInitials(getAssigneeName(task.assigned_to))}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Timeline */}
          <div className="flex-1 overflow-x-auto">
            {/* Timeline Header */}
            <div className="h-14 border-b border-slate-200 bg-white sticky top-0 z-10">
              <div className="flex h-full" style={{ minWidth: `${timeColumns.length * columnWidth}px` }}>
                {timeColumns.map((date, index) => (
                  <div
                    key={index}
                    className="border-r border-slate-200 flex items-center justify-center px-2"
                    style={{ width: `${columnWidth}px` }}
                  >
                    <span className="text-xs font-medium text-slate-600">
                      {zoomLevel === "daily" && format(date, 'MMM d')}
                      {zoomLevel === "weekly" && format(date, 'MMM d')}
                      {zoomLevel === "monthly" && format(date, 'MMM yyyy')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Content */}
            <ScrollArea className="h-[calc(600px-3.5rem)]">
              <div style={{ minWidth: `${timeColumns.length * columnWidth}px` }}>
                <div className="relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex">
                    {timeColumns.map((_, index) => (
                      <div
                        key={index}
                        className="border-r border-slate-100"
                        style={{ width: `${columnWidth}px` }}
                      />
                    ))}
                  </div>

                  {/* Gantt Bars */}
                  <div className="relative space-y-1 p-2">
                    {filteredProjects.map(project => {
                      const projectTasks = filteredTasks.filter(t => t.project_id === project.id);
                      const isExpanded = expandedProjects.has(project.id);

                      return (
                        <div key={project.id}>
                          {/* Project Bar */}
                          <div className="h-10 relative">
                            <div
                              className={`absolute h-8 ${getStatusColor(project.status)} rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border-2 ${getPriorityColor(project.priority)} group`}
                              style={calculateBarPosition(project.start_date, project.deadline)}
                              title={`${project.name}\n${format(new Date(project.start_date), 'MMM d, yyyy')} - ${format(new Date(project.deadline), 'MMM d, yyyy')}\nStatus: ${project.status}\nProgress: ${project.progress || 0}%`}
                            >
                              {/* Progress Bar */}
                              <div 
                                className="absolute inset-0 bg-white/30 rounded-lg"
                                style={{ width: `${project.progress || 0}%` }}
                              />
                              
                              {/* Label - only show if bar is wide enough */}
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-xs font-semibold text-white truncate">
                                  {project.name}
                                </span>
                              </div>

                              {/* Tooltip on hover */}
                              <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-slate-900 text-white text-xs rounded-lg p-2 shadow-lg whitespace-nowrap">
                                <div className="font-semibold mb-1">{project.name}</div>
                                <div>{format(new Date(project.start_date), 'MMM d, yyyy')} - {format(new Date(project.deadline), 'MMM d, yyyy')}</div>
                                <div className="mt-1">Status: {project.status} • Progress: {project.progress || 0}%</div>
                              </div>
                            </div>
                          </div>

                          {/* Task Bars */}
                          {isExpanded && projectTasks.map(task => (
                            <div key={task.id} className="h-10 relative">
                              <div
                                className={`absolute h-6 ${getStatusColor(task.status)} rounded shadow-sm hover:shadow-md transition-shadow cursor-pointer border ${getPriorityColor(task.priority)} group`}
                                style={calculateBarPosition(task.due_date, task.due_date)}
                                title={`${task.title}\nDue: ${format(new Date(task.due_date), 'MMM d, yyyy')}\nAssigned: ${getAssigneeName(task.assigned_to)}\nStatus: ${task.status}`}
                              >
                                {/* Task Label - only show if wide enough */}
                                <div className="absolute inset-0 flex items-center px-1.5">
                                  <span className="text-xs text-white truncate">
                                    {task.title}
                                  </span>
                                </div>

                                {/* Tooltip on hover */}
                                <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-slate-900 text-white text-xs rounded-lg p-2 shadow-lg whitespace-nowrap">
                                  <div className="font-semibold mb-1">{task.title}</div>
                                  <div>Due: {format(new Date(task.due_date), 'MMM d, yyyy')}</div>
                                  <div className="mt-1">Assigned: {getAssigneeName(task.assigned_to)}</div>
                                  <div>Status: {task.status} • Priority: {task.priority || 'medium'}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Legend */}
        <div className="border-t border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-700">Status:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-slate-400"></div>
                <span>Planning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span>Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-500"></div>
                <span>Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-emerald-500"></div>
                <span>Completed</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-700">Priority:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border-2 border-red-500 bg-slate-200"></div>
                <span>Urgent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border-2 border-orange-400 bg-slate-200"></div>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
