import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  User,
  Trash2,
  Edit,
  ExternalLink,
  Lock,
  Users,
  Bug,
  BookOpen,
  Wrench,
  Code,
  AlertTriangle,
  MoveRight,
  Clock,
  Eye
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PermissionGuard } from "./PermissionGuard";
import EditTaskDialog from "../tasks/EditTaskDialog";
import TaskDetailDialog from "../tasks/TaskDetailDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Progress } from "@/components/ui/progress";

const priorityColors = {
  low: "bg-blue-100 text-blue-600 border-blue-200",
  medium: "bg-amber-100 text-amber-600 border-amber-200",
  high: "bg-orange-100 text-orange-600 border-orange-200",
  urgent: "bg-red-100 text-red-600 border-red-200",
};

const statusBorderColors = {
  todo: "border-l-slate-400",
  in_progress: "border-l-blue-500",
  review: "border-l-purple-500",
  completed: "border-l-green-500",
};

const headerGradients = {
  low: "bg-gradient-to-r from-blue-500 to-blue-600",
  medium: "bg-gradient-to-r from-amber-500 to-amber-600",
  high: "bg-gradient-to-r from-orange-500 to-orange-600",
  urgent: "bg-gradient-to-r from-red-500 to-red-600",
};

const taskTypeIcons = {
  story: { icon: BookOpen, color: "text-blue-600" },
  bug: { icon: "🐛", color: "" },
  task: { icon: Wrench, color: "text-slate-600" },
  epic: { icon: AlertTriangle, color: "text-purple-600" },
  technical_debt: { icon: Code, color: "text-amber-600" },
};

