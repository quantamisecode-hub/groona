import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users, Clock, Filter, Target, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function TeamCalendar({ tasks = [], projects = [], leaves = [], users = [], sprints = [], milestones = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filters, setFilters] = useState({
    showTasks: true,
    showLeaves: true,
    showMilestones: true,
    showSprints: true,
    selectedProjects: [],
    selectedUsers: []
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const isEventVisible = (event) => {
    if (event.type === 'task' && !filters.showTasks) return false;
    if (event.type === 'leave' && !filters.showLeaves) return false;
    if (event.type === 'milestone' && !filters.showMilestones) return false;
    if (event.type === 'sprint' && !filters.showSprints) return false;

    if (filters.selectedProjects.length > 0 && event.project) {
      if (!filters.selectedProjects.includes(event.project)) return false;
    }

    if (filters.selectedUsers.length > 0) {
      if (event.type === 'task' && event.assignees) {
        if (!event.assignees.some(u => filters.selectedUsers.includes(u))) return false;
      }
      if (event.type === 'leave' && !filters.selectedUsers.includes(event.user)) return false;
    }

    return true;
  };

  const getEventsForDay = (day) => {
    let events = [];

    if (filters.showTasks) {
      tasks.forEach(task => {
        if (task.due_date && isSameDay(parseISO(task.due_date), day)) {
          const project = projects.find(p => p.id === task.project_id);
          events.push({
            type: 'task',
            title: task.title,
            project: task.project_id,
            projectName: project?.name,
            priority: task.priority,
            status: task.status,
            assignees: task.assigned_to || [],
            estimatedHours: task.estimated_hours,
            data: task
          });
        }
      });
    }

    if (filters.showLeaves) {
      leaves.forEach(leave => {
        const leaveStart = parseISO(leave.start_date);
        const leaveEnd = parseISO(leave.end_date);
        if (isWithinInterval(day, { start: leaveStart, end: leaveEnd })) {
          events.push({
            type: 'leave',
            title: leave.user_name + ' - ' + leave.leave_type,
            status: leave.status,
            user: leave.user_email,
            userName: leave.user_name,
            data: leave
          });
        }
      });
    }

    if (filters.showMilestones && milestones) {
      milestones.forEach(milestone => {
        if (milestone.due_date && isSameDay(parseISO(milestone.due_date), day)) {
          const project = projects.find(p => p.id === milestone.project_id);
          events.push({
            type: 'milestone',
            title: milestone.title,
            project: milestone.project_id,
            projectName: project?.name,
            status: milestone.status,
            data: milestone
          });
        }
      });
    }

    if (filters.showSprints && sprints) {
      sprints.forEach(sprint => {
        if (sprint.start_date && isSameDay(parseISO(sprint.start_date), day)) {
          const project = projects.find(p => p.id === sprint.project_id);
          events.push({
            type: 'sprint',
            title: sprint.name + ' starts',
            project: sprint.project_id,
            projectName: project?.name,
            isStart: true,
            data: sprint
          });
        }
        if (sprint.end_date && isSameDay(parseISO(sprint.end_date), day)) {
          const project = projects.find(p => p.id === sprint.project_id);
          events.push({
            type: 'sprint',
            title: sprint.name + ' ends',
            project: sprint.project_id,
            projectName: project?.name,
            isEnd: true,
            data: sprint
          });
        }
      });
    }

    return events.filter(isEventVisible);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300'
    };
    return colors[priority] || colors.medium;
  };

  const getEventColor = (event) => {
    if (event.type === 'task') {
      if (event.status === 'completed') return 'bg-green-100 text-green-700 border-green-300';
      return getPriorityColor(event.priority);
    }
    if (event.type === 'leave') {
      const colors = {
        approved: 'bg-purple-100 text-purple-700 border-purple-300',
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        rejected: 'bg-red-100 text-red-700 border-red-300'
      };
      return colors[event.status] || colors.pending;
    }
    if (event.type === 'milestone') {
      return event.status === 'completed' 
        ? 'bg-green-100 text-green-700 border-green-300'
        : 'bg-indigo-100 text-indigo-700 border-indigo-300';
    }
    if (event.type === 'sprint') {
      return 'bg-blue-100 text-blue-700 border-blue-300';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const selectedDayEvents = getEventsForDay(selectedDate);
  
  const selectedDayWorkload = selectedDayEvents
    .filter(e => e.type === 'task' && e.estimatedHours)
    .reduce((sum, e) => sum + (e.estimatedHours || 0), 0);

  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleProject = (projectId) => {
    setFilters(prev => ({
      ...prev,
      selectedProjects: prev.selectedProjects.includes(projectId)
        ? prev.selectedProjects.filter(id => id !== projectId)
        : [...prev.selectedProjects, projectId]
    }));
  };

  const toggleUser = (userEmail) => {
    setFilters(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userEmail)
        ? prev.selectedUsers.filter(email => email !== userEmail)
        : [...prev.selectedUsers, userEmail]
    }));
  };

  const clearFilters = () => {
    setFilters({
      showTasks: true,
      showLeaves: true,
      showMilestones: true,
      showSprints: true,
      selectedProjects: [],
      selectedUsers: []
    });
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Team Calendar
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold min-w-[140px] text-center">
                  {format(currentDate, "MMMM yyyy")}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Filter className="h-3 w-3 mr-2" />
                    Filters
                    {(filters.selectedProjects.length > 0 || filters.selectedUsers.length > 0) && (
                      <Badge className="ml-2 h-4 px-1 bg-blue-600 text-white">
                        {filters.selectedProjects.length + filters.selectedUsers.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-3 text-sm">Event Types</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="show-tasks" 
                            checked={filters.showTasks}
                            onCheckedChange={() => toggleFilter('showTasks')}
                          />
                          <Label htmlFor="show-tasks" className="text-sm cursor-pointer">
                            Tasks
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="show-milestones" 
                            checked={filters.showMilestones}
                            onCheckedChange={() => toggleFilter('showMilestones')}
                          />
                          <Label htmlFor="show-milestones" className="text-sm cursor-pointer">
                            Milestones
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="show-sprints" 
                            checked={filters.showSprints}
                            onCheckedChange={() => toggleFilter('showSprints')}
                          />
                          <Label htmlFor="show-sprints" className="text-sm cursor-pointer">
                            Sprints
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="show-leaves" 
                            checked={filters.showLeaves}
                            onCheckedChange={() => toggleFilter('showLeaves')}
                          />
                          <Label htmlFor="show-leaves" className="text-sm cursor-pointer">
                            Leaves
                          </Label>
                        </div>
                      </div>
                    </div>

                    {projects.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3 text-sm">Projects</h4>
                          <ScrollArea className="h-32">
                            <div className="space-y-2">
                              {projects.map(project => (
                                <div key={project.id} className="flex items-center gap-2">
                                  <Checkbox 
                                    id={'project-' + project.id}
                                    checked={filters.selectedProjects.includes(project.id)}
                                    onCheckedChange={() => toggleProject(project.id)}
                                  />
                                  <Label htmlFor={'project-' + project.id} className="text-sm cursor-pointer truncate">
                                    {project.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </>
                    )}

                    {users.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3 text-sm">Team Members</h4>
                          <ScrollArea className="h-32">
                            <div className="space-y-2">
                              {users.map(user => (
                                <div key={user.email} className="flex items-center gap-2">
                                  <Checkbox 
                                    id={'user-' + user.email}
                                    checked={filters.selectedUsers.includes(user.email)}
                                    onCheckedChange={() => toggleUser(user.email)}
                                  />
                                  <Label htmlFor={'user-' + user.email} className="text-sm cursor-pointer truncate">
                                    {user.full_name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </>
                    )}

                    <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                      Clear All Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-3 text-xs ml-auto">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-red-200 border border-red-300" />
                  <span className="text-slate-600">Urgent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-orange-200 border border-orange-300" />
                  <span className="text-slate-600">High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-purple-200 border border-purple-300" />
                  <span className="text-slate-600">Leave</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-indigo-200 border border-indigo-300" />
                  <span className="text-slate-600">Milestone</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map(day => {
              const events = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isDayToday = isToday(day);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={'min-h-[80px] p-2 rounded-lg border text-left transition-all ' +
                    (!isCurrentMonth ? 'bg-slate-50 text-slate-400 ' : 'bg-white ') +
                    (isDayToday ? 'border-blue-500 border-2 ' : 'border-slate-200 ') +
                    (isSelected ? 'ring-2 ring-blue-500 ' : '') +
                    'hover:shadow-md hover:border-blue-300'
                  }
                >
                  <div className={'text-sm font-semibold mb-1 ' + (isDayToday ? 'text-blue-600' : '')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {events.slice(0, 2).map((event, idx) => (
                      <div
                        key={idx}
                        className={'text-xs px-1.5 py-0.5 rounded truncate border ' + getEventColor(event)}
                        title={event.title}
                      >
                        {event.type === 'task' && (event.status === 'completed' ? '✓ ' : '• ')}
                        {event.type === 'leave' && '○ '}
                        {event.type === 'milestone' && '◆ '}
                        {event.type === 'sprint' && '▶ '}
                        {event.title.slice(0, 12)}
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-xs text-slate-500 pl-1 font-medium">
                        +{events.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-base">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
            {selectedDayWorkload > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-slate-600">
                  Total workload: <span className="font-semibold text-slate-900">{selectedDayWorkload}h</span>
                </span>
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No events on this day</p>
                <p className="text-xs mt-1">Select a different date or adjust filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((event, idx) => (
                  <Card key={idx} className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className={'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ' + (
                            event.type === 'task' ? 'bg-blue-50' :
                            event.type === 'leave' ? 'bg-purple-50' :
                            event.type === 'milestone' ? 'bg-indigo-50' : 
                            'bg-green-50'
                          )}>
                            {event.type === 'task' && (event.status === 'completed' ? '✓' : '•')}
                            {event.type === 'leave' && '○'}
                            {event.type === 'milestone' && '◆'}
                            {event.type === 'sprint' && '▶'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-semibold text-slate-900">
                                {event.title}
                              </h4>
                              {event.type === 'task' && event.status === 'completed' && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                            
                            {event.projectName && (
                              <div className="flex items-center gap-1 text-xs text-slate-600 mb-2">
                                <Target className="h-3 w-3" />
                                <span>{event.projectName}</span>
                              </div>
                            )}

                            {event.type === 'task' && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <Badge className={'text-xs ' + getPriorityColor(event.priority)}>
                                    {event.priority} priority
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {event.status}
                                  </Badge>
                                </div>
                                {event.estimatedHours && (
                                  <div className="flex items-center gap-1 text-xs text-slate-600">
                                    <Clock className="h-3 w-3" />
                                    <span>{event.estimatedHours}h estimated</span>
                                  </div>
                                )}
                                {event.assignees && event.assignees.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3 text-slate-600" />
                                    <div className="flex -space-x-2">
                                      {event.assignees.slice(0, 3).map((email, i) => {
                                        const user = users.find(u => u.email === email);
                                        return (
                                          <Avatar key={i} className="h-6 w-6 border-2 border-white">
                                            <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                              {getInitials(user?.full_name || email)}
                                            </AvatarFallback>
                                          </Avatar>
                                        );
                                      })}
                                      {event.assignees.length > 3 && (
                                        <div className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium">
                                          +{event.assignees.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {event.type === 'leave' && (
                              <div className="space-y-2">
                                <Badge className={getEventColor(event)}>
                                  {event.status}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-slate-600">
                                  <Users className="h-3 w-3" />
                                  <span>{event.userName}</span>
                                </div>
                              </div>
                            )}

                            {event.type === 'milestone' && (
                              <Badge className={getEventColor(event)}>
                                {event.status}
                              </Badge>
                            )}

                            {event.type === 'sprint' && (
                              <Badge className="bg-blue-100 text-blue-700">
                                {event.isStart ? 'Sprint Start' : 'Sprint End'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
