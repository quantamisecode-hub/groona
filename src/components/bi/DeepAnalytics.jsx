import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Activity, Loader2, Sparkles, Target, Clock, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function DeepAnalytics({ projects, tasks, users, activities, tenants = [] }) {
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Filter data by selected tenant
  const filteredUsers = selectedTenant === "all" ? users : users.filter(u => u.tenant_id === selectedTenant);
  const filteredProjects = selectedTenant === "all" ? projects : projects.filter(p => p.tenant_id === selectedTenant);
  const filteredTasks = selectedTenant === "all" ? tasks : tasks.filter(t => t.tenant_id === selectedTenant);
  const filteredActivities = selectedTenant === "all" ? activities : activities.filter(a => a.tenant_id === selectedTenant);

  // Generate Deep AI Analysis
  const generateDeepAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const scopeName = selectedTenant === "all" ? "Platform-Wide" : tenants.find(t => t.id === selectedTenant)?.name || "Tenant";

      const prompt = `Perform a comprehensive deep analytics analysis for ${scopeName}:

**User Metrics:**
- Total Users: ${filteredUsers.length}
- Active Users (last 7 days): ${filteredUsers.filter(u => u.last_login && new Date(u.last_login) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
- User Distribution: Admins(${filteredUsers.filter(u => u.role === 'admin').length}), Users(${filteredUsers.filter(u => u.role === 'user').length})

**Project Metrics:**
- Total Projects: ${filteredProjects.length}
- Active Projects: ${filteredProjects.filter(p => p.status === 'active').length}
- Completed Projects: ${filteredProjects.filter(p => p.status === 'completed').length}
- On-Hold Projects: ${filteredProjects.filter(p => p.status === 'on_hold').length}

**Task Metrics:**
- Total Tasks: ${filteredTasks.length}
- Completed: ${filteredTasks.filter(t => t.status === 'completed').length}
- In Progress: ${filteredTasks.filter(t => t.status === 'in_progress').length}
- Todo: ${filteredTasks.filter(t => t.status === 'todo').length}
- Completion Rate: ${filteredTasks.length > 0 ? ((filteredTasks.filter(t => t.status === 'completed').length / filteredTasks.length) * 100).toFixed(1) : 0}%

**Activity Metrics:**
- Total Activities: ${filteredActivities.length}
- Recent Activity (7d): ${filteredActivities.filter(a => new Date(a.created_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}

Please provide a comprehensive analysis with:
1. Performance trends and patterns
2. User engagement insights
3. Project health assessment
4. Productivity metrics
5. Risk factors and bottlenecks
6. Growth opportunities
7. Efficiency recommendations
8. Predictive insights

Format as JSON with sections: performance_trends, engagement_insights, project_health, productivity_metrics, risk_factors, growth_opportunities, efficiency_recommendations, predictive_insights`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            performance_trends: { type: "array", items: { type: "string" } },
            engagement_insights: { type: "array", items: { type: "string" } },
            project_health: { type: "array", items: { type: "string" } },
            productivity_metrics: { type: "array", items: { type: "string" } },
            risk_factors: { type: "array", items: { type: "string" } },
            growth_opportunities: { type: "array", items: { type: "string" } },
            efficiency_recommendations: { type: "array", items: { type: "string" } },
            predictive_insights: { type: "array", items: { type: "string" } }
          }
        }
      });

      console.log("Raw AI Analysis Response:", response); // DEBUG LOG

      // Handle both string (JSON) and object responses safely
      let parsedResponse = response;
      if (typeof response === 'string') {
        try {
          // Attempt to strip Markdown fences if present
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          parsedResponse = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
          console.warn("Failed to parse AI response as JSON", e);
          parsedResponse = {}; // Fallback to avoid crash
        }
      }

      setAiAnalysis(parsedResponse || {});
      toast.success("Deep AI analysis complete!");
    } catch (error) {
      console.error("Failed to generate analysis:", error);
      toast.error("Failed to generate AI analysis");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Calculate metrics
  const metrics = {
    totalUsers: filteredUsers.length,
    activeUsers: filteredUsers.filter(u => u.last_login && new Date(u.last_login) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    totalProjects: filteredProjects.length,
    activeProjects: filteredProjects.filter(p => p.status === 'active').length,
    totalTasks: filteredTasks.length,
    completedTasks: filteredTasks.filter(t => t.status === 'completed').length,
    taskCompletionRate: filteredTasks.length > 0 ? ((filteredTasks.filter(t => t.status === 'completed').length / filteredTasks.length) * 100).toFixed(1) : 0,
    recentActivity: filteredActivities.filter(a => new Date(a.created_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
  };

  // Helper to safely map list items with Key Normalization
  const renderList = (list) => {
    // Basic validation
    if (!list || !Array.isArray(list) || list.length === 0) {
      return <li className="text-sm text-slate-500 italic">No insights available.</li>;
    }
    return list.map((item, idx) => (
      <li key={idx} className="flex items-start gap-2 text-sm">
        <span className="text-slate-400 font-bold">•</span>
        <span className="text-slate-700">{item}</span>
      </li>
    ));
  };

  // Helper to get data safely even if case differs - always returns an array
  const getAnalysisData = (key) => {
    if (!aiAnalysis) return [];
    // Try exact match
    let data = aiAnalysis[key];
    if (!data) {
      // Try snake_case vs camelCase
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      data = aiAnalysis[camelKey];
    }
    // Ensure we always return an array
    if (!data) return [];
    if (Array.isArray(data)) return data;
    // If it's a string, split by newlines or return as single item array
    if (typeof data === 'string') return data.split('\n').filter(line => line.trim());
    // If it's an object, try to extract array values
    if (typeof data === 'object') {
      const values = Object.values(data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
      return values.filter(v => typeof v === 'string');
    }
    return [];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900">Deep Analytics</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">AI-powered insights and comprehensive platform analytics</p>
        </div>
        <Button
          onClick={generateDeepAnalysis}
          disabled={loadingAnalysis}
          className="bg-gradient-to-r from-blue-600 to-slate-900 hover:from-blue-700 hover:to-slate-950 border-0 shadow-lg shadow-blue-500/20 text-white h-10 rounded-lg px-4 font-bold transition-all active:scale-95 hover:opacity-90"
        >
          {loadingAnalysis ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Analysis
            </>
          )}
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Users</p>
                <p className="text-4xl font-black text-blue-600 leading-tight">{metrics.totalUsers}</p>
                <p className="text-xs font-bold text-emerald-500">{metrics.activeUsers} active (7d)</p>
              </div>
              <Users className="h-12 w-12 text-blue-500/10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Projects</p>
                <p className="text-4xl font-black text-purple-600 leading-tight">{metrics.totalProjects}</p>
                <p className="text-xs font-bold text-emerald-500">{metrics.activeProjects} active</p>
              </div>
              <Target className="h-12 w-12 text-purple-500/10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Task Completion</p>
                <p className="text-4xl font-black text-emerald-600 leading-tight">{metrics.taskCompletionRate}%</p>
                <p className="text-xs font-bold text-slate-400">{metrics.completedTasks}/{metrics.totalTasks} tasks</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-emerald-500/10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Activity (7d)</p>
                <p className="text-4xl font-black text-amber-600 leading-tight">{metrics.recentActivity}</p>
                <p className="text-xs font-bold text-slate-400">Platform actions</p>
              </div>
              <Activity className="h-12 w-12 text-amber-500/10" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis Results */}
      {aiAnalysis ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100/80 p-1 rounded-xl justify-start gap-1">
            <TabsTrigger value="overview" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Performance</TabsTrigger>
            <TabsTrigger value="risks" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Risks & Issues</TabsTrigger>
            <TabsTrigger value="opportunities" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Opportunities</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border border-slate-200/60 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Performance Trends</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {renderList(getAnalysisData('performance_trends'))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-white border border-slate-200/60 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                  <Users className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Engagement Insights</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {renderList(getAnalysisData('engagement_insights'))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border border-slate-200/60 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Project Health</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {renderList(getAnalysisData('project_health'))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-white border border-slate-200/60 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Productivity Metrics</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {renderList(getAnalysisData('productivity_metrics'))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 mt-6">
            <Card className="bg-white border border-red-100 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)] overflow-hidden">
              <CardHeader className="border-b border-red-50 bg-red-50/30 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div>
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Risk Factors & Bottlenecks</CardTitle>
                  <CardDescription className="text-xs font-bold text-red-400 uppercase tracking-wider mt-0.5">Critical issues requiring immediate attention</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-3">
                  {renderList(getAnalysisData('risk_factors'))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border border-slate-200/60 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Growth Opportunities</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {renderList(getAnalysisData('growth_opportunities'))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-white border border-slate-200/60 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
                <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Efficiency Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {renderList(getAnalysisData('efficiency_recommendations'))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Predictive Insights */}
            <Card className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 border border-blue-100 rounded-[1.5rem] shadow-[0_2px_15px_rgba(0,0,0,0.03)] overflow-hidden">
              <CardHeader className="border-b border-blue-100/60 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <div>
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Predictive Insights</CardTitle>
                  <CardDescription className="text-xs font-bold text-blue-400 uppercase tracking-wider mt-0.5">AI-powered predictions and future trends</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-3">
                  {(() => {
                    const insights = getAnalysisData('predictive_insights');
                    return insights.length > 0 ? insights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-4 bg-white/80 rounded-xl border border-blue-100">
                        <Badge className="mt-0.5 bg-gradient-to-r from-blue-500 to-purple-600 border-none text-white font-black">{idx + 1}</Badge>
                        <span className="text-sm font-medium text-slate-700">{item}</span>
                      </li>
                    )) : <li className="text-sm font-bold text-slate-400">No predictions available.</li>;
                  })()}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
          <CardContent className="py-24">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">No Analysis Yet</h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto">
                Click "Generate AI Analysis" to unlock comprehensive insights about your organization.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

