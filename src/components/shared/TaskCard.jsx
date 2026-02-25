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
    if (!task.due_date) return null;

    const now = new Date();
    const due = new Date(task.due_date);
    // Use created_date if available, otherwise default to a 7-day window before due date for calculation
    const created = new Date(task.created_date || task._created_at || (due.getTime() - 7 * 24 * 60 * 60 * 1000));

    const total = due.getTime() - created.getTime();
    if (total <= 0) return { percentage: 100, color: "bg-red-500" };

    const elapsed = now.getTime() - created.getTime();
    let percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));

    // Status-based overrides to ensure visibility and accuracy
    if (task.status === 'completed') {
      percentage = 100;
    } else if (task.status === 'review') {
      percentage = Math.max(80, percentage);
    } else if (task.status === 'in_progress') {
      percentage = Math.max(20, percentage);
    }

    const remainingDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    let color = "bg-green-500";
    if (task.status === 'completed') {
      color = "bg-green-500";
    } else if (remainingDays < 1) {
      color = "bg-red-500";
    } else if (remainingDays < 3) {
      color = "bg-orange-500";
    }

    return { percentage, color };
  };

  const progressInfo = getProgressInfo();

  return (
    <>
      <Card
        className={`overflow-hidden bg-white border-slate-200 hover:shadow-xl hover:border-slate-300 transition-all duration-300 cursor-pointer group border-l-4 ${statusBorderColors[task.status]}`}
        onClick={handleCardClick}
      >
        <div
          className={`${headerGradients[task.priority]} p-3.5 relative overflow-hidden rounded-t-lg`}
          onClick={handleCardClick}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white rounded-full -translate-y-10 translate-x-10"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white rounded-full translate-y-8 -translate-x-8"></div>
          </div>

          <div className="relative z-10 space-y-2">
            <div className="flex-1 pr-16">
              <h4 className="font-bold text-white text-base leading-snug line-clamp-2 drop-shadow-sm mb-1.5">
                {task.title}
              </h4>
              {task.project_name && showProject && (
                <p className="text-white/80 text-[11px] font-medium">
                  📁 {task.project_name}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="bg-white/30 text-white border-white/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold rounded">
                {task.status === 'todo' ? '⏱️ To Do' :
                  task.status === 'in_progress' ? '⚡ In Progress' :
                    task.status === 'review' ? '👁️ Review' : '✅ Done'}
              </Badge>
              <Badge className="bg-white/30 text-white border-white/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold rounded">
                {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🟡' : '🔵'} {task.priority.toUpperCase()}
              </Badge>
              {task.task_type && (
                <Badge className="bg-white/30 text-white border-white/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold rounded transition-colors hover:bg-white/40">
                  {(() => {
                    const typeConfig = taskTypeIcons[task.task_type] || taskTypeIcons.task;
                    if (typeof typeConfig.icon === 'string') {
                      return <span className="mr-1">{typeConfig.icon}</span>;
                    }
                    const Icon = typeConfig.icon;
                    return <Icon className={cn("h-3 w-3 inline mr-0.5", typeConfig.color)} />;
                  })()}
                  {task.task_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Badge>
              )}
              {task.story_points > 0 && (
                <Badge className="bg-white/30 text-white border-white/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold rounded">
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

          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailDialog(true);
              }}
              className="h-7 w-7 text-white hover:bg-white/30 backdrop-blur-sm rounded-md"
              title="View Details"
            >
              <Eye className="h-3.5 w-3.5" />
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
                  className="h-7 w-7 text-white hover:bg-white/30 backdrop-blur-sm rounded-md"
                >
                  <Edit className="h-3.5 w-3.5" />
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
                  className="h-7 w-7 text-white hover:bg-red-500/30 backdrop-blur-sm rounded-md"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </PermissionGuard>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {progressInfo && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                <span>Progress</span>
                <span>{Math.round(progressInfo.percentage)}%</span>
              </div>
              <Progress
                value={progressInfo.percentage}
                className="h-1.5 bg-slate-100 border border-slate-200/50"
                indicatorClassName={cn("transition-all duration-500", progressInfo.color)}
              />
            </div>
          )}

          {task.description && (
            <div className="text-sm text-slate-600 line-clamp-1 leading-relaxed">
              {(() => {
                // Check if description contains HTML tags
                const hasHTML = /<[^>]+>/.test(task.description);

                if (hasHTML) {
                  // Render HTML content safely
                  return (
                    <div
                      className="prose prose-sm max-w-none prose-headings:text-slate-600 prose-p:text-slate-600 prose-strong:text-slate-700 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-600 prose-ol:text-slate-600 prose-li:text-slate-600 line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    />
                  );
                }

                // Fallback to ReactMarkdown for markdown content
                return (
                  <div className="[&>p]:inline">
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
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors">
                    <Lock className="h-3 w-3" />
                    Blocked by {task.dependencies.length} task{task.dependencies.length > 1 ? 's' : ''}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="bg-white text-slate-700 border-slate-200 shadow-xl w-[280px] p-0 z-50"
                  sideOffset={5}
                >
                  <div className="text-xs">
                    <div className="bg-amber-50 px-3 py-2 border-b border-amber-100 rounded-t-md">
                      <p className="font-semibold text-amber-800 flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Dependencies ({task.dependencies.length})
                      </p>
                    </div>
                    <div className="p-2 max-h-[200px] overflow-y-auto">
                      <ul className="space-y-1.5">
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
                            <li key={depId} className={`flex items-start gap-2 px-2 py-1 rounded ${isDone ? 'bg-green-50' : 'bg-slate-50'}`}>
                              <div className={`mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isDone ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div className="flex-1 min-w-0">
                                <span className={`block break-words font-medium leading-snug ${isDone ? 'text-green-700 line-through decoration-green-700/50' : 'text-slate-700'}`}>
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

          <div className="flex flex-wrap items-center gap-2">
            {task.estimated_hours && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium">{task.estimated_hours}h</span>
              </div>
            )}

            {task.due_date && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium">{format(new Date(task.due_date), 'MMM d')}</span>
              </div>
            )}

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
                <div className="flex items-center -space-x-2 hover:space-x-1 transition-all duration-300">
                  {assignees.map((email, idx) => {
                    const user = users.find(u => u.email === email);
                    const initials = user?.full_name ? getInitials(user.full_name) : getInitials(email?.split('@')[0] || '?');
                    return (
                      <TooltipProvider key={email + idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-6 w-6 border-2 border-white ring-1 ring-slate-100 cursor-default">
                              <AvatarImage src={user?.profile_image_url} />
                              <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700 font-medium">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs font-medium">{user?.full_name || email}</p>
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
            <div className="pt-2 border-t border-slate-200">
              <Link
                to={`${createPageUrl("ProjectDetail")}?id=${task.project_id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1 font-medium"
              >
                📁 {task.project_name}
              </Link>
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

