import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
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
    <div className="space-y-8 pb-10">
      {/* Summary Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Tasks', value: totalTasks, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50', subtext: 'Total backlog' },
          { label: 'Completed', value: completedTasks, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', subtext: `${completionRate}% rate` },
          { label: 'In Progress', value: inProgressTasks, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', subtext: 'Active workload' },
          { label: 'Overdue', value: overdueTasks, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', subtext: 'System alerts' }
        ].map((stat, idx) => (
          <Card key={idx} className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px] overflow-hidden transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`h-11 w-11 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} shadow-sm border border-white/50`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-60">
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.subtext}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task Status Distribution */}
        <Card className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                  <Target className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Workflow status</CardTitle>
                  <span className="text-lg font-black text-slate-800 tracking-tight uppercase">Task Distribution</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                    animationEasing="ease-out"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-100 min-w-[150px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-50">{payload[0].name}</p>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
                                <span className="text-[13px] font-black text-slate-800">{payload[0].value} Tasks</span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-400">
                                {((payload[0].value / (totalTasks || 1)) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">{value}</span>}
                    wrapperStyle={{ paddingTop: '30px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card className="bg-white/70 backdrop-blur-xl border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm border border-purple-100/50">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Urgency levels</CardTitle>
                  <span className="text-lg font-black text-slate-800 tracking-tight uppercase">Priority Breakdown</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    fontFamily="inherit"
                    fontWeight={800}
                    tick={{ fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    textAnchor="middle"
                    className="uppercase"
                  />
                  <YAxis
                    fontSize={10}
                    fontFamily="inherit"
                    fontWeight={800}
                    tick={{ fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc', radius: [12, 12, 0, 0] }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-100 min-w-[150px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-50">{label}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-black text-slate-800">{payload[0].value} Tasks</span>
                              <div className="h-2 w-2 rounded-full bg-purple-500" />
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#6366f1"
                    radius={[12, 12, 4, 4]}
                    barSize={45}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Calculation Guide */}
      <Card className="bg-white/40 backdrop-blur-sm border-slate-200/50 shadow-sm rounded-[24px] overflow-hidden">
        <CardContent className="p-0">
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full p-6 flex items-center justify-between hover:bg-white/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-indigo-600 transition-colors">
                <Info className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">How Metrics are Calculated</h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Learn about the system algorithms</p>
              </div>
            </div>
            {isGuideOpen ? (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-400" />
            )}
          </button>
          {isGuideOpen && (
            <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 border-t border-slate-100/50 mt-2">
              {[
                { title: 'Total Backlog', desc: 'Cumulative count of all functional tasks currently mapped to this specific sprint increment.' },
                { title: 'Velocity Tracking', desc: 'Measured by tasks moved to "Completed". The completion rate is calculated as total output vs planned scope.' },
                { title: 'Active Overhead', desc: 'Identified by "In Progress" states. This reflects the immediate concurrency of work across the team.' },
                { title: 'SLA Exceptions', desc: 'Triggered when task due_date exceeds current timestamp without achieving "Completed" status.' },
                { title: 'Status Distribution', desc: 'Aggregated breakdown of the sprint ecosystem across all defined workflow stages.' },
                { title: 'Urgency Heatmap', desc: 'A statistical representation of task density across defined priority tiers from low to urgent.' }
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights Section */}
      {!hideAI && (
        <Card className="bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 border-indigo-100/50 shadow-[0_20px_50px_rgba(99,102,241,0.1)] rounded-[32px] overflow-hidden border">
          <CardHeader className="p-8 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-[22px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">AI Sprint Insights</CardTitle>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">Neural performance analysis & risk assessment</p>
                </div>
              </div>
              <Button
                onClick={generateAIInsights}
                disabled={isGeneratingInsights}
                className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-95 text-white h-12 rounded-lg px-8 font-black transition-all active:scale-[0.98] text-xs flex items-center gap-3"
              >
                {isGeneratingInsights ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                GENERATE ANALYSIS
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {aiInsights ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white/60 backdrop-blur-md rounded-[24px] border border-white/50 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Target className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Sprint Health Assessment</h4>
                  </div>
                  <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{aiInsights.health_assessment}</p>
                </div>

                {/* Display other AI insights if needed */}
                {aiInsights.achievements && (
                  <div className="p-6 bg-indigo-50/30 rounded-[24px] border border-indigo-100/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Neural Predictions</h4>
                    </div>
                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{aiInsights.predictions}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-[24px] border border-dashed border-slate-200">
                <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Sparkles className="h-8 w-8 text-indigo-200" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Ready for analysis</h3>
                <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">Click generate to let our neural engine analyze your current sprint performance data.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

