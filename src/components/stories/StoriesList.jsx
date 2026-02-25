import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, BookOpen, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CreateStoryDialog from "./CreateStoryDialog";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";

export default function StoriesList({ projectId, epicId }) {
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [hoveredStoryId, setHoveredStoryId] = useState(null);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['stories', projectId, epicId],
    queryFn: async () => {
      if (!projectId) return [];
      const filters = { project_id: projectId };
      if (epicId) {
        filters.epic_id = epicId;
      }
      return await groonabackend.entities.Story.filter(filters);
    },
    enabled: !!projectId,
  });

  const { data: epics = [] } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Epic.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Task.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.custom_role !== 'client');
    },
    enabled: true,
  });

  const getUserName = (email) => {
    if (!email) return email;
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const deleteStoryMutation = useMutation({
    mutationFn: async (storyId) => {
      // 1. Find all tasks associated with this story
      const storyTasks = await groonabackend.entities.Task.filter({ story_id: storyId });

      // 2. Delete all associated tasks
      if (storyTasks.length > 0) {
        await Promise.all(
          storyTasks.map(task => groonabackend.entities.Task.delete(task.id || task._id))
        );
      }

      // 3. Delete the story itself
      await groonabackend.entities.Story.delete(storyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', projectId, epicId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      // Invalidate projects to update global counts if necessary
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Story and its tasks deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete story: ${error.message}`);
    },
  });

  const getStatusColor = (status) => {
    const colors = {
      todo: "bg-gray-100 text-gray-800",
      in_progress: "bg-blue-100 text-blue-800",
      in_review: "bg-purple-100 text-purple-800",
      done: "bg-green-100 text-green-800",
      blocked: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || colors.todo;
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

  const getStoryTasks = (storyId) => {
    return tasks.filter(t => t.story_id === storyId);
  };

  const getEpicName = (epicId) => {
    if (!epicId) return null;
    const epic = epics.find(e => (e.id || e._id) === epicId);
    return epic?.name || null;
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
    return <div className="text-center py-8">Loading stories...</div>;
  }

  const filteredStories = epicId
    ? stories.filter(s => s.epic_id === epicId)
    : stories;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {epicId ? 'Stories in Epic' : 'Stories'}
          </h3>
          <p className="text-sm text-gray-500">
            {epicId ? 'Stories belonging to this epic' : 'User stories and requirements'}
          </p>
        </div>
        <Button
          onClick={() => setShowCreateStory(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Story
        </Button>
      </div>

      {filteredStories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No stories yet</p>
            <Button
              onClick={() => setShowCreateStory(true)}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Story
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredStories.map((story) => {
            const storyTasks = getStoryTasks(story.id || story._id);
            const epicName = getEpicName(story.epic_id);

            return (
              <Card key={story.id || story._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        <CardTitle className="text-lg">{story.title}</CardTitle>
                      </div>
                      {story.description && (
                        <Popover open={hoveredStoryId === (story.id || story._id)}>
                          <PopoverTrigger asChild>
                            <div
                              className="text-sm text-gray-600 mt-1 cursor-pointer hover:text-gray-800 transition-colors line-clamp-1"
                              title="Hover to see full description"
                              onMouseEnter={() => setHoveredStoryId(story.id || story._id)}
                              onMouseLeave={() => setHoveredStoryId(null)}
                            >
                              {getFirstLine(story.description)}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[500px] max-h-[400px] overflow-y-auto prose prose-sm max-w-none [&_p]:my-2 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-1"
                            side="top"
                            align="start"
                            sideOffset={8}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onMouseEnter={() => setHoveredStoryId(story.id || story._id)}
                            onMouseLeave={() => setHoveredStoryId(null)}
                          >
                            <div
                              dangerouslySetInnerHTML={{ __html: story.description }}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                      {epicName && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            <FolderKanban className="w-3 h-3 mr-1" />
                            {epicName}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStory(story)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this story?')) {
                            deleteStoryMutation.mutate(story.id || story._id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusColor(story.status)}>
                        {story.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(story.priority)}>
                        {story.priority}
                      </Badge>
                      {story.story_points && (
                        <Badge variant="outline">
                          {story.story_points} {story.story_points === 1 ? 'point' : 'points'}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {storyTasks.length} {storyTasks.length === 1 ? 'task' : 'tasks'}
                      </Badge>
                    </div>

                    {story.acceptance_criteria && (
                      <div className="text-sm">
                        <p className="font-medium text-gray-700 mb-1">Acceptance Criteria:</p>
                        <p className="text-gray-600">{story.acceptance_criteria}</p>
                      </div>
                    )}

                    {story.assigned_to && story.assigned_to.length > 0 && (
                      <div className="text-sm text-gray-500">
                        Assigned to: {story.assigned_to.map(email => getUserName(email)).join(', ')}
                      </div>
                    )}

                    {story.due_date && (
                      <div className="text-sm text-gray-500">
                        Due: {new Date(story.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateStoryDialog
        open={showCreateStory || !!selectedStory}
        onClose={() => {
          setShowCreateStory(false);
          setSelectedStory(null);
        }}
        projectId={projectId}
        epicId={epicId}
        story={selectedStory}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['stories', projectId, epicId] });
          setSelectedStory(null);
        }}
      />
    </div>
  );
}


