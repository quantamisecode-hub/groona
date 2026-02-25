import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertCircle, Info, ChevronDown, ChevronRight } from "lucide-react";

export default function ProgressWidget({ tasks, stories = [], project }) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.due_date) return false;
    return new Date(t.due_date) < new Date();
  }).length;

  const completedStoryPoints = stories.reduce((sum, story) => {
    const status = (story.status || '').toLowerCase();
    const storyPoints = Number(story.story_points) || 0;

    // 1. Full points if story is done
    if (status === 'done' || status === 'completed') {
      return sum + storyPoints;
    }

    // 2. Partial points based on task completion
    const storyTasks = tasks.filter(t => {
      const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
      const storyId = story.id || story._id;
      return String(taskStoryId) === String(storyId);
    });

    if (storyTasks.length === 0) return sum;

    const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
    const completionPercentage = completedTasksCount / storyTasks.length;

    // Add partial points (e.g., 5 points * 0.5 completion = 2.5 points)
    return sum + (storyPoints * completionPercentage);
  }, 0);

  const totalStoryPoints = stories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

  const progress = totalStoryPoints === 0 ? 0 : Math.round((completedStoryPoints / totalStoryPoints) * 100);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Overall Task Progress</CardTitle>
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label="Toggle guide"
          >
            {isGuideOpen ? (
              <ChevronDown className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
        {isGuideOpen && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">
                This progress is calculated based on completed Story Points. The percentage shows (Completed Points ÷ Total Points) × 100.
              </p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center pt-2">
          <div className="text-4xl font-bold text-blue-600">{progress}%</div>
          <p className="text-sm text-slate-500">Completion Rate</p>
        </div>

        <Progress value={progress} className="h-3" />

        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="flex flex-col items-center p-2 bg-green-50 rounded-lg border border-green-100">
            <CheckCircle2 className="h-4 w-4 text-green-600 mb-1" />
            <span className="text-lg font-bold text-green-700">{Number(completedStoryPoints.toFixed(2))}</span>
            <span className="text-[10px] text-green-600 uppercase tracking-wide">Points Done</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-blue-50 rounded-lg border border-blue-100">
            <Clock className="h-4 w-4 text-blue-600 mb-1" />
            <span className="text-lg font-bold text-blue-700">{Number((totalStoryPoints - completedStoryPoints).toFixed(2))}</span>
            <span className="text-[10px] text-blue-600 uppercase tracking-wide">Points Left</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-purple-50 rounded-lg border border-purple-100">
            <AlertCircle className="h-4 w-4 text-purple-600 mb-1" />
            <span className="text-lg font-bold text-purple-700">{Number(totalStoryPoints.toFixed(2))}</span>
            <span className="text-[10px] text-purple-600 uppercase tracking-wide">Total Points</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}