import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle, MessageSquare, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DailyStandupView({ sprint, tasks }) {
  const navigate = useNavigate();
  const [expandedUsers, setExpandedUsers] = useState({});
  
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
  });
  
  const toggleUser = (email) => {
    setExpandedUsers(prev => ({ ...prev, [email]: !prev[email] }));
  };

  // Group tasks by assignee
  const tasksByUser = React.useMemo(() => {
    const grouped = {};
    
    tasks.forEach(task => {
      const assignees = Array.isArray(task.assigned_to) 
        ? task.assigned_to 
        : (task.assigned_to ? [task.assigned_to] : []);
      
      assignees.forEach(email => {
        if (!grouped[email]) {
          grouped[email] = {
            email,
            completed: [],
            inProgress: [],
            todo: [],
            blockers: []
          };
        }
        
        if (task.status === 'completed') {
          grouped[email].completed.push(task);
        } else if (task.status === 'in_progress') {
          grouped[email].inProgress.push(task);
        } else if (task.status === 'todo' || task.status === 'review') {
          grouped[email].todo.push(task);
        }
        
        // Check for blockers
        if (task.dependencies && task.dependencies.length > 0 && task.status !== 'completed') {
          const hasUnmetDependencies = task.dependencies.some(depId => {
            const depTask = tasks.find(t => t.id === depId);
            return depTask && depTask.status !== 'completed';
          });
          if (hasUnmetDependencies) {
            grouped[email].blockers.push(task);
          }
        }
      });
    });
    
    return Object.values(grouped);
  }, [tasks]);

  const getUserInfo = (email) => {
    const user = users.find(u => u.email === email);
    return {
      name: user?.full_name || email,
      image: user?.profile_image_url,
      initials: user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
    };
  };

  const handleTaskClick = (task) => {
    if (task.project_id) {
      navigate(`${createPageUrl("ProjectDetail")}?id=${task.project_id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-100">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Daily Standup - {sprint.name}</h3>
        <p className="text-slate-600">Quick standup status for {tasksByUser.length} team member{tasksByUser.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid gap-4">
        {tasksByUser.map((userTasks) => {
          const userInfo = getUserInfo(userTasks.email);
          const hasBlockers = userTasks.blockers.length > 0;
          const isExpanded = expandedUsers[userTasks.email];
          const totalTasks = userTasks.completed.length + userTasks.inProgress.length + userTasks.todo.length;
          
          return (
            <Card key={userTasks.email} className={`transition-all ${hasBlockers ? 'border-l-4 border-l-amber-500 bg-amber-50/30' : 'bg-white border-l-4 border-l-transparent'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={userInfo.image} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm">
                      {userInfo.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">{userInfo.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      {userTasks.inProgress.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <Clock className="h-3 w-3 mr-1" />
                          {userTasks.inProgress.length} active
                        </Badge>
                      )}
                      {userTasks.completed.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {userTasks.completed.length} done
                        </Badge>
                      )}
                      {hasBlockers && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {userTasks.blockers.length} blocked
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleUser(userTasks.email)}
                    className="ml-auto"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {/* Yesterday Section */}
                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <h5 className="font-semibold text-sm text-green-900">✅ Done Yesterday</h5>
                    </div>
                    {userTasks.completed.length > 0 ? (
                      <ul className="space-y-1.5">
                        {userTasks.completed.map(task => (
                          <li 
                            key={task.id} 
                            className="text-sm text-slate-700 flex items-center gap-2 group cursor-pointer hover:text-blue-600"
                            onClick={() => handleTaskClick(task)}
                          >
                            <span className="text-green-600">✓</span>
                            <span className="flex-1">{task.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600" />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No tasks completed yesterday</p>
                    )}
                  </div>

                  {/* Today Section */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <h5 className="font-semibold text-sm text-blue-900">🔨 Working On Today</h5>
                    </div>
                    {userTasks.inProgress.length > 0 ? (
                      <ul className="space-y-1.5">
                        {userTasks.inProgress.map(task => (
                          <li 
                            key={task.id} 
                            className="text-sm text-slate-700 flex items-center gap-2 group cursor-pointer hover:text-blue-600"
                            onClick={() => handleTaskClick(task)}
                          >
                            <span className="text-blue-600 font-bold">→</span>
                            <span className="flex-1">{task.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600" />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No active tasks</p>
                    )}
                  </div>

                  {/* Up Next Section */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-slate-600" />
                      <h5 className="font-semibold text-sm text-slate-900">📋 Up Next</h5>
                    </div>
                    {userTasks.todo.length > 0 ? (
                      <ul className="space-y-1.5">
                        {userTasks.todo.slice(0, 3).map(task => (
                          <li 
                            key={task.id} 
                            className="text-sm text-slate-600 flex items-center gap-2 group cursor-pointer hover:text-blue-600"
                            onClick={() => handleTaskClick(task)}
                          >
                            <span className="text-slate-400">○</span>
                            <span className="flex-1">{task.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600" />
                          </li>
                        ))}
                        {userTasks.todo.length > 3 && (
                          <li className="text-xs text-slate-500 ml-5">
                            +{userTasks.todo.length - 3} more tasks...
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No upcoming tasks</p>
                    )}
                  </div>

                  {/* Blockers Section */}
                  {hasBlockers && (
                    <div className="bg-amber-100 p-3 rounded-lg border-2 border-amber-300">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                        <h5 className="font-semibold text-sm text-amber-900">🚫 Blockers</h5>
                      </div>
                      <ul className="space-y-2">
                        {userTasks.blockers.map(task => {
                          const blockedBy = task.dependencies?.map(depId => {
                            const depTask = tasks.find(t => t.id === depId);
                            return depTask?.status !== 'completed' ? depTask?.title : null;
                          }).filter(Boolean);
                          
                          return (
                            <li 
                              key={task.id} 
                              className="text-sm cursor-pointer hover:bg-amber-200 p-2 rounded"
                              onClick={() => handleTaskClick(task)}
                            >
                              <div className="font-medium text-amber-900 flex items-center gap-2">
                                {task.title}
                                <ExternalLink className="h-3 w-3" />
                              </div>
                              <div className="text-xs text-amber-700 mt-1">
                                🔗 Blocked by: {blockedBy?.join(', ') || 'dependencies'}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {totalTasks === 0 && (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      No tasks assigned in this sprint
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {tasksByUser.length === 0 && (
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No team members with assigned tasks</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

