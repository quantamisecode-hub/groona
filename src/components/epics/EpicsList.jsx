import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, FolderKanban, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreateEpicDialog from "./CreateEpicDialog";
import EpicDetailDialog from "./EpicDetailDialog";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";

export default function EpicsList({ projectId, sprints = [] }) {
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const [showCreateEpic, setShowCreateEpic] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState(null);
  const [selectedEpicId, setSelectedEpicId] = useState(null);
  const [hoveredEpicId, setHoveredEpicId] = useState(null);
  const [selectedSprintId, setSelectedSprintId] = useState("none");

  const { data: epics = [], isLoading } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Epic.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Story.filter({ project_id: projectId });
    },
    enabled: !!projectId,
    refetchInterval: 2000, // Poll every 2s to keep progress updated
    staleTime: 0,
  });

  const deleteEpicMutation = useMutation({
    mutationFn: async (epicId) => {
      // 1. Find all stories associated with this epic
      const epicStories = await groonabackend.entities.Story.filter({ epic_id: epicId });

      if (epicStories.length > 0) {
        // For each story, delete its associated tasks
        await Promise.all(
          epicStories.map(async (story) => {
            const storyId = story.id || story._id;
            const storyTasks = await groonabackend.entities.Task.filter({ story_id: storyId });

            if (storyTasks.length > 0) {
              await Promise.all(
                storyTasks.map(task => groonabackend.entities.Task.delete(task.id || task._id))
              );
            }

            // Delete the story
            await groonabackend.entities.Story.delete(storyId);
          })
        );
      }

      // 2. Delete the epic itself
      await groonabackend.entities.Epic.delete(epicId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      // Invalidate project stats
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Epic and all its stories and tasks deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete epic: ${error.message}`);
    },
  });

  const getStatusColor = (status) => {
    const colors = {
      planning: "bg-gray-100 text-gray-800",
      in_progress: "bg-blue-100 text-blue-800",
      on_hold: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || colors.planning;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };
    return colors[priority] || colors.medium;
  };

  // Filter epics to only show those with stories in the selected sprint
  const filteredEpics = useMemo(() => {
    if (selectedSprintId === "none") {
      // If "none" is selected, show all epics
      return epics;
    }

    if (selectedSprintId === "all") {
      // If "all" is selected, show epics with unassigned stories
      return epics.filter(epic => {
        const epicId = epic.id || epic._id;
        return stories.some(s => {
          const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
          return String(storyEpicId) === String(epicId) && !storySprintId;
        });
      });
    }

    // If a sprint is selected, show epics that have at least one story in this sprint
    return epics.filter(epic => {
      const epicId = epic.id || epic._id;
      return stories.some(s => {
        const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;

        // Story must belong to this epic
        if (String(storyEpicId) !== String(epicId)) return false;

        // Story must be in the selected sprint (or unassigned, which shows in all sprint epics)
        if (!storySprintId) return true; // Unassigned stories appear in all sprint epics

        return String(storySprintId) === String(selectedSprintId);
      });
    });
  }, [epics, stories, selectedSprintId]);

  const getEpicProgress = (epicId) => {
    // Filter stories by epic and sprint
    const epicStories = stories.filter(s => {
      const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
      if (String(storyEpicId) !== String(epicId)) return false;

      // If sprint is selected, only count stories in that sprint (or unassigned)
      if (selectedSprintId === "none") {
        // "None" selected - count all stories
        return true;
      } else if (selectedSprintId && selectedSprintId !== "all") {
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
        // Include unassigned stories (they appear in all sprint epics)
        if (!storySprintId) return true;
        return String(storySprintId) === String(selectedSprintId);
      } else {
        // "All" selected - only count unassigned stories
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
        return !storySprintId;
      }
    });

    if (epicStories.length === 0) return 0;

    const totalPoints = epicStories.reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);
    const completedPoints = epicStories
      .filter(s => s.status === 'done')
      .reduce((sum, story) => sum + (parseInt(story.story_points) || 0), 0);

    if (totalPoints === 0) return 0;
    return Math.round((completedPoints / totalPoints) * 100);
  };

  // Helper function to strip HTML and get first line
  const getFirstLine = (htmlContent) => {
    if (!htmlContent) return "";
    // Strip HTML tags using regex
    const text = htmlContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .trim();
    // Get first line (split by newline or take first 100 chars)
    const firstLine = text.split('\n')[0].trim();
    return firstLine.length > 100 ? firstLine.substring(0, 100) + "..." : firstLine;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading epics...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Epics</h3>
            <p className="text-sm text-gray-500">Organize work into large initiatives</p>
          </div>

          {/* Sprint Filter - Right Side Small Button */}
          {sprints.length > 0 && (
            <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
              <SelectTrigger className="w-auto h-8 px-3 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (All Epics)</SelectItem>
                <SelectItem value="all">Unassigned Stories</SelectItem>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id || sprint._id} value={String(sprint.id || sprint._id)}>
                    {sprint.name} ({sprint.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800">
          <span className="font-semibold">Epic Progress % = </span>
          (Completed Story Points in Epic ÷ Total Story Points in Epic) × 100
        </div>
      </div>

      {filteredEpics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">
              {selectedSprintId === "none"
                ? "No epics yet"
                : selectedSprintId && selectedSprintId !== "all"
                  ? "No epics with stories in this sprint"
                  : epics.length === 0
                    ? "No epics yet"
                    : "No epics with unassigned stories"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEpics.map((epic) => {
            const epicId = epic.id || epic._id;
            const progress = getEpicProgress(epicId);
            // Filter stories by epic and sprint
            const epicStories = stories.filter(s => {
              const storyEpicId = s.epic_id?.id || s.epic_id?._id || s.epic_id;
              if (String(storyEpicId) !== String(epicId)) return false;

              // If sprint is selected, only count stories in that sprint (or unassigned)
              if (selectedSprintId === "none") {
                // "None" selected - count all stories
                return true;
              } else if (selectedSprintId && selectedSprintId !== "all") {
                const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
                // Include unassigned stories (they appear in all sprint epics)
                if (!storySprintId) return true;
                return String(storySprintId) === String(selectedSprintId);
              } else {
                // "All" selected - only count unassigned stories
                const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
                return !storySprintId;
              }
            });

            return (
              <Card
                key={epicId}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedEpicId(epicId)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: epic.color || "#3b82f6" }}
                        />
                        <CardTitle className="text-lg">{epic.name}</CardTitle>
                      </div>
                      {epic.description && (
                        <Popover open={hoveredEpicId === (epic.id || epic._id)}>
                          <PopoverTrigger asChild>
                            <div
                              className="text-sm text-gray-600 mt-1 cursor-pointer hover:text-gray-800 transition-colors line-clamp-1"
                              title="Hover to see full description"
                              onMouseEnter={() => setHoveredEpicId(epic.id || epic._id)}
                              onMouseLeave={() => setHoveredEpicId(null)}
                            >
                              {getFirstLine(epic.description)}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[500px] max-h-[400px] overflow-y-auto prose prose-sm max-w-none [&_p]:my-2 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-1"
                            side="top"
                            align="start"
                            sideOffset={8}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onMouseEnter={() => setHoveredEpicId(epic.id || epic._id)}
                            onMouseLeave={() => setHoveredEpicId(null)}
                          >
                            <div
                              dangerouslySetInnerHTML={{ __html: epic.description }}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    {currentUser?.custom_role !== 'viewer' && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEpic(epic);
                            setShowCreateEpic(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this epic?')) {
                              deleteEpicMutation.mutate(epicId);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusColor(epic.status)}>
                        {epic.status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Badge>
                      <Badge className={getPriorityColor(epic.priority)}>
                        {epic.priority.charAt(0).toUpperCase() + epic.priority.slice(1)}
                      </Badge>
                      <Badge variant="outline">
                        {epicStories.length} {epicStories.length === 1 ? 'Story' : 'Stories'}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {(epic.start_date || epic.due_date) && (
                      <div className="text-sm text-gray-500">
                        {epic.start_date && <span>Start: {new Date(epic.start_date).toLocaleDateString()}</span>}
                        {epic.start_date && epic.due_date && <span className="mx-2">•</span>}
                        {epic.due_date && <span>Due: {new Date(epic.due_date).toLocaleDateString()}</span>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateEpicDialog
        open={showCreateEpic || !!selectedEpic}
        onClose={() => {
          setShowCreateEpic(false);
          setSelectedEpic(null);
        }}
        projectId={projectId}
        epic={selectedEpic}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['epics', projectId] });
          setSelectedEpic(null);
        }}
      />

      <EpicDetailDialog
        open={!!selectedEpicId}
        onClose={() => setSelectedEpicId(null)}
        epicId={selectedEpicId}
        sprintId={selectedSprintId && selectedSprintId !== "all" && selectedSprintId !== "none" ? selectedSprintId : null}
        onEpicUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['epics', projectId] });
        }}
      />
    </div>
  );
}

