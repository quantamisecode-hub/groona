import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CheckCircle, Clock, AlertCircle, Target, Sparkles, Loader2, Info, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function SprintMetrics({ sprint, tasks, hideAI = false, currentUser = null }) {
  const [aiInsights, setAiInsights] = useState(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Use all tasks for all users (project managers and viewers see same data as admins)
  const filteredTasks = tasks;

  // Calculate metrics using all tasks
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress').length;
  const reviewTasks = filteredTasks.filter(t => t.status === 'review').length;
  const todoTasks = filteredTasks.filter(t => t.status === 'todo').length;
  
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;
  
  const overdueTasks = filteredTasks.filter(t => 
    t.due_date && 
    new Date(t.due_date) < new Date() && 
    t.status !== 'completed'
  ).length;

  // Task status distribution
  const statusData = [
    { name: 'To Do', value: todoTasks, color: '#94a3b8' },
    { name: 'In Progress', value: inProgressTasks, color: '#3b82f6' },
    { name: 'Review', value: reviewTasks, color: '#f59e0b' },
    { name: 'Done', value: completedTasks, color: '#10b981' },
  ];

  // Priority distribution using filtered tasks
  const priorities = {};
  filteredTasks.forEach(t => {
    priorities[t.priority] = (priorities[t.priority] || 0) + 1;
  });
  const priorityData = Object.entries(priorities).map(([name, value]) => ({ name, value }));

  const generateAIInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const prompt = `Analyze sprint: ${sprint.name}. Completed: ${completedTasks}/${totalTasks}. Provide insights.`;
      
      const result = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            health_assessment: { type: "string" },
            achievements: { type: "array", items: { type: "string" } },
            concerns: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
            predictions: { type: "string" }
          }
        }
      });
      setAiInsights(result);
    } catch (error) {
      console.error('AI insights error:', error);
      toast.error('Failed to generate AI insights');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Tasks</p>
                <p className="text-3xl font-bold text-slate-900">{totalTasks}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
                <p className="text-xs text-slate-500 mt-1">{completionRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{inProgressTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overdueTasks}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Calculation Guide */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardContent className="p-0">
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-slate-600 flex-shrink-0" />
              <h4 className="font-semibold text-slate-900">How Metrics are Calculated</h4>
            </div>
            {isGuideOpen ? (
              <ChevronDown className="h-5 w-5 text-slate-600" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-600" />
            )}
          </button>
          {isGuideOpen && (
            <div className="px-4 pb-4 pt-2">
              <div className="text-sm text-slate-900 space-y-2">
                <div>
                  <p className="font-medium mb-1">Total Tasks:</p>
                  <p>Count of all tasks assigned to this sprint.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Completed Tasks:</p>
                  <p>Number of tasks with status = "Completed".</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Completion Rate:</p>
                  <p>Formula: (Completed Tasks ÷ Total Tasks) × 100</p>
                  <p className="text-xs text-slate-600 mt-1">Example: If 8 out of 10 tasks are completed, Completion Rate = (8 ÷ 10) × 100 = 80%</p>
                </div>
                <div>
                  <p className="font-medium mb-1">In Progress Tasks:</p>
                  <p>Number of tasks with status = "In_Progress".</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Overdue Tasks:</p>
                  <p>Tasks where due_date is in the past AND status is not "Completed".</p>
                  <p className="text-xs text-slate-600 mt-1">Only tasks with a due date are considered for overdue calculation.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Task Status Distribution:</p>
                  <p>Pie chart showing the breakdown of tasks by status:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                    <li><span className="font-medium">To Do:</span> Tasks with status = "Todo"</li>
                    <li><span className="font-medium">In Progress:</span> Tasks with status = "In_Progress"</li>
                    <li><span className="font-medium">Review:</span> Tasks with status = "Review"</li>
                    <li><span className="font-medium">Done:</span> Tasks with status = "Completed"</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">Priority Distribution:</p>
                  <p>Bar chart showing the count of tasks grouped by priority level (High, Medium, Low, etc.).</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights - Conditionally Rendered based on hideAI prop */}
      {!hideAI && (
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200/60 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Sprint Insights
              </CardTitle>
              <Button
                onClick={generateAIInsights}
                disabled={isGeneratingInsights}
                className="bg-gradient-to-r from-purple-500 to-blue-600 text-white"
              >
                {isGeneratingInsights ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Insights
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* AI Content Placeholder */}
            {aiInsights ? (
               <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg">
                    <h4 className="font-semibold text-slate-900 mb-2">Sprint Health</h4>
                    <p className="text-slate-700">{aiInsights.health_assessment}</p>
                  </div>
               </div>
            ) : (
                <div className="text-center text-slate-500 py-6">
                    Click Generate to analyze sprint performance.
                </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

