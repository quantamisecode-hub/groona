import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Target, Zap, Activity, Info, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function VelocityTracker({ sprints, allStories = [], allTasks = [], sprintId = null }) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Calculate velocity for each sprint based on STORY completion
  // Story = Commitment to value, Task = Execution plan to deliver that value
  // Velocity metrics should be based on story completion, not task completion
  // Only include sprints that are locked (scope committed) or completed
  // If sprintId is provided, only show that sprint's details
  const velocityData = React.useMemo(() => {
    return sprints
      .filter(s => {
        // If sprintId is provided, only include that specific sprint
        if (sprintId) {
          return String(s.id) === String(sprintId);
        }
        // Otherwise, include sprints that are locked (scope committed) or completed
        // Active sprints are only included if they are locked
        if (s.status === 'completed') return true;
        if (s.status === 'active' && s.locked_date) return true;
        if (s.locked_date) return true; // Include any locked sprint regardless of status
        return false;
      })
      .map(sprint => {
        // Get stories assigned to this sprint
        const sprintStories = allStories.filter(s => {
          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
          return String(storySprintId) === String(sprint.id);
        });

        // Calculate committed points: use locked sprint's committed_points if available,
        // otherwise calculate from stories in the sprint at the time of locking
        // Story points are committed when sprint is locked (based on stories in sprint)
        const totalStoryPoints = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
        // Use committed_points if it exists (set when sprint was locked), otherwise use total story points
        const committedPoints = (sprint.committed_points !== undefined && sprint.committed_points !== null)
          ? Number(sprint.committed_points)
          : totalStoryPoints;

        // Get all tasks in the sprint (for task counting)
        // Tasks are execution details and don't affect story points or story completion
        const sprintStoryIds = new Set(sprintStories.map(s => s.id || s._id).map(String));

        const sprintTasks = allTasks.filter(t => {
          const taskSprintId = t.sprint_id?.id || t.sprint_id?._id || t.sprint_id;
          if (String(taskSprintId) === String(sprint.id)) return true;

          const storyId = t.story_id?.id || t.story_id?._id || t.story_id;
          if (storyId && sprintStoryIds.has(String(storyId))) return true;

          return false;
        });

        // Calculate completed points using partial completion based on task completion percentage
        // This gives more accurate velocity metrics by considering partial story completion
        // A story contributes points proportionally based on task completion percentage
        const completedPoints = sprintStories.reduce((sum, story) => {
          const storyId = story.id || story._id;
          const storyStatus = (story.status || '').toLowerCase();
          const storyPoints = Number(story.story_points) || 0;

          // If story status is "done", consider it 100% completed
          if (storyStatus === 'done' || storyStatus === 'completed') {
            return sum + storyPoints;
          }

          // Get tasks that belong to this story (from all tasks, not just sprint tasks)
          const storyTasks = allTasks.filter(t => {
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

        // Count fully completed stories for display (100% task completion or status = "done")
        const completedStories = sprintStories.filter(story => {
          const storyId = story.id || story._id;
          const storyStatus = (story.status || '').toLowerCase();

          // If story status is "done", consider it completed
          if (storyStatus === 'done' || storyStatus === 'completed') {
            return true;
          }

          // Check if ALL tasks under this story are completed
          const storyTasks = allTasks.filter(t => {
            const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
            return String(taskStoryId) === String(storyId);
          });

          // If story has no tasks, it's only completed if status is "done" (already checked above)
          if (storyTasks.length === 0) {
            return false;
          }

          // If story has tasks, check if ALL tasks are completed (100% completion)
          return storyTasks.length > 0 && storyTasks.every(t => t.status === 'completed');
        });

        // Count completed tasks across all tasks in the sprint
        // This shows how many tasks are completed out of total tasks in the sprint
        const completedTasks = sprintTasks.filter(t => t.status === 'completed');
        const completedHours = completedTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

        return {
          name: sprint.name,
          shortName: sprint.name.length > 15 ? sprint.name.substring(0, 15) + '...' : sprint.name,
          committed: committedPoints,
          completed: completedPoints,
          completedStories: completedStories.length,
          totalStories: sprintStories.length,
          completedTasks: completedTasks.length,
          totalTasks: sprintTasks.length,
          hours: completedHours,
          startDate: sprint.start_date,
          status: sprint.status,
          isLocked: !!sprint.locked_date
        };
      })
      .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  }, [sprints, allStories, allTasks, sprintId]);

  // Calculate average velocity from completed sprints only
  const completedSprints = velocityData.filter(v => v.status === 'completed');
  const avgVelocity = completedSprints.length > 0
    ? (completedSprints.reduce((sum, v) => sum + v.completed, 0) / completedSprints.length).toFixed(2)
    : "0.00";

  // Calculate totals from all sprints in velocity data (locked or completed)
  // If showing a single sprint, use that sprint's values directly
  const totalCompleted = sprintId && velocityData.length === 1
    ? (Number(velocityData[0]?.completed) || 0)
    : velocityData.reduce((sum, v) => sum + (Number(v.completed) || 0), 0);
  const totalCommitted = sprintId && velocityData.length === 1
    ? (Number(velocityData[0]?.committed) || 0)
    : velocityData.reduce((sum, v) => sum + (Number(v.committed) || 0), 0);
  const commitmentAccuracy = totalCommitted > 0
    ? ((totalCompleted / totalCommitted) * 100).toFixed(2)
    : "0.00";

  // Recent trend (last 3 sprints)
  const recentVelocities = completedSprints.slice(-3).map(v => v.completed);
  const trend = recentVelocities.length >= 2
    ? recentVelocities[recentVelocities.length - 1] > recentVelocities[0]
      ? 'increasing'
      : recentVelocities[recentVelocities.length - 1] < recentVelocities[0]
        ? 'decreasing'
        : 'stable'
    : 'insufficient-data';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">
                  {sprintId && velocityData.length === 1 ? "Velocity" : "Avg Velocity"}
                </p>
                <p className="text-3xl font-bold text-blue-900">
                  {sprintId && velocityData.length === 1
                    ? (Number(velocityData[0]?.completed) || 0).toFixed(2)
                    : avgVelocity}
                </p>
                <p className="text-xs text-blue-600 mt-1">story points</p>
              </div>
              <Target className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">
                  {sprintId && velocityData.length === 1 ? "Delivered" : "Total Delivered"}
                </p>
                <p className="text-3xl font-bold text-purple-900">{totalCompleted.toFixed(2)}</p>
                <p className="text-xs text-purple-600 mt-1">story points</p>
              </div>
              <Zap className="h-10 w-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Commitment</p>
                <p className="text-3xl font-bold text-green-900">{commitmentAccuracy}%</p>
                <p className="text-xs text-green-600 mt-1">accuracy</p>
              </div>
              <Activity className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${trend === 'increasing' ? 'from-green-50 to-emerald-100 border-green-200' :
          trend === 'decreasing' ? 'from-red-50 to-red-100 border-red-200' :
            'from-slate-50 to-slate-100 border-slate-200'
          }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${trend === 'increasing' ? 'text-green-700' :
                  trend === 'decreasing' ? 'text-red-700' :
                    'text-slate-700'
                  }`}>Velocity Trend</p>
                <p className={`text-2xl font-bold ${trend === 'increasing' ? 'text-green-900' :
                  trend === 'decreasing' ? 'text-red-900' :
                    'text-slate-900'
                  }`}>
                  {trend === 'increasing' ? '↗ Up' : trend === 'decreasing' ? '↘ Down' : '→ Stable'}
                </p>
              </div>
              <TrendingUp className={`h-10 w-10 ${trend === 'increasing' ? 'text-green-600' :
                trend === 'decreasing' ? 'text-red-600' :
                  'text-slate-600'
                }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Velocity Chart */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle>Sprint Velocity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {velocityData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Activity className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>Complete at least one sprint to see velocity tracking</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shortName" fontSize={12} />
                <YAxis fontSize={12} label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
                <Legend />
                <Bar dataKey="committed" fill="#94a3b8" name="Committed" />
                <Bar dataKey="completed" fill="#3b82f6" name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Sprint Details Table */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle>Sprint Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          {velocityData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No sprint data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">Sprint</th>
                    <th className="text-center py-3 px-2 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">Committed</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">Completed</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">Stories</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">Tasks</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-700">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {velocityData.map((sprint, idx) => {
                    const committed = Number(sprint.committed) || 0;
                    const completed = Number(sprint.completed) || 0;
                    // Calculate accuracy percentage based on partial completion
                    // This gives accurate percentage by averaging task completion across all stories
                    const accuracy = committed > 0
                      ? ((completed / committed) * 100).toFixed(2)
                      : "0.00";

                    return (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-2 text-sm text-slate-900">{sprint.name}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant={sprint.status === 'completed' ? 'secondary' : 'default'} className="capitalize">
                            {sprint.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right text-sm text-slate-700">{Number(sprint.committed) || 0} pts</td>
                        <td className="py-3 px-2 text-right text-sm font-semibold text-blue-700">
                          {Number(sprint.completed) > 0
                            ? Number(sprint.completed).toFixed(2)
                            : "0.00"} pts
                        </td>
                        <td className="py-3 px-2 text-right text-sm text-slate-600">
                          {sprint.completedStories}/{sprint.totalStories}
                        </td>
                        <td className="py-3 px-2 text-right text-sm text-slate-600">
                          {sprint.completedTasks}/{sprint.totalTasks}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`text-sm font-medium ${accuracy >= 90 ? 'text-green-600' :
                            accuracy >= 70 ? 'text-blue-600' :
                              accuracy >= 50 ? 'text-amber-600' :
                                'text-red-600'
                            }`}>
                            {accuracy}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Velocity Calculation Guide */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-0">
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-slate-600 flex-shrink-0" />
              <h4 className="font-semibold text-slate-900">How Velocity Metrics are Calculated</h4>
            </div>
            {isGuideOpen ? (
              <ChevronDown className="h-5 w-5 text-slate-600" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-600" />
            )}
          </button>
          {isGuideOpen && (
            <div className="px-4 pb-4 pt-2">
              <div className="text-sm text-slate-900 space-y-3">
                <div>
                  <p className="font-semibold mb-2 text-slate-900">Core Principle:</p>
                  <p><strong>Story = Commitment to value</strong> | <strong>Task = Execution plan to deliver that value</strong></p>
                  <p className="text-xs text-slate-600 mt-1">Velocity metrics are based on story completion, not individual task completion.</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Committed Points:</p>
                  <p>When a sprint is locked, the committed points are set based on the sum of story points from all stories assigned to that sprint.</p>
                  <p className="text-xs text-slate-600 mt-1">Formula: Sum of all story.story_points for stories in the sprint</p>
                  <p className="text-xs text-slate-600">Example: If Sprint has 3 stories with 5, 3, and 8 points → Committed = 16 points</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Completed Points (Partial Completion Logic):</p>
                  <p>Completed points are calculated using partial story completion based on task completion percentage:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1 text-xs text-slate-600">
                    <li>If story status = "Done" or "Completed" → Story contributes 100% of its points</li>
                    <li>Otherwise: Completed Points = (Completed Tasks ÷ Total Tasks) × Story Points</li>
                    <li>If story has no tasks and status is not "Done" → Contributes 0 points</li>
                  </ul>
                  <p className="text-xs text-slate-600 mt-1">Example: Story with 5 points, 2 out of 4 tasks completed = (2 ÷ 4) × 5 = 2.5 points</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Average Velocity:</p>
                  <p>Calculated only from completed sprints: Sum of completed points ÷ Number of completed sprints</p>
                  <p className="text-xs text-slate-600 mt-1">Only sprints with status = "Completed" are included in the average.</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Total Delivered:</p>
                  <p>Sum of all completed points across all sprints in the velocity data (locked or completed sprints).</p>
                  {sprintId && (
                    <p className="text-xs text-slate-600 mt-1">In single sprint view, shows that sprint's completed points.</p>
                  )}
                </div>

                <div>
                  <p className="font-medium mb-1">Commitment Accuracy:</p>
                  <p>Formula: (Total Completed Points ÷ Total Committed Points) × 100</p>
                  <p className="text-xs text-slate-600 mt-1">Shows how well the team met their committed story points across all sprints.</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Story Completion:</p>
                  <p>A story is considered fully completed if:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5 text-xs text-slate-600">
                    <li>Story status = "Done" or "Completed", OR</li>
                    <li>ALL tasks under that story have status = "Completed"</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium mb-1">Task Completion:</p>
                  <p>Shows the count of completed tasks out of total tasks in the sprint.</p>
                  <p className="text-xs text-slate-600 mt-1">Tasks are execution details and don't directly affect story points, but their completion determines partial story completion.</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Accuracy (Sprint Performance Details):</p>
                  <p>Formula: (Completed Points ÷ Committed Points) × 100</p>
                  <p className="text-xs text-slate-600 mt-1">Uses partial completion logic, so accuracy reflects actual progress even if stories aren't 100% complete.</p>
                </div>

                <div>
                  <p className="font-medium mb-1">Velocity Trend:</p>
                  <p>Compares the last 3 completed sprints:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5 text-xs text-slate-600">
                    <li><strong>↗ Up:</strong> Last sprint's velocity &gt; First sprint's velocity</li>
                    <li><strong>↘ Down:</strong> Last sprint's velocity &lt; First sprint's velocity</li>
                    <li><strong>→ Stable:</strong> Velocities are equal, or insufficient data (&lt; 2 sprints)</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium mb-1">Sprint Inclusion:</p>
                  <p>Only sprints that are locked (scope committed) or completed are included in velocity calculations.</p>
                  <p className="text-xs text-slate-600 mt-1">Active sprints are only included if they have a locked_date (scope is committed).</p>
                </div>

                <div className="mt-3 p-2 bg-slate-100 rounded text-xs">
                  <p className="font-medium">Note:</p>
                  <p>All point values are displayed with 2 decimal places for precision. Partial story completion ensures accurate velocity tracking even when stories are in progress.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}