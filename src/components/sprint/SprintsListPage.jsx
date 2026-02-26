import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, MoreVertical, Plus, Eye, Edit, Trash2, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import CreateSprintDialog from "./CreateSprintDialog";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/shared/UserContext";
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

const statusColors = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  planned: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function SprintsListPage({ projectId, sprints = [], tasks = [], tenantId }) {
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { user: currentUser, effectiveTenantId: contextTenantId } = useUser();
  const effectiveTenantId = tenantId || contextTenantId;

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    id: null
  });

  // Check if user is a viewer
  const isViewer = currentUser?.custom_role === 'viewer';

  // Fetch stories for the project
  const { data: stories = [] } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return groonabackend.entities.Story.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      let projects = await groonabackend.entities.Project.filter({ _id: projectId });
      if (!projects || projects.length === 0) {
        projects = await groonabackend.entities.Project.filter({ id: projectId });
      }
      return projects[0] || null;
    },
    enabled: !!projectId,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return groonabackend.entities.Milestone.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  const getSprintMetrics = (sprintId, sprint) => {
    // Get stories assigned to this sprint
    const sprintStories = stories.filter(s => {
      const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
      return String(storySprintId) === String(sprintId);
    });

    // Calculate committed points: use locked sprint's committed_points if available and > 0,
    // otherwise calculate from stories in the sprint
    const totalStoryPoints = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
    // Use committed_points if it exists and is > 0 (set when sprint was locked), otherwise use total story points
    const committed = (sprint?.committed_points !== undefined && sprint?.committed_points !== null && Number(sprint.committed_points) > 0)
      ? Number(sprint.committed_points)
      : totalStoryPoints;

    // Calculate completed points using partial completion based on task completion percentage
    // This gives more accurate metrics by considering partial story completion
    // A story contributes points proportionally based on task completion percentage
    const completed = sprintStories.reduce((sum, story) => {
      const storyId = story.id || story._id;
      const storyStatus = (story.status || '').toLowerCase();
      const storyPoints = Number(story.story_points) || 0;

      // If story status is "done", consider it 100% completed
      if (storyStatus === 'done' || storyStatus === 'completed') {
        return sum + storyPoints;
      }

      // Get tasks that belong to this story
      const storyTasks = tasks.filter(t => {
        const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
        return String(taskStoryId) === String(storyId);
      });

      // If story has no tasks, it's only completed if status is "done" (already checked above)
      if (storyTasks.length === 0) {
        return sum; // No tasks and status is not "done" - contributes 0 points
      }

      // Calculate task completion percentage
      const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
      const totalTasksCount = storyTasks.length;
      const taskCompletionPercentage = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0;

      // Story contributes points proportionally based on task completion
      // Example: Story with 5 points, 2 out of 4 tasks completed = 50% = 2.5 points
      const partialPoints = storyPoints * taskCompletionPercentage;
      return sum + partialPoints;
    }, 0);

    return { total: committed, completed };
  };

  const createSprintMutation = useMutation({
    mutationFn: async ({ sprintData, selectedStoryIds = [] }) => {
      if (!effectiveTenantId) throw new Error("Tenant ID is missing");

      // Create the sprint
      const newSprint = await groonabackend.entities.Sprint.create({
        ...sprintData,
        project_id: projectId,
        tenant_id: effectiveTenantId
      });

      // Assign selected stories to the sprint
      if (selectedStoryIds.length > 0 && newSprint.id) {
        try {
          await Promise.all(
            selectedStoryIds.map(storyId =>
              groonabackend.entities.Story.update(storyId, { sprint_id: newSprint.id || newSprint._id })
            )
          );
        } catch (error) {
          console.error('Failed to assign stories to sprint:', error);
          // Don't fail the whole operation if story assignment fails
          toast.warning('Sprint created but some stories could not be assigned');
        }
      }

      return newSprint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Sprint created successfully');
      setShowCreateSprint(false);
    },
    onError: (error) => {
      toast.error(`Failed to create sprint: ${error.message}`);
    }
  });

  const updateSprintMutation = useMutation({
    mutationFn: async ({ id, data: { sprintData, selectedStoryIds = [] } }) => {
      // Update the sprint
      const updatedSprint = await groonabackend.entities.Sprint.update(id, sprintData);

      // Handle story assignment for updates
      if (selectedStoryIds !== undefined) {
        try {
          // Get all stories in the project
          const allStories = await groonabackend.entities.Story.filter({ project_id: projectId });

          // Remove sprint_id from stories that are no longer selected
          const storiesToRemove = allStories.filter(
            s => s.sprint_id === id && !selectedStoryIds.includes(s.id || s._id)
          );
          await Promise.all(
            storiesToRemove.map(story =>
              groonabackend.entities.Story.update(story.id || story._id, { sprint_id: null })
            )
          );

          // Add sprint_id to newly selected stories
          const storiesToAdd = selectedStoryIds.filter(
            storyId => !allStories.find(s => (s.id || s._id) === storyId && s.sprint_id === id)
          );
          await Promise.all(
            storiesToAdd.map(storyId =>
              groonabackend.entities.Story.update(storyId, { sprint_id: id })
            )
          );
        } catch (error) {
          console.error('Failed to update story assignments:', error);
          toast.warning('Sprint updated but story assignments may be incomplete');
        }
      }

      return updatedSprint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Sprint updated successfully');
      setEditingSprint(null);
      setShowCreateSprint(false);
    },
    onError: (error) => {
      toast.error(`Failed to update sprint: ${error.message}`);
    }
  });

  const deleteSprintMutation = useMutation({
    mutationFn: async (id) => {
      // 1. Find all tasks associated with this sprint
      const sprintTasks = await groonabackend.entities.Task.filter({ sprint_id: id });

      // 2. Delete all associated tasks
      if (sprintTasks.length > 0) {
        await Promise.all(
          sprintTasks.map(task => groonabackend.entities.Task.delete(task.id || task._id))
        );
      }

      // 3. Delete the sprint itself
      await groonabackend.entities.Sprint.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      // Invalidate project stats
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] });
      toast.success('Sprint and its tasks deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete sprint: ${error.message}`);
    }
  });

  const handleDelete = (id) => {
    setDeleteConfirmation({
      isOpen: true,
      id
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sprints</h2>
          <p className="text-slate-500">Manage and plan your sprints</p>
        </div>
        {!isViewer && (
          <Button
            onClick={() => setShowCreateSprint(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-4 w-4 mr-2" />
            Plan New Sprint
          </Button>
        )}
      </div>

      {sprints.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No sprints planned yet</h3>
            <p className="text-slate-500 mb-4 max-w-sm">
              Start your first sprint and get your team moving.
            </p>
            {!isViewer && (
              <Button
                onClick={() => setShowCreateSprint(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
              >
                Plan New Sprint
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sprint Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Committed vs Completed</TableHead>
                <TableHead>Sprint Goal</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sprints.map((sprint) => {
                const metrics = getSprintMetrics(sprint.id, sprint);
                return (
                  <TableRow key={sprint.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {sprint.name}
                        {(() => {
                          const isLocked = (sprint.milestone_id && milestones.find(m => (m.id || m._id) === sprint.milestone_id)?.status === 'completed') || project?.status === 'completed';
                          if (isLocked) {
                            return (
                              <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0 gap-1 opacity-70">
                                <Lock className="h-3 w-3" />
                                Settled
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${statusColors[sprint.status] || statusColors.draft} capitalize`}>
                        {sprint.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {format(new Date(sprint.start_date), 'MMM d')} - {format(new Date(sprint.end_date), 'MMM d')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">
                          {metrics.total || 0} pts
                        </div>
                        <span className="text-xs text-slate-500">
                          ({metrics.completed > 0 ? metrics.completed.toFixed(2) : "0.00"} completed)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-600" title={sprint.goal}>
                      {sprint.goal || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(
                            `${createPageUrl("SprintPlanningPage")}?sprintId=${sprint.id}&projectId=${projectId}`,
                            { state: { sprint: sprint } }
                          )}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        {!isViewer && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isViewer && (
                                <>
                                  {(() => {
                                    const isLocked = (sprint.milestone_id && milestones.find(m => (m.id || m._id) === sprint.milestone_id)?.status === 'completed') || project?.status === 'completed';
                                    if (isLocked) {
                                      return (
                                        <DropdownMenuItem disabled className="text-slate-400">
                                          <Lock className="h-4 w-4 mr-2" /> Action Locked
                                        </DropdownMenuItem>
                                      );
                                    }
                                    return (
                                      <>
                                        <DropdownMenuItem onClick={() => {
                                          setEditingSprint(sprint);
                                          setShowCreateSprint(true);
                                        }}>
                                          <Edit className="h-4 w-4 mr-2" /> Edit Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => handleDelete(sprint.id)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                      </>
                                    );
                                  })()}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateSprintDialog
        open={showCreateSprint}
        projectId={projectId}
        onClose={() => {
          setShowCreateSprint(false);
          setEditingSprint(null);
        }}
        onSubmit={(data) => {
          if (editingSprint) {
            updateSprintMutation.mutate({ id: editingSprint.id, data });
          } else {
            createSprintMutation.mutate(data);
          }
        }}
        initialValues={editingSprint}
        loading={createSprintMutation.isPending || updateSprintMutation.isPending}
      />

      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sprint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sprint? This will also delete all associated tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmation.id) {
                  deleteSprintMutation.mutate(deleteConfirmation.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

