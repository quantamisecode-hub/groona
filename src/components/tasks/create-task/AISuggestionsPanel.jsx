import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Target, Clock, Tag, Link as LinkIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";

// Helper to map points to hours
const getHoursFromPoints = (points) => {
  const map = { 0: 0, 1: 2, 2: 4, 3: 8, 5: 16, 8: 32, 13: 64 };
  return map[points] || 0;
};

export default function AISuggestionsPanel({ taskData, setTaskData, tasks, currentUser }) {
  const [loadingAction, setLoadingAction] = useState(null);
  
  const [suggestions, setSuggestions] = useState({
    priority: null,
    effort: null,
    tags: [],
    dependencies: [],
  });

  const generateFullTask = async () => {
    if (!taskData.title?.trim()) {
      toast.error('Please enter a task title first');
      return;
    }

    setLoadingAction('generateFullTask');
    try {
      const prompt = `You are a project management expert. Based on the task title "${taskData.title}", generate comprehensive task details.
      
      Output JSON strictly.
      1. detailed description (2-3 sentences)
      2. priority (low/medium/high/urgent)
      3. story_points (Fibonacci: 1, 2, 3, 5, 8, 13)
      4. labels (array of strings)
      5. acceptance_criteria (plain text bullet points, DO NOT use bolding or markdown stars like **text**)
      6. subtasks (array of strings)
      
      Context: Software development task.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" },
            priority: { type: "string" },
            story_points: { type: "number" },
            labels: { type: "array", items: { type: "string" } },
            acceptance_criteria: { type: "string" },
            subtasks: { type: "array", items: { type: "string" } }
          }
        }
      });

      // FIXED: Calculate hours from AI suggested points
      const suggestedPoints = typeof result.story_points === 'number' ? result.story_points : (taskData.story_points || 0);
      const calculatedHours = getHoursFromPoints(suggestedPoints);

      setTaskData(prev => ({
        ...prev,
        description: result.description || prev.description,
        priority: ['low', 'medium', 'high', 'urgent'].includes(result.priority?.toLowerCase()) ? result.priority.toLowerCase() : prev.priority,
        story_points: suggestedPoints,
        estimated_hours: calculatedHours, // <--- SYNCED HOURS
        labels: [...new Set([...(prev.labels || []), ...(result.labels || [])])],
        acceptance_criteria: result.acceptance_criteria || prev.acceptance_criteria,
        subtasks: [
          ...(prev.subtasks || []),
          ...(result.subtasks || []).map(title => ({ title, completed: false }))
        ],
        ai_generated: true,
      }));

      toast.success('Task details generated with AI!');
    } catch (error) {
      toast.error('Failed to generate task details');
      console.error('[AI] Error:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const predictPriority = async () => {
    const title = taskData.title || "";
    const desc = taskData.description || "";

    if (!title.trim() && !desc.trim()) {
      toast.error('Add a title or description first');
      return;
    }

    setLoadingAction('predictPriority');
    try {
      const existingTasks = (tasks || []).slice(0, 5).map(t => 
        `Title: ${t.title}, Priority: ${t.priority}`
      ).join('\n');

      const prompt = `Predict the priority (low/medium/high/urgent) for this task.
      
      Task: ${title}
      Description: ${desc}
      
      Reference (Similar Tasks):
      ${existingTasks}
      
      Return JSON with priority, reasoning, and confidence (0-100).`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            priority: { type: "string" },
            reasoning: { type: "string" },
            confidence: { type: "number" }
          }
        }
      });

      if (result?.priority && ['low', 'medium', 'high', 'urgent'].includes(result.priority.toLowerCase())) {
        const priorityVal = result.priority.toLowerCase();
        
        setTaskData(prev => ({
          ...prev,
          priority: priorityVal,
          ai_metadata: {
            ...(prev.ai_metadata || {}),
            priority_confidence: result.confidence,
          }
        }));
        
        setSuggestions(prev => ({
          ...prev,
          priority: { value: priorityVal, reasoning: result.reasoning, confidence: result.confidence }
        }));
        
        toast.success(`Priority predicted: ${priorityVal}`);
      } else {
        toast.error('Could not confidently predict priority');
      }
    } catch (error) {
      toast.error('Failed to predict priority');
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const estimateEffort = async () => {
    const title = taskData.title || "";
    const desc = taskData.description || "";

    if (!title.trim() && !desc.trim()) {
      toast.error('Add a title or description first');
      return;
    }

    setLoadingAction('estimateEffort');
    try {
      const prompt = `Estimate Story Points (Fibonacci: 1, 2, 3, 5, 8, 13) for this task.
      
      Task: ${title}
      Description: ${desc}
      Type: ${taskData.task_type || 'task'}
      
      Output JSON with 'story_points' (number) and 'reasoning'. If unsure, default to 1.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            story_points: { type: "number" },
            reasoning: { type: "string" },
            confidence: { type: "number" }
          }
        }
      });

      if (typeof result?.story_points === 'number') {
        // FIXED: Calculate hours from AI estimated points
        const estPoints = result.story_points;
        const estHours = getHoursFromPoints(estPoints);

        setTaskData(prev => ({
          ...prev,
          story_points: estPoints,
          estimated_hours: estHours, // <--- SYNCED HOURS
          ai_metadata: {
            ...(prev.ai_metadata || {}),
            effort_confidence: result.confidence,
          }
        }));

        setSuggestions(prev => ({
          ...prev,
          effort: { value: estPoints, reasoning: result.reasoning, confidence: result.confidence }
        }));

        toast.success(`Effort estimated: ${estPoints} SP`);
      } else {
        toast.warning("AI could not estimate effort.");
      }
    } catch (error) {
      toast.error('Failed to estimate effort');
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const recommendTags = async () => {
    const title = taskData.title || "";
    const desc = taskData.description || "";

    if (!title.trim() && !desc.trim()) {
      toast.error('Add a title or description first');
      return;
    }

    setLoadingAction('recommendTags');
    try {
      const prompt = `Suggest 3-5 short, relevant tags for this software task.
      
      Task: ${title}
      Description: ${desc}
      
      Output JSON with 'tags' array.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" } }
          }
        }
      });

      const newTags = result?.tags || [];
      
      setSuggestions(prev => ({
        ...prev,
        tags: newTags
      }));

      if (newTags.length > 0) {
        toast.success(`${newTags.length} tags suggested`);
      } else {
        toast.info("No relevant tags found");
      }
    } catch (error) {
      toast.error('Failed to recommend tags');
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const detectDependencies = async () => {
    if (!taskData.title?.trim()) {
      toast.error('Add a title first');
      return;
    }

    const currentTasks = tasks || [];
    if (currentTasks.length === 0) {
      toast.error('No existing tasks to analyze');
      return;
    }

    setLoadingAction('detectDependencies');
    try {
      const tasksList = currentTasks.slice(0, 40).map(t => 
        `- ID: "${t.id}", Title: "${t.title}"`
      ).join('\n');

      const prompt = `Analyze the new task and the list of existing tasks.
      
      New Task: "${taskData.title}"
      Description: "${taskData.description || ''}"
      
      Existing Tasks:
      ${tasksList}
      
      Goal: Identify existing tasks that are likely prerequisites, blockers, or strongly related to the new task.
      Be lenient: if a task seems related or contextually relevant, include it.
      
      Return JSON with:
      - 'dependency_ids': array of exact ID strings from the list.
      - 'reasoning': short explanation.`;

      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            dependency_ids: { type: "array", items: { type: "string" } },
            reasoning: { type: "string" }
          }
        }
      });

      const foundIds = result?.dependency_ids || [];

      setSuggestions(prev => ({
        ...prev,
        dependencies: foundIds
      }));

      if (foundIds.length > 0) {
        toast.success(`${foundIds.length} dependencies detected`);
      } else {
        toast.info("No obvious dependencies found");
      }
    } catch (error) {
      toast.error('Failed to detect dependencies');
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const applySuggestedTags = () => {
    setTaskData(prev => ({
      ...prev,
      labels: [...new Set([...(prev.labels || []), ...suggestions.tags])]
    }));
    toast.success('Tags applied');
  };

  const applySuggestedDependencies = () => {
    setTaskData(prev => ({
      ...prev,
      dependencies: [...new Set([...(prev.dependencies || []), ...suggestions.dependencies])]
    }));
    toast.success('Dependencies applied');
  };

  return (
    <div className="h-full w-full bg-white overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">AI Suggestions</h3>
        </div>

        {/* Generate Full Task */}
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <div className="flex items-start gap-3 mb-3">
            <Wand2 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-slate-900 mb-1">AI Task Generator</h4>
              <p className="text-xs text-slate-600">
                Generate comprehensive task details from your title
              </p>
            </div>
          </div>
          <Button
            onClick={generateFullTask}
            disabled={loadingAction !== null || !taskData.title?.trim()}
            size="sm"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {loadingAction === 'generateFullTask' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate with AI
          </Button>
        </Card>

        {/* Priority Predictor */}
        <Card className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <Target className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-slate-900 mb-1">Priority Predictor</h4>
              <p className="text-xs text-slate-600">AI predicts task priority based on content</p>
            </div>
          </div>
          <Button
            onClick={predictPriority}
            disabled={loadingAction !== null}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {loadingAction === 'predictPriority' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Predict Priority
          </Button>
          {suggestions.priority && (
            <div className="mt-2 p-2 bg-orange-50 rounded text-xs">
              <Badge className="mb-1">{suggestions.priority.value}</Badge>
              <p className="text-slate-600">{suggestions.priority.reasoning}</p>
              <p className="text-slate-500 mt-1">Confidence: {suggestions.priority.confidence}%</p>
            </div>
          )}
        </Card>

        {/* Effort Estimator */}
        <Card className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-slate-900 mb-1">Effort Estimator</h4>
              <p className="text-xs text-slate-600">Estimate story points automatically</p>
            </div>
          </div>
          <Button
            onClick={estimateEffort}
            disabled={loadingAction !== null}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {loadingAction === 'estimateEffort' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Estimate Effort
          </Button>
          {suggestions.effort && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
              <Badge className="mb-1">{suggestions.effort.value} SP</Badge>
              <p className="text-slate-600">{suggestions.effort.reasoning}</p>
            </div>
          )}
        </Card>

        {/* Tag Recommender */}
        <Card className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <Tag className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-slate-900 mb-1">Tag Recommendation</h4>
              <p className="text-xs text-slate-600">Get AI-suggested tags for better organization</p>
            </div>
          </div>
          <Button
            onClick={recommendTags}
            disabled={loadingAction !== null}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {loadingAction === 'recommendTags' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Suggest Tags
          </Button>
          {suggestions.tags.length > 0 ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {suggestions.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button
                onClick={applySuggestedTags}
                size="sm"
                variant="ghost"
                className="w-full text-xs"
              >
                Apply All
              </Button>
            </div>
          ) : (
             <div className="mt-2 text-xs text-slate-400 italic text-center">No tags generated yet</div>
          )}
        </Card>

        {/* Dependency Detector */}
        <Card className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <LinkIcon className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-slate-900 mb-1">Dependency Detection</h4>
              <p className="text-xs text-slate-600">Find related tasks automatically</p>
            </div>
          </div>
          <Button
            onClick={detectDependencies}
            disabled={loadingAction !== null || (tasks || []).length === 0}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {loadingAction === 'detectDependencies' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Detect Dependencies
          </Button>
          {suggestions.dependencies.length > 0 ? (
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                {suggestions.dependencies.map((depId) => {
                  const task = (tasks || []).find(t => t.id === depId);
                  return task ? (
                    <div key={depId} className="text-xs p-1 bg-indigo-50 rounded">
                      {task.title}
                    </div>
                  ) : null;
                })}
              </div>
              <Button
                onClick={applySuggestedDependencies}
                size="sm"
                variant="ghost"
                className="w-full text-xs"
              >
                Apply All
              </Button>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400 italic text-center">No dependencies found yet</div>
          )}
        </Card>
      </div>
    </div>
  );
}

