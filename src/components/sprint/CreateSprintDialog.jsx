import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Sparkles, FolderKanban, BookOpen, ChevronDown, ChevronRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const sprintSchema = z.object({
  name: z.string().min(1, "Sprint Name is required").max(100, "Sprint name is too long"),
  goal: z.string().max(500, "Goal is too long").optional(),
  start_date: z.date({ required_error: "Start date is required" }),
  end_date: z.date({ required_error: "End date is required" }),
  milestone_id: z.string().optional(),
}).refine(
  (data) => {
    if (!data.start_date || !data.end_date) return true;
    return data.end_date > data.start_date;
  },
  {
    message: "End date must be after start date",
    path: ["end_date"],
  }
);

export default function CreateSprintDialog({ open, onClose, onSubmit, loading, initialValues, projectId }) {
  const [generatingGoal, setGeneratingGoal] = useState(false);
  const [selectedStories, setSelectedStories] = useState([]);
  const [expandedEpics, setExpandedEpics] = useState({});
  const hasInitializedStories = React.useRef(false);

  // Check if sprint is locked (scope is locked)
  const isSprintLocked = !!initialValues?.locked_date;

  const form = useForm({
    resolver: zodResolver(sprintSchema),
    defaultValues: {
      name: initialValues?.name || "",
      goal: initialValues?.goal || "",
      start_date: initialValues?.start_date ? new Date(initialValues.start_date) : undefined,
      end_date: initialValues?.end_date ? new Date(initialValues.end_date) : undefined,
      milestone_id: initialValues?.milestone_id || "",
    },
  });

  // Fetch epics and stories for the project
  const { data: epics = [] } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Epic.filter({ project_id: projectId });
    },
    enabled: !!projectId && open,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Story.filter({ project_id: projectId });
    },
    enabled: !!projectId && open,
  });

  // Fetch milestones for the project
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Milestone.filter({ project_id: projectId });
    },
    enabled: !!projectId && open,
  });

  // Get stories already in this sprint (for edit mode)
  const { data: existingSprintStories = [], isLoading: isLoadingExistingStories } = useQuery({
    queryKey: ['stories', 'sprint', initialValues?.id],
    queryFn: async () => {
      if (!initialValues?.id || !projectId) return [];
      const allStories = await groonabackend.entities.Story.filter({ project_id: projectId });
      // Filter stories that belong to this sprint (handle both id and _id formats)
      return allStories.filter(s => {
        const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
        return String(storySprintId) === String(initialValues.id);
      });
    },
    enabled: !!initialValues?.id && !!projectId && open,
  });

  // Create a stable string representation of existing sprint story IDs
  const existingSprintStoryIdsStr = React.useMemo(() => {
    if (!existingSprintStories || existingSprintStories.length === 0) return '';
    return existingSprintStories
      .map(s => String(s.id || s._id))
      .sort()
      .join(',');
  }, [existingSprintStories]);

  // Initialize selected stories when dialog opens or when existing stories load
  React.useEffect(() => {
    if (!open) {
      // Reset when dialog closes
      setSelectedStories([]);
      setExpandedEpics({});
      hasInitializedStories.current = false;
      return;
    }

    if (initialValues?.id) {
      // Edit mode: pre-select stories already in sprint
      // Wait for existingSprintStories to finish loading
      if (!isLoadingExistingStories && !hasInitializedStories.current) {
        if (existingSprintStories.length > 0) {
          const storyIds = existingSprintStories.map(s => s.id || s._id);
          setSelectedStories(storyIds);
        } else {
          // If no existing stories found, start with empty selection
          setSelectedStories([]);
        }
        hasInitializedStories.current = true;
      }
    } else {
      // Create mode: start with empty selection
      if (!hasInitializedStories.current) {
        setSelectedStories([]);
        hasInitializedStories.current = true;
      }
    }
  }, [open, initialValues?.id, isLoadingExistingStories, existingSprintStoryIdsStr]);

  // Group stories by epic
  const storiesByEpic = React.useMemo(() => {
    const grouped = {
      noEpic: [],
    };

    stories.forEach(story => {
      const epicId = story.epic_id || 'noEpic';
      if (!grouped[epicId]) {
        grouped[epicId] = [];
      }
      grouped[epicId].push(story);
    });

    return grouped;
  }, [stories]);

  const toggleStorySelection = React.useCallback((storyId) => {
    setSelectedStories(prev => {
      // Normalize IDs to strings for comparison
      const normalizedStoryId = String(storyId);
      const normalizedPrev = prev.map(id => String(id));
      const isCurrentlySelected = normalizedPrev.includes(normalizedStoryId);

      if (isCurrentlySelected) {
        return prev.filter(id => String(id) !== normalizedStoryId);
      } else {
        return [...prev, storyId];
      }
    });
  }, []);

  const toggleEpicExpansion = (epicId) => {
    setExpandedEpics(prev => ({
      ...prev,
      [epicId]: !prev[epicId]
    }));
  };

  const selectAllStoriesInEpic = React.useCallback((epicId) => {
    const epicStories = storiesByEpic[epicId] || [];
    const epicStoryIds = epicStories.map(s => s.id || s._id);
    setSelectedStories(prev => {
      const allSelected = epicStoryIds.length > 0 && epicStoryIds.every(id =>
        prev.some(selId => String(selId) === String(id))
      );
      if (allSelected) {
        // Deselect all stories in this epic
        return prev.filter(id => !epicStoryIds.some(sId => String(sId) === String(id)));
      } else {
        // Select all stories in this epic
        const newIds = epicStoryIds.filter(id =>
          !prev.some(selId => String(selId) === String(id))
        );
        return [...prev, ...newIds];
      }
    });
  }, [storiesByEpic]);

  const handleGenerateGoal = async () => {
    const currentGoal = form.getValues("goal");
    const sprintName = form.getValues("name");

    if (!currentGoal && !sprintName) {
      toast.error("Please enter a Sprint Name or a rough Goal draft first.");
      return;
    }

    setGeneratingGoal(true);
    try {
      let context = "";
      try {
        if (projectId) {
          const retros = await groonabackend.entities.Retrospective.filter(
            { project_id: projectId },
            '-meeting_date',
            3
          );
          if (retros.length > 0) {
            context = "Recent Retrospective Insights:\n" + retros.map(r =>
              `- ${r.what_could_be_improved} (Suggestion: ${r.ai_suggestions || 'None'})`
            ).join('\n');
          }
        }
      } catch (e) {
        console.warn("Could not fetch retrospectives for context", e);
      }

      const prompt = currentGoal
        ? `Refine this sprint goal to be concise, professional, and actionable (SMART goal format preferred). Input: "${currentGoal}".\n\n${context}`
        : `Suggest a concise and actionable sprint goal for a sprint named "${sprintName}".\n\n${context}`;

      // --- FIX: Use groonabackend.functions.invoke instead of integrations.Core.InvokeLLM ---
      const response = await groonabackend.functions.invoke('generateSprintGoal', { prompt });

      // Handle both direct object or string response
      const result = typeof response === 'string' ? JSON.parse(response) : response;

      if (result && result.goal) {
        form.setValue("goal", result.goal);
        toast.success("Sprint goal drafted!");
      } else {
        throw new Error("Invalid response format");
      }

    } catch (error) {
      console.error("Failed to generate goal:", error);
      toast.error("Failed to generate goal");
    } finally {
      setGeneratingGoal(false);
    }
  };

  // Reset form when initialValues change or dialog opens
  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      name: initialValues?.name || "",
      goal: initialValues?.goal || "",
      start_date: initialValues?.start_date ? new Date(initialValues.start_date) : undefined,
      end_date: initialValues?.end_date ? new Date(initialValues.end_date) : undefined,
      milestone_id: initialValues?.milestone_id || "",
    });
    // Reset initialization flag when initialValues change (different sprint being edited)
    if (initialValues?.id) {
      hasInitializedStories.current = false;
    }
  }, [open, initialValues?.id, initialValues?.name, initialValues?.goal, initialValues?.start_date, initialValues?.end_date]);

  const handleSubmit = async (data) => {
    const sprintData = {
      ...data,
      start_date: format(data.start_date, 'yyyy-MM-dd'),
      end_date: format(data.end_date, 'yyyy-MM-dd'),
    };

    // Call onSubmit with sprint data and selected stories
    onSubmit({
      sprintData,
      selectedStoryIds: selectedStories,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit Sprint" : "Create Sprint"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sprint Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Example: Sprint 12 – Payment Enhancements" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Sprint Goal</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      onClick={handleGenerateGoal}
                      disabled={generatingGoal}
                    >
                      {generatingGoal ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Draft with AI
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea placeholder="Define the main objective for this sprint..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="milestone_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-blue-500" />
                    Associated Milestone
                  </FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === "unassigned" ? "" : val)}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a milestone (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {milestones
                        .filter(m => m.status === 'in_progress' || (field.value && (m.id === field.value || m._id === field.value)))
                        .map((m) => (
                          <SelectItem key={m.id || m._id} value={m.id || m._id}>
                            {m.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                              isSprintLocked && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={isSprintLocked}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      {!isSprintLocked && (
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      )}
                    </Popover>
                    {isSprintLocked && (
                      <p className="text-xs text-red-600 mt-1">Sprint scope is locked - edit stories and update dates are disabled</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                              isSprintLocked && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={isSprintLocked}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      {!isSprintLocked && (
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      )}
                    </Popover>
                    {isSprintLocked && (
                      <p className="text-xs text-red-600 mt-1">Sprint scope is locked - edit stories and update dates are disabled</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!isSprintLocked && <p className="text-xs text-slate-500 mt-1">Choose dates that match your cycle.</p>}
          </form>
        </Form>

        {/* Epic and Story Selection - Outside form to avoid interference */}
        {projectId && (
          <div className="space-y-4 pt-4 border-t mt-4">
            <div>
              <Label className="text-base font-semibold">Select Stories for Sprint</Label>
              {!isSprintLocked && (
                <p className="text-xs text-slate-500 mt-1">
                  Choose stories to include in this sprint. Stories are grouped by epic.
                </p>
              )}
              {isSprintLocked && (
                <p className="text-xs text-red-600 mt-1">
                  Sprint scope is locked - edit stories and update dates are disabled
                </p>
              )}
            </div>

            <div className={cn(
              "border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-3",
              isSprintLocked && "opacity-50 pointer-events-none"
            )}>
              {/* Stories without Epic */}
              {storiesByEpic.noEpic && storiesByEpic.noEpic.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-1.5">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-800">Stories without Epic</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-gray-100 text-gray-600 border-none">
                        {storiesByEpic.noEpic.length}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      disabled={isSprintLocked}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!isSprintLocked) {
                          const storyIds = storiesByEpic.noEpic.map(s => s.id || s._id);
                          const allSelected = storyIds.every(id =>
                            selectedStories.some(selId => String(selId) === String(id))
                          );
                          if (allSelected) {
                            setSelectedStories(prev =>
                              prev.filter(id => !storyIds.some(sId => String(sId) === String(id)))
                            );
                          } else {
                            setSelectedStories(prev => {
                              const newIds = storyIds.filter(id =>
                                !prev.some(selId => String(selId) === String(id))
                              );
                              return [...prev, ...newIds];
                            });
                          }
                        }
                      }}
                    >
                      {storiesByEpic.noEpic.every(s => selectedStories.some(id => String(id) === String(s.id || s._id))) ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="pl-6 space-y-2">
                    {storiesByEpic.noEpic.map((story) => {
                      const storyId = story.id || story._id;
                      const isSelected = selectedStories.some(id => String(id) === String(storyId));
                      return (
                        <div
                          key={storyId}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 group min-w-0"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (!isSprintLocked) {
                                toggleStorySelection(storyId);
                              }
                            }}
                            disabled={isSprintLocked}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          />
                          <div
                            className={cn(
                              "flex-1 flex items-center justify-between gap-2 min-w-0",
                              !isSprintLocked && "cursor-pointer"
                            )}
                            onClick={() => {
                              if (!isSprintLocked) {
                                toggleStorySelection(storyId);
                              }
                            }}
                          >
                            <div className="text-sm font-medium text-gray-700 truncate">{story.title}</div>
                            {story.story_points && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-600 border-none flex-shrink-0">
                                {story.story_points} {story.story_points === 1 ? 'pt' : 'pts'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stories grouped by Epic */}
              {epics.map((epic) => {
                const epicId = epic.id || epic._id;
                const epicStories = storiesByEpic[epicId] || [];
                if (epicStories.length === 0) return null;

                const isExpanded = expandedEpics[epicId] !== false; // Default to expanded
                const allSelected = epicStories.every(s => selectedStories.includes(s.id || s._id));

                return (
                  <div key={epicId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isSprintLocked) {
                            toggleEpicExpansion(epicId);
                          }
                        }}
                        disabled={isSprintLocked}
                        className={cn(
                          "flex items-center gap-2 flex-1 text-left p-1.5 rounded min-w-0",
                          !isSprintLocked && "hover:bg-gray-50",
                          isSprintLocked && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          )}
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: epic.color || "#3b82f6" }}
                          />
                          <FolderKanban className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-semibold text-gray-800 truncate">{epic.name}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 flex-shrink-0 bg-gray-100 text-gray-600 border-none">
                            {epicStories.length}
                          </Badge>
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        disabled={isSprintLocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!isSprintLocked) {
                            selectAllStoriesInEpic(epicId);
                          }
                        }}
                      >
                        {epicStories.every(s => selectedStories.some(id => String(id) === String(s.id || s._id))) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="pl-8 space-y-2">
                        {epicStories.map((story) => {
                          const storyId = story.id || story._id;
                          const isSelected = selectedStories.some(id => String(id) === String(storyId));
                          return (
                            <div
                              key={storyId}
                              className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 group min-w-0"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleStorySelection(storyId);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                              />
                              <div
                                className="flex-1 flex items-center justify-between gap-2 min-w-0 cursor-pointer"
                                onClick={() => toggleStorySelection(storyId)}
                              >
                                <div className="text-sm font-medium text-gray-700 truncate">{story.title}</div>
                                {story.story_points && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-600 border-none flex-shrink-0">
                                    {story.story_points} {story.story_points === 1 ? 'pt' : 'pts'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {stories.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No stories available for this project.</p>
                  <p className="text-xs mt-1">Create stories first to add them to the sprint.</p>
                </div>
              )}
            </div>

            {selectedStories.length > 0 && (
              <div className="text-sm text-blue-600">
                {selectedStories.length} {selectedStories.length === 1 ? 'story' : 'stories'} selected
              </div>
            )}
          </div>
        )}

        {/* Buttons at the bottom */}
        <DialogFooter className="mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => {
              form.handleSubmit(handleSubmit)();
            }}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialValues ? "Update Sprint" : "Create Sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

