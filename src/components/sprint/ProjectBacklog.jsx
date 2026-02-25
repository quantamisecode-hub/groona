import React, { useState } from "react";
import { Search, Plus, BookOpen, ListTodo, ChevronDown, ChevronRight, Calendar, Users, Edit, Trash2, MoreVertical, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import CreateTaskModal from "@/components/tasks/CreateTaskModal";
import CreateStoryDialog from "@/components/stories/CreateStoryDialog";

export default function ProjectBacklog({
  tasks = [],
  stories = [],
  sprints = [],
  users = [],
  onMoveTask,
  projectId,
  onTaskCreated,
  onUpdate,
  onDelete,
  onTaskClick,
  onStoryClick
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [expandedStories, setExpandedStories] = useState(new Set());
  const [itemToDelete, setItemToDelete] = useState(null);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getStoryProgress = (storyId) => {
    const storyTasks = tasks.filter(t => {
      const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
      return String(taskStoryId) === String(storyId);
    });

    if (storyTasks.length === 0) return { percentage: 0, completed: 0, total: 0 };
    const completedTasks = storyTasks.filter(t => t.status === 'completed' || t.status === 'done');
    return {
      percentage: Math.round((completedTasks.length / storyTasks.length) * 100),
      completed: completedTasks.length,
      total: storyTasks.length
    };
  };

  const toggleStoryExpansion = (storyId) => {
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
    }
    setExpandedStories(newExpanded);
  };

  // Filter unassigned stories
  const backlogStories = stories.filter(s => {
    const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
    return !storySprintId || storySprintId === 'null' || storySprintId === '';
  });

  // Filter tasks: unassigned to sprint
  const backlogTasks = tasks.filter(t => {
    const taskSprintId = t.sprint_id?.id || t.sprint_id?._id || t.sprint_id;
    return !taskSprintId || taskSprintId === 'null' || taskSprintId === '';
  });

  // Standalone tasks: Unassigned to sprint AND unassigned to any story
  const standaloneTasks = backlogTasks.filter(t => {
    const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
    return !taskStoryId;
  });

  const filteredStories = backlogStories.filter(story =>
    (story.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (story.description && story.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredStandaloneTasks = standaloneTasks.filter(task =>
    (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderStatusBadge = (status) => {
    const statusConfig = {
      todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700 border-slate-200' },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      in_review: { label: 'In Review', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      done: { label: 'Done', color: 'bg-green-100 text-green-700 border-green-200' },
      completed: { label: 'Done', color: 'bg-green-100 text-green-700 border-green-200' },
      review: { label: 'Review', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    };
    const config = statusConfig[status] || statusConfig.todo;
    return (
      <Badge variant="outline" className={`${config.color} text-[10px] font-normal px-2 py-0 h-5`}>
        {config.label}
      </Badge>
    );
  };

  const renderAssignees = (emails) => {
    const emailList = Array.isArray(emails) ? emails : (emails ? [emails] : []);
    if (emailList.length === 0) return <span className="text-slate-400 text-xs">Unassigned</span>;

    return (
      <div className="flex -space-x-2">
        {emailList.slice(0, 3).map((email, idx) => {
          const user = users.find(u => u.email === email);
          return (
            <Avatar key={idx} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={user?.profile_image_url} />
              <AvatarFallback className="text-[8px] bg-slate-100 text-slate-600">
                {getInitials(user?.full_name || email)}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {emailList.length > 3 && (
          <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-medium text-slate-600">
            +{emailList.length - 3}
          </div>
        )}
      </div>
    );
  };

  const moveButton = (id, type) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
          Move to Sprint
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {sprints.filter(s => s.status !== 'completed').map(sprint => (
          <DropdownMenuItem
            key={sprint.id}
            onClick={() => onMoveTask(id, sprint.id)}
          >
            {sprint.name}
          </DropdownMenuItem>
        ))}
        {sprints.filter(s => s.status !== 'completed').length === 0 && (
          <DropdownMenuItem disabled>No active sprints</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search stories and tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-slate-200 bg-white shadow-sm focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowCreateTask(true)} className="h-10 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 gap-2">
            <Plus className="h-4 w-4" />
            Create New
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {/* User Stories Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-blue-500" />
            User Stories ({filteredStories.length})
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Detail</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-[120px] text-center">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-[140px] text-center">Assignee</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-[180px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStories.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-500 italic text-sm">No stories in backlog</td>
                    </tr>
                  ) : filteredStories.map(story => {
                    const storyId = story.id || story._id;
                    const storyTasks = backlogTasks.filter(t => {
                      const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
                      return String(taskStoryId) === String(storyId);
                    });
                    const isExpanded = expandedStories.has(storyId);
                    const progress = getStoryProgress(storyId);

                    return (
                      <React.Fragment key={storyId}>
                        <tr className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleStoryExpansion(storyId)}
                                className="mt-0.5 p-0.5 hover:bg-slate-200 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                                  <span
                                    className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={() => onStoryClick && onStoryClick(storyId)}
                                  >
                                    {story.title}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100 font-normal">
                                    Story
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  {progress.total > 0 && (
                                    <div className="flex items-center gap-2 flex-1 max-w-[100px]">
                                      <Progress value={progress.percentage} className="h-1 bg-slate-100" />
                                      <span className="text-[10px] text-slate-500 font-mono">{progress.percentage}%</span>
                                    </div>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {storyTasks.length} {storyTasks.length === 1 ? 'task' : 'tasks'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex justify-center">
                              {renderStatusBadge(story.status)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-center">
                              {renderAssignees(story.assigned_to)}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {moveButton(storyId, 'story')}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                onClick={() => onStoryClick && onStoryClick(storyId)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                onClick={() => setItemToDelete({ id: storyId, type: 'story' })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && storyTasks.map(task => (
                          <tr key={task.id} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors group/task border-l-2 border-blue-200">
                            <td className="px-6 py-3 pl-16">
                              <div className="flex items-center gap-3">
                                <ListTodo className="h-3.5 w-3.5 text-slate-400" />
                                <span
                                  className="text-sm text-slate-600 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => onTaskClick && onTaskClick(task.id)}
                                >
                                  {task.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                {renderStatusBadge(task.status)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                {renderAssignees(task.assigned_to)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                {moveButton(task.id, 'task')}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                  onClick={() => onTaskClick && onTaskClick(task.id)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                                  onClick={() => setItemToDelete({ id: task.id, type: 'task' })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {filteredStories.length === 0 && searchQuery && (
          <div className="bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                <Search className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-slate-600 font-medium">No backlog items match your search</p>
              <Button variant="link" onClick={() => setSearchQuery("")} className="text-blue-600 h-auto p-0 hover:underline">
                Clear search results
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        projectId={projectId}
        onSuccess={(newTask) => {
          onTaskCreated(newTask);
          setShowCreateTask(false);
        }}
      />

      <CreateStoryDialog
        open={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        projectId={projectId}
        onSuccess={() => {
          setShowCreateStory(false);
        }}
      />

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {itemToDelete?.type === 'story' ? 'user story' : 'task'} and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (itemToDelete) {
                  onDelete(itemToDelete.id, itemToDelete.type);
                  setItemToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
