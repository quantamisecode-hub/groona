import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Edit,
  Calendar as CalendarIcon,
  User as UserIcon,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  AlertCircle,
  Tag,
  BookOpen,
  Globe,
  ExternalLink,
  Layout,
  Flag,
  ListTodo,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import CreateStoryDialog from "./CreateStoryDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function StoryDetailDialog({ open, onClose, storyId, initialStory, readOnly = false, onStoryUpdate }) {
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { user: currentUser } = useUser();

  // Check if user is a viewer
  const isViewer = currentUser?.custom_role === 'viewer';

  const { data: story, isLoading } = useQuery({
    queryKey: ["story-detail", storyId],
    queryFn: async () => {
      if (!storyId) return null;
      let stories = await groonabackend.entities.Story.filter({ _id: storyId });
      if (!stories || stories.length === 0) {
        stories = await groonabackend.entities.Story.filter({ id: storyId });
      }
      return stories[0] || null;
    },
    enabled: !!storyId,
    initialData: initialStory,
    staleTime: initialStory ? 60 * 1000 : 0,
  });

  const { data: project } = useQuery({
    queryKey: ["project", story?.project_id],
    queryFn: async () => {
      if (!story?.project_id) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: story.project_id });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ id: story.project_id });
      }
      return projects[0] || null;
    },
    enabled: !!story?.project_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["story-assignees", story?.assigned_to],
    queryFn: async () => {
      if (!story?.assigned_to || story.assigned_to.length === 0) return [];
      if (allUsers.length > 0) {
        return allUsers.filter(u => story.assigned_to.includes(u.email));
      }
      const users = await groonabackend.entities.User.list();
      return users.filter(u => story.assigned_to.includes(u.email));
    },
    enabled: !!story?.assigned_to && story.assigned_to.length > 0,
  });

  const { data: storyTasks = [] } = useQuery({
    queryKey: ["story-tasks", storyId, story?.project_id],
    queryFn: async () => {
      if (!storyId || !story?.project_id) return [];
      const tasks = await groonabackend.entities.Task.filter({ project_id: story.project_id });
      return tasks.filter(t => {
        const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
        return String(taskStoryId) === String(storyId);
      });
    },
    enabled: !!storyId && !!story?.project_id,
  });


  const getStatusConfig = (status) => {
    const configs = {
      todo: {
        gradient: "from-slate-500 to-slate-600",
        label: "To Do",
        icon: Clock
      },
      in_progress: {
        gradient: "from-blue-500 to-blue-600",
        label: "In Progress",
        icon: Zap
      },
      in_review: {
        gradient: "from-amber-500 to-orange-600",
        label: "In Review",
        icon: Target
      },
      done: {
        gradient: "from-emerald-500 to-green-600",
        label: "Done",
        icon: CheckCircle2
      },
      blocked: {
        gradient: "from-red-500 to-red-600",
        label: "Blocked",
        icon: AlertCircle
      },
      cancelled: {
        gradient: "from-slate-400 to-slate-500",
        label: "Cancelled",
        icon: AlertCircle
      },
    };
    return configs[status] || configs.todo;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      low: { gradient: "from-blue-400 to-blue-500" },
      medium: { gradient: "from-amber-400 to-amber-500" },
      high: { gradient: "from-orange-400 to-orange-500" },
      urgent: { gradient: "from-red-400 to-red-500" },
    };
    return configs[priority] || configs.medium;
  };

  const handleEditClick = () => setShowEditDialog(true);

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
    queryClient.invalidateQueries({ queryKey: ["stories"] });
  };

  const handleStoryUpdateFromEdit = (updatedStory) => {
    if (updatedStory && storyId) {
      queryClient.setQueryData(["story-detail", storyId], updatedStory);
    }
    queryClient.invalidateQueries({ queryKey: ["story-detail", storyId] });
    if (onStoryUpdate) onStoryUpdate(updatedStory);
  };

  const renderDescription = (text) => {
    if (!text) return <p className="text-sm text-slate-400 italic">No description provided.</p>;

    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);

    if (hasHTML) {
      // Render HTML content safely
      return (
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    // Fallback to plain text rendering for non-HTML content
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      const isHeader = trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

      if (isHeader) {
        return (
          <div key={index} className="text-sm font-bold text-slate-900 mt-4 mb-1 tracking-wide">
            {line}
          </div>
        );
      }
      if (trimmed === "") {
        return <div key={index} className="h-2" />;
      }
      return (
        <div key={index} className="text-sm text-slate-700 leading-relaxed">
          {line}
        </div>
      );
    });
  };

  const renderAcceptanceCriteria = (text) => {
    if (!text) return null;

    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);

    if (hasHTML) {
      // Render HTML content safely with proper styling
      return (
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    // Fallback to plain text rendering for non-HTML content
    // Split by newlines and render each line with a checkmark
    return (
      <div className="text-sm text-slate-700 space-y-3">
        {text.split('\n').map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1 h-4 w-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
              </div>
              <span className="flex-1 leading-relaxed">{trimmed.replace(/^- /, '')}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading && !story) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-slate-600 font-medium mt-6">Loading story details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!story) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-10 w-10 text-slate-400 mb-3" />
            <DialogTitle>Story not found</DialogTitle>
            <p className="text-slate-500 mt-2">This story may have been deleted.</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(story.status);
  const priorityConfig = getPriorityConfig(story.priority);
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0">

          {/* Header */}
          <div className={`bg-gradient-to-r ${priorityConfig.gradient} p-6 text-white flex-shrink-0`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-inner border border-white/10">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white mb-1 drop-shadow-sm">
                    {story.title}
                  </DialogTitle>
                  <p className="text-white/90 text-sm font-medium flex items-center gap-1">
                    <Layout className="h-3 w-3" /> {project?.name || 'Project'}
                  </p>
                </div>
              </div>

              {!readOnly && !isViewer && (
                <Button
                  onClick={handleEditClick}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm mr-8 shadow-sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                <StatusIcon className="h-4 w-4 mr-1.5" />
                {statusConfig.label}
              </Badge>
              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                <Flag className="h-3 w-3 mr-1.5" />
                {story.priority.toUpperCase()}
              </Badge>
              {story.story_points > 0 && (
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                  {story.story_points} Points
                </Badge>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-50/80">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* LEFT COLUMN: Main Content + Comments */}
              <div className="lg:col-span-2 space-y-6">

                {/* Description */}
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-950">Description</h3>
                    </div>
                    <div className="pl-1">
                      {renderDescription(story.description)}
                    </div>
                  </CardContent>
                </Card>

                {/* Story Tasks */}
                {storyTasks.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                            <ListTodo className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-950">Tasks</h3>
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 font-mono">
                          {storyTasks.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {storyTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                          >
                            <ListTodo className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {task.status === 'todo' ? 'To Do' :
                                    task.status === 'in_progress' ? 'In Progress' :
                                      task.status === 'review' ? 'Review' : 'Done'}
                                </Badge>
                                {task.priority && (
                                  <Badge variant="outline" className="text-xs">
                                    {task.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Acceptance Criteria */}
                {story.acceptance_criteria && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Acceptance Criteria</span>
                    </div>
                    <CardContent className="p-4">
                      {renderAcceptanceCriteria(story.acceptance_criteria)}
                    </CardContent>
                  </Card>
                )}


              </div>

              {/* RIGHT COLUMN: Sidebar */}
              <div className="space-y-6">

                {/* Timeline & Assigned To */}
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <CalendarIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Timeline & Team</span>
                  </div>
                  <CardContent className="p-4 space-y-5">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Due Date</p>
                        <p className="text-sm font-bold text-slate-800">
                          {story.due_date ? format(parseISO(story.due_date), "MMM d, yyyy") : "None"}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Story Points</p>
                        <p className="text-sm font-bold text-slate-800">
                          {story.story_points || 0} pts
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Assigned To */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</span>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-300 font-mono">{assignees.length}</Badge>
                      </div>

                      {assignees.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {assignees.map((assignee) => (
                            <div
                              key={assignee.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all shadow-sm"
                            >
                              <Avatar className="h-8 w-8 border border-white shadow-sm ring-1 ring-slate-100">
                                <AvatarImage src={assignee.profile_image_url} />
                                <AvatarFallback className="text-[10px] bg-indigo-600 text-white font-bold">
                                  {(assignee.full_name?.substring(0, 2) || assignee.email?.substring(0, 2) || 'U').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{assignee.full_name || assignee.email || 'Unknown User'}</p>
                                <p className="text-[10px] text-slate-500 truncate">{assignee.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <UserIcon className="h-5 w-5 mx-auto text-slate-300 mb-1" />
                          <span className="text-xs text-slate-400">Unassigned</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Labels */}
                {story.labels && story.labels.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
                        <Tag className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">Labels</span>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex flex-col items-start gap-2">
                        {story.labels.map((label, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm w-full hover:bg-slate-50 transition-colors"
                          >
                            <div className="h-2 w-2 rounded-full bg-rose-400 ring-2 ring-rose-100" />
                            {label}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditDialog && story && (
        <CreateStoryDialog
          open={showEditDialog}
          onClose={handleCloseEditDialog}
          projectId={story.project_id}
          story={story}
          onSuccess={handleStoryUpdateFromEdit}
        />
      )}
    </>
  );
}


