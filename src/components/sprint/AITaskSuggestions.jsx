import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Plus, X, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AITaskSuggestions({ sprint, projectId, existingTasks, users }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [sprintGoal, setSprintGoal] = useState(sprint.goal || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Determine effective tenant ID
  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  // CRITICAL FIX: Get workspace_id from project
  const [projectData, setProjectData] = useState(null);
  
  useEffect(() => {
    if (projectId && effectiveTenantId) {
      groonabackend.entities.Project.filter({ id: projectId, tenant_id: effectiveTenantId })
        .then(projects => {
          if (projects[0]) {
            console.log('[AITaskSuggestions] Project loaded:', projects[0]);
            setProjectData(projects[0]);
          }
        })
        .catch(error => {
          console.error('[AITaskSuggestions] Failed to load project:', error);
        });
    }
  }, [projectId, effectiveTenantId]);

  const addTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      console.log('[AITaskSuggestions] Creating task:', taskData);
      
      // CRITICAL FIX: Include tenant_id and workspace_id
      const completeTaskData = {
        ...taskData,
        tenant_id: effectiveTenantId,
        workspace_id: projectData?.workspace_id || undefined,
        project_id: projectId,
        sprint_id: sprint.id,
        ai_generated: true,
        reporter: currentUser?.email || 'AI Assistant',
      };

      console.log('[AITaskSuggestions] Complete task data:', completeTaskData);

      const newTask = await groonabackend.entities.Task.create(completeTaskData);
      console.log('[AITaskSuggestions] Task created successfully:', newTask);

      // Log activity
      try {
        await groonabackend.entities.Activity.create({
          tenant_id: effectiveTenantId,
          action: 'created',
          entity_type: 'task',
          entity_id: newTask.id,
          entity_name: newTask.title,
          project_id: projectId,
          user_email: currentUser?.email || 'AI Assistant',
          user_name: currentUser?.full_name || 'AI Assistant',
          details: 'AI-generated task added to sprint',
        });
      } catch (error) {
        console.error('[AITaskSuggestions] Failed to log activity:', error);
      }

      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      console.log('[AITaskSuggestions] Task added successfully, queries invalidated');
    },
    onError: (error) => {
      console.error('[AITaskSuggestions] Task creation error:', error);
      toast.error('Failed to add task', {
        description: error.message || 'Please try again'
      });
    }
  });

  const generateTasks = async () => {
    if (!sprintGoal.trim()) {
      toast.error('Please enter a sprint goal');
      return;
    }

    setIsGenerating(true);
    setShowSuggestions(true);

    try {
      const prompt = `You are an expert project manager. Based on the following sprint goal, suggest 5-8 concrete, actionable tasks.

Sprint Goal: "${sprintGoal}"

Consider:
- Breaking down the goal into specific, achievable tasks
- Estimating complexity/hours for each task (be realistic)
- Identifying task types (story, bug, task, technical_debt)
- Setting appropriate priorities (low, medium, high, urgent)
- Suggesting logical dependencies between tasks

Provide tasks in a structured format. Each task should be specific and actionable.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  task_type: { 
                    type: "string",
                    enum: ["story", "bug", "task", "technical_debt"]
                  },
                  priority: {
                    type: "string",
                    enum: ["low", "medium", "high", "urgent"]
                  },
                  estimated_hours: { type: "number" },
                  acceptance_criteria: { type: "string" }
                }
              }
            },
            total_estimated_hours: { type: "number" },
            complexity_assessment: { type: "string" },
            recommendations: { type: "string" }
          }
        }
      });

      setSuggestedTasks(result.tasks || []);
      
      if (result.recommendations) {
        toast.info(result.recommendations, { duration: 5000 });
      }

      // Update sprint goal if changed
      if (sprintGoal !== sprint.goal) {
        await groonabackend.entities.Sprint.update(sprint.id, { goal: sprintGoal });
        queryClient.invalidateQueries({ queryKey: ['sprints'] });
      }

    } catch (error) {
      console.error('[AITaskSuggestions] AI generation error:', error);
      toast.error('Failed to generate tasks. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTask = async (task, index) => {
    console.log('[AITaskSuggestions] Adding task:', task);
    
    try {
      await addTaskMutation.mutateAsync({
        title: task.title,
        description: task.description,
        task_type: task.task_type || 'task',
        priority: task.priority || 'medium',
        estimated_hours: task.estimated_hours || 0,
        acceptance_criteria: task.acceptance_criteria || '',
        status: 'todo',
      });

      // Remove from suggestions after successful add
      setSuggestedTasks(prev => prev.filter((_, i) => i !== index));
      toast.success(`Task "${task.title}" added to sprint`);
    } catch (error) {
      console.error('[AITaskSuggestions] Failed to add task:', error);
      // Error already handled by mutation
    }
  };

  const handleAddAllTasks = async () => {
    console.log('[AITaskSuggestions] Adding all tasks:', suggestedTasks.length);
    
    let successCount = 0;
    let failCount = 0;

    for (const task of suggestedTasks) {
      try {
        await addTaskMutation.mutateAsync({
          title: task.title,
          description: task.description,
          task_type: task.task_type || 'task',
          priority: task.priority || 'medium',
          estimated_hours: task.estimated_hours || 0,
          acceptance_criteria: task.acceptance_criteria || '',
          status: 'todo',
        });
        successCount++;
      } catch (error) {
        console.error('[AITaskSuggestions] Failed to add task:', task.title, error);
        failCount++;
      }
    }

    setSuggestedTasks([]);
    
    if (failCount === 0) {
      toast.success(`All ${successCount} tasks added to sprint!`);
    } else {
      toast.warning(`${successCount} tasks added, ${failCount} failed`);
    }
  };

  const priorityColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const taskTypeColors = {
    story: "bg-green-100 text-green-800",
    bug: "bg-red-100 text-red-800",
    task: "bg-blue-100 text-blue-800",
    technical_debt: "bg-purple-100 text-purple-800",
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI-Powered Sprint Planning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Describe your sprint goal and desired outcomes
          </label>
          <Textarea
            value={sprintGoal}
            onChange={(e) => setSprintGoal(e.target.value)}
            placeholder="E.g., 'Complete user authentication flow including login, signup, password reset, and profile editing. Implement social login with Google and GitHub. Add email verification.'"
            className="min-h-[100px] bg-white"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={generateTasks}
            disabled={isGenerating || !sprintGoal.trim()}
            className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Tasks...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Tasks with AI
              </>
            )}
          </Button>

          {suggestedTasks.length > 0 && (
            <Button
              onClick={handleAddAllTasks}
              variant="outline"
              disabled={addTaskMutation.isPending}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              {addTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add All Tasks ({suggestedTasks.length})
            </Button>
          )}
        </div>

        {showSuggestions && suggestedTasks.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                AI Suggested Tasks ({suggestedTasks.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSuggestedTasks([]);
                  setShowSuggestions(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {suggestedTasks.map((task, index) => (
                <Card key={index} className="bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <h5 className="font-semibold text-slate-900">{task.title}</h5>
                          <p className="text-sm text-slate-600">{task.description}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddTask(task, index)}
                          disabled={addTaskMutation.isPending}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white flex-shrink-0"
                        >
                          {addTaskMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className={taskTypeColors[task.task_type] || taskTypeColors.task}>
                          {task.task_type}
                        </Badge>
                        <Badge className={priorityColors[task.priority] || priorityColors.medium}>
                          {task.priority}
                        </Badge>
                        {task.estimated_hours > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.estimated_hours}h
                          </Badge>
                        )}
                      </div>

                      {task.acceptance_criteria && (
                        <div className="text-xs text-slate-600 bg-slate-50 rounded p-2">
                          <span className="font-medium">Acceptance Criteria:</span> {task.acceptance_criteria}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {showSuggestions && suggestedTasks.length === 0 && !isGenerating && (
          <div className="text-center py-8 text-slate-600">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-400" />
            <p>All tasks have been added! Generate more or describe a new goal.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