export default function TaskCard({ task, onUpdate = null, onUpdateTask = null, onDelete = null, showProject = false, allTasks = [], extraBadge = null, readOnly = false }) {
  const handleUpdate = onUpdateTask || onUpdate || null;
  const handleDelete = onDelete || null;

  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch users to show avatars
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dependencyTasks = [], isLoading: dependenciesLoading } = useQuery({
    queryKey: ['dependency-tasks', task?.id, task?.dependencies],
    queryFn: async () => {
      if (!task?.dependencies || task.dependencies.length === 0) return [];
      const allProjectTasks = await groonabackend.entities.Task.filter({
        project_id: task.project_id
      });
      return allProjectTasks.filter(t => task.dependencies.includes(t.id));
    },
    enabled: !!task?.dependencies && task.dependencies.length > 0 && !!task.project_id,
    staleTime: 2 * 60 * 1000,
  });

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleCardClick = (e) => {
    if (e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('a')) {
      return;
    }
    setShowDetailDialog(true);
  };

  const onDeleteClick = () => {
    if (handleDelete) {
      handleDelete();
    }
    setShowDeleteDialog(false);
  };

  const getProgressInfo = () => {
    const status = (task.status || '').toLowerCase();

    // 1. Status-based overrides: If completed/done, progress is 100%
    if (status === 'completed' || status === 'done') {
      return { percentage: 100, color: "bg-green-500" };
    }

    // 2. Calculation based on subtasks completion
    if (task.subtasks && task.subtasks.length > 0) {
      const total = task.subtasks.length;
      const completed = task.subtasks.filter(s => s.completed).length;
      const percentage = (completed / total) * 100;

      let color = "bg-blue-500";
      if (percentage >= 100) color = "bg-green-500";
      else if (percentage > 50) color = "bg-indigo-500";
      else if (percentage > 0) color = "bg-blue-400";
      else color = "bg-slate-300";

      return { percentage, color };
    }

    // 3. Fallback to manually set task.progress
    if (task.progress !== undefined && task.progress !== null && task.progress > 0) {
      const percentage = Math.min(100, Math.max(0, task.progress));
      return {
        percentage,
        color: percentage === 100 ? "bg-green-500" : (percentage > 50 ? "bg-blue-500" : "bg-blue-400")
      };
    }

    // 4. Time-based calculation for tasks with due dates (if no other data)
    if (task.due_date) {
      const now = new Date();
      const due = new Date(task.due_date);
      const created = new Date(task.created_date || task._created_at || (due.getTime() - 7 * 24 * 60 * 60 * 1000));

      const totalTime = due.getTime() - created.getTime();
      if (totalTime > 0) {
        const elapsed = now.getTime() - created.getTime();
        const percentage = Math.min(95, Math.max(0, (elapsed / totalTime) * 100)); // Cap at 95% for time-based

        const remainingDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        let color = "bg-blue-300";
        if (remainingDays < 1) color = "bg-red-500";
        else if (remainingDays < 3) color = "bg-orange-500";

        return { percentage, color };
      }
    }

    return { percentage: 0, color: "bg-slate-300" };
  };

  const progressInfo = getProgressInfo();

  return (
    <>
      <Card
        className={`overflow-hidden bg-white border-slate-200/60 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-slate-300 transition-all duration-500 cursor-pointer group rounded-[22px] shadow-sm ${statusBorderColors[task.status]}`}
        onClick={handleCardClick}
      >
        <div
          className={`${headerGradients[task.priority]} p-4 relative overflow-hidden`}
          onClick={handleCardClick}
        >
          <div className="absolute inset-0 opacity-15">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white rounded-full translate-y-10 -translate-x-10 blur-xl"></div>
          </div>

          <div className="relative z-10 space-y-2.5">
            <div className="flex-1 pr-16">
              <h4 className="font-extrabold text-white text-[15px] leading-tight line-clamp-2 drop-shadow-md mb-2 tracking-tight">
                {task.title}
              </h4>
              {task.project_name && showProject && (
                <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest opacity-80 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  {task.project_name}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="bg-white/20 text-white border-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold rounded-full shadow-sm">
                {task.status === 'todo' ? '⏱️ TODO' :
                  task.status === 'in_progress' ? '⚡ ACTIVE' :
                    task.status === 'review' ? '👁️ REVIEW' : '✅ DONE'}
              </Badge>
              <Badge className="bg-white/20 text-white border-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold rounded-full shadow-sm capitalize">
                {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🟡' : '🔵'} {task.priority}
              </Badge>
              {task.task_type && (
                <Badge className="bg-white/20 text-white border-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold rounded-full shadow-sm transition-colors hover:bg-white/30 uppercase tracking-tighter">
                  {(() => {
                    const typeConfig = taskTypeIcons[task.task_type] || taskTypeIcons.task;
                    if (typeof typeConfig.icon === 'string') {
                      return <span className="mr-1">{typeConfig.icon}</span>;
                    }
                    const Icon = typeConfig.icon;
                    return <Icon className={cn("h-3 w-3 inline mr-1", typeConfig.color)} />;
                  })()}
                  {task.task_type.replace(/_/g, ' ')}
                </Badge>
              )}
              {task.story_points > 0 && (
                <Badge className="bg-white/20 text-white border-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold rounded-full shadow-sm">
                  ⭐ {task.story_points} SP
                </Badge>
              )}
              {extraBadge && (
                <div className="inline-block">
                  {extraBadge}
                </div>
              )}
            </div>
          </div>

          <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailDialog(true);
              }}
              className="h-8 w-8 text-white bg-white/10 hover:bg-white/30 backdrop-blur-md rounded-full shadow-lg"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>

            {handleUpdate && (
              <PermissionGuard permission="can_edit_task">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditDialog(true);
                  }}
                  className="h-8 w-8 text-white bg-white/10 hover:bg-white/30 backdrop-blur-md rounded-full shadow-lg"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </PermissionGuard>
            )}

            {handleDelete && (
              <PermissionGuard permission="can_delete_task">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="h-8 w-8 text-white bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md rounded-full shadow-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </PermissionGuard>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {progressInfo && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-extrabold uppercase tracking-[0.1em]">
                <span>Progress</span>
                <span>{Math.round(progressInfo.percentage)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                <div
                  className={cn("h-full transition-all duration-1000 ease-out rounded-full", progressInfo.color)}
                  style={{ width: `${progressInfo.percentage}%` }}
                />
              </div>
            </div>
          )}

          {task.description && (
            <div className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
              {(() => {
                const hasHTML = /<[^>]+>/.test(task.description);
                if (hasHTML) {
                  return (
                    <div
                      className="prose prose-sm max-w-none line-clamp-2 opacity-80"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    />
                  );
                }
                return (
                  <div className="[&>p]:inline opacity-80">
                    <ReactMarkdown>{task.description}</ReactMarkdown>
                  </div>
                );
              })()}
            </div>
          )}

          {task.dependencies && task.dependencies.length > 0 && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50/50 border border-amber-200/60 rounded-full text-amber-700 text-[10px] font-bold hover:bg-amber-100/50 transition-all shadow-sm">
                    <Lock className="h-3 w-3" />
                    BLOCKED BY {task.dependencies.length} TASK{task.dependencies.length > 1 ? 'S' : ''}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="bg-white text-slate-700 border-slate-200 shadow-2xl w-[280px] p-0 z-50 rounded-[16px] overflow-hidden"
                  sideOffset={8}
                >
                  <div className="text-xs">
                    <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
                      <p className="font-bold text-amber-800 flex items-center gap-2 uppercase tracking-tight">
                        <Lock className="h-3.5 w-3.5" />
                        Dependencies ({task.dependencies.length})
                      </p>
                    </div>
                    <div className="p-3 max-h-[200px] overflow-y-auto">
                      <ul className="space-y-2">
                        {dependenciesLoading ? (
                          <li className="text-slate-500 px-2 py-1 italic">Loading...</li>
                        ) : task.dependencies.map(depId => {
                          const depTask = dependencyTasks.find(t => t.id === depId || t.title === depId) ||
                            allTasks.find(t => t.id === depId || t.title === depId);

                          const isDone = depTask?.status === 'completed';
                          const displayTitle = depTask
                            ? depTask.title
                            : (depId.length > 20 || depId.includes(' ') ? depId : `Task #${depId.slice(0, 8)}`);

                          return (
                            <li key={depId} className={`flex items-start gap-2.5 px-3 py-2 rounded-[12px] ${isDone ? 'bg-green-50' : 'bg-slate-50'} border border-transparent hover:border-slate-200 transition-all`}>
                              <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 shadow-sm ${isDone ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div className="flex-1 min-w-0">
                                <span className={`block break-words font-semibold leading-tight ${isDone ? 'text-green-700 line-through decoration-green-700/50' : 'text-slate-700'}`}>
                                  {displayTitle}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex gap-3">
              {task.estimated_hours && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{task.estimated_hours}H</span>
                </div>
              )}

              {task.due_date && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(task.due_date), 'MMM d')}</span>
                </div>
              )}
            </div>

            {(() => {
              let assignees = [];
              if (Array.isArray(task.assigned_to)) {
                assignees = task.assigned_to.filter(Boolean);
              } else if (task.assigned_to && typeof task.assigned_to === 'string') {
                assignees = task.assigned_to.includes(',')
                  ? task.assigned_to.split(',').map(e => e.trim()).filter(Boolean)
                  : [task.assigned_to];
              }

              return assignees.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {assignees.map((email, idx) => {
                    const user = users.find(u => u.email === email);
                    const initials = user?.full_name ? getInitials(user.full_name) : getInitials(email?.split('@')[0] || '?');
                    return (
                      <TooltipProvider key={email + idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-7 w-7 border-2 border-white ring-1 ring-slate-100 shadow-sm transition-transform hover:-translate-y-1">
                              <AvatarImage src={user?.profile_image_url} />
                              <AvatarFallback className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="rounded-full px-3 py-1 font-bold">
                            <p className="text-[10px]">{user?.full_name || email}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {!showProject && task.project_name && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                to={`${createPageUrl("ProjectDetail")}?id=${task.project_id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5 font-bold uppercase tracking-wider"
              >
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                {task.project_name}
              </Link>
              <MoveRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteClick}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showEditDialog && (
        <EditTaskDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          task={task}
          onUpdate={handleUpdate}
        />
      )}

      {/* FIXED: PASSED onTaskUpdate to allow Detail view updates to bubble up */}
      <TaskDetailDialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        taskId={task.id}
        initialTask={task}
        readOnly={readOnly || !handleUpdate}
        onTaskUpdate={handleUpdate}
      />
    </>
  );
}

