import React, { useState, useMemo } from "react";
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
  FolderKanban,
  Globe,
  ExternalLink,
  Layout,
  Flag,
  BookOpen,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import CreateEpicDialog from "./CreateEpicDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function EpicDetailDialog({ open, onClose, epicId, initialEpic, readOnly = false, onEpicUpdate, sprintId = null }) {
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { user: currentUser } = useUser();
  
  // Check if user is a viewer
  const isViewer = currentUser?.custom_role === 'viewer';

  const { data: epic, isLoading } = useQuery({
    queryKey: ["epic-detail", epicId],
    queryFn: async () => {
      if (!epicId) return null;
      let epics = await groonabackend.entities.Epic.filter({ _id: epicId });
      if (!epics || epics.length === 0) {
         epics = await groonabackend.entities.Epic.filter({ id: epicId });
      }
      return epics[0] || null;
    },
    enabled: !!epicId,
    initialData: initialEpic,
    staleTime: initialEpic ? 60 * 1000 : 0, 
  });

  const { data: project } = useQuery({
    queryKey: ["project", epic?.project_id],
    queryFn: async () => {
      if (!epic?.project_id) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: epic.project_id });
      if (!projects || projects.length === 0) {
         projects = await groonabackend.entities.Project.filter({ id: epic.project_id });
      }
      return projects[0] || null;
    },
    enabled: !!epic?.project_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => groonabackend.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: owner } = useQuery({
    queryKey: ["epic-owner", epic?.owner],
    queryFn: async () => {
      if (!epic?.owner) return null;
      if (allUsers.length > 0) {
        return allUsers.find(u => u.email === epic.owner) || null;
      }
      const users = await groonabackend.entities.User.list();
      return users.find(u => u.email === epic.owner) || null;
    },
    enabled: !!epic?.owner,
  });

  const { data: epicStories = [] } = useQuery({
    queryKey: ["epic-stories", epicId, epic?.project_id, sprintId],
    queryFn: async () => {
      if (!epicId || !epic?.project_id) return [];
      const stories = await groonabackend.entities.Story.filter({ project_id: epic.project_id });
      return stories.filter(s => {
        const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
        if (String(storyEpicId) !== String(epicId)) return false;
        
        // If sprintId is provided, only show stories in that sprint (or unassigned)
        if (sprintId) {
          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
          // Include unassigned stories (they appear in all sprint epics)
          if (!storySprintId) return true;
          return String(storySprintId) === String(sprintId);
        }
        
        // If no sprintId, show all stories in the epic
        return true;
      });
    },
    enabled: !!epicId && !!epic?.project_id,
  });

  // Calculate epic progress (only for stories in current sprint if sprintId provided)
  const epicProgress = useMemo(() => {
    if (epicStories.length === 0) return { percentage: 0, completed: 0, total: 0 };
    
    const totalPoints = epicStories.reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);
    const completedPoints = epicStories
      .filter(s => s.status === 'done')
      .reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);
    
    if (totalPoints === 0) return { percentage: 0, completed: 0, total: 0 };
    
    return {
      percentage: Math.round((completedPoints / totalPoints) * 100),
      completed: completedPoints,
      total: totalPoints
    };
  }, [epicStories]);

  const getStatusConfig = (status) => {
    const configs = {
      planning: { 
        gradient: "from-slate-500 to-slate-600",
        label: "Planning",
        icon: Clock
      },
      in_progress: { 
        gradient: "from-blue-500 to-blue-600",
        label: "In Progress",
        icon: Zap
      },
      on_hold: { 
        gradient: "from-amber-500 to-orange-600",
        label: "On Hold",
        icon: AlertCircle
      },
      completed: { 
        gradient: "from-emerald-500 to-green-600",
        label: "Completed",
        icon: CheckCircle2
      },
      cancelled: {
        gradient: "from-slate-400 to-slate-500",
        label: "Cancelled",
        icon: AlertCircle
      },
    };
    return configs[status] || configs.planning;
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
    queryClient.invalidateQueries({ queryKey: ["epic-detail", epicId] });
    queryClient.invalidateQueries({ queryKey: ["epics"] });
  };

  const handleEpicUpdateFromEdit = (updatedEpic) => {
    if (updatedEpic && epicId) {
        queryClient.setQueryData(["epic-detail", epicId], updatedEpic);
    }
    queryClient.invalidateQueries({ queryKey: ["epic-detail", epicId] });
    if (onEpicUpdate) onEpicUpdate(updatedEpic);
  };

  const renderDescription = (text) => {
    if (!text) return <p className="text-sm text-slate-400 italic">No description provided.</p>;
    
    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);
    
    if (hasHTML) {
      // Render HTML content safely
      return (
        <div 
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-ul:text-slate-700 prose-ol:text-slate-700 prose-li:text-slate-700"
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

  if (isLoading && !epic) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-slate-600 font-medium mt-6">Loading epic details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!epic) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
           <div className="flex flex-col items-center justify-center py-8 text-center">
             <AlertCircle className="h-10 w-10 text-slate-400 mb-3" />
             <DialogTitle>Epic not found</DialogTitle>
             <p className="text-slate-500 mt-2">This epic may have been deleted.</p>
             <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
           </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(epic.status);
  const priorityConfig = getPriorityConfig(epic.priority);
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
                  <FolderKanban className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white mb-1 drop-shadow-sm flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: epic.color || "#3b82f6" }}
                    />
                    {epic.name}
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
                {epic.priority.toUpperCase()}
              </Badge>
              {epicProgress.total > 0 && (
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                  {epicProgress.percentage}% Complete
                </Badge>
              )}
              {epicStories.length > 0 && (
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1.5 text-sm font-semibold shadow-sm">
                  {epicStories.length} {epicStories.length === 1 ? 'Story' : 'Stories'}
                </Badge>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-50/80">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* LEFT COLUMN: Main Content */}
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
                      {renderDescription(epic.description)}
                    </div>
                  </CardContent>
                </Card>

                {/* Epic Stories */}
                {epicStories.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-950">Stories</h3>
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 font-mono">
                          {epicStories.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {epicStories.map((story) => (
                          <div 
                            key={story.id || story._id} 
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                          >
                            <BookOpen className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{story.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {story.status === 'todo' ? 'To Do' : 
                                   story.status === 'in_progress' ? 'In Progress' :
                                   story.status === 'in_review' ? 'In Review' :
                                   story.status === 'done' ? 'Done' :
                                   story.status === 'blocked' ? 'Blocked' : 'Cancelled'}
                                </Badge>
                                {story.priority && (
                                  <Badge variant="outline" className="text-xs">
                                    {story.priority}
                                  </Badge>
                                )}
                                {story.story_points > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {story.story_points} pts
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

                {/* Progress */}
                {epicProgress.total > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-sm">
                          <Target className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-950">Progress</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 font-medium">Story Points</span>
                          <span className="text-slate-800 font-bold">
                            {epicProgress.completed} / {epicProgress.total} pts
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-cyan-600 h-3 rounded-full transition-all"
                            style={{ width: `${epicProgress.percentage}%` }}
                          />
                        </div>
                        <p className="text-sm text-slate-600 text-center font-medium">
                          {epicProgress.percentage}% Complete
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>

              {/* RIGHT COLUMN: Sidebar */}
              <div className="space-y-6">
                
                {/* Timeline & Owner */}
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <CalendarIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Timeline & Owner</span>
                  </div>
                  <CardContent className="p-4 space-y-5">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      {epic.start_date && (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Start Date</p>
                          <p className="text-sm font-bold text-slate-800">
                            {format(parseISO(epic.start_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Due Date</p>
                        <p className="text-sm font-bold text-slate-800">
                          {epic.due_date ? format(parseISO(epic.due_date), "MMM d, yyyy") : "None"}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Owner */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Owner</span>
                      </div>
                      
                      {owner ? (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all shadow-sm">
                          <Avatar className="h-8 w-8 border border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={owner.profile_image_url} />
                            <AvatarFallback className="text-[10px] bg-indigo-600 text-white font-bold">
                              {(owner.full_name?.substring(0,2) || owner.email?.substring(0,2) || 'U').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{owner.full_name || owner.email || 'Unknown User'}</p>
                            <p className="text-[10px] text-slate-500 truncate">{owner.email}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <UserIcon className="h-5 w-5 mx-auto text-slate-300 mb-1" />
                          <span className="text-xs text-slate-400">No owner</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Labels */}
                {epic.labels && epic.labels.length > 0 && (
                  <Card className="border-slate-200 shadow-sm bg-white">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                       <div className="h-6 w-6 rounded bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
                         <Tag className="h-3.5 w-3.5 text-white" />
                       </div>
                      <span className="text-sm font-bold text-slate-800">Labels</span>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex flex-col items-start gap-2">
                        {epic.labels.map((label, idx) => (
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

      {showEditDialog && epic && (
        <CreateEpicDialog
          open={showEditDialog}
          onClose={handleCloseEditDialog}
          projectId={epic.project_id}
          epic={epic}
          onSuccess={handleEpicUpdateFromEdit}
        />
      )}
    </>
  );
}

