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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Deep Analytics</h2>
          <p className="text-slate-600">AI-powered insights and comprehensive platform analytics</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={generateDeepAnalysis}
            disabled={loadingAnalysis}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
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
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-blue-600">{metrics.totalUsers}</p>
                <p className="text-xs text-green-600 mt-1">
                  {metrics.activeUsers} active (7d)
                </p>
              </div>
              <Users className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Projects</p>
                <p className="text-3xl font-bold text-purple-600">{metrics.totalProjects}</p>
                <p className="text-xs text-green-600 mt-1">
                  {metrics.activeProjects} active
                </p>
              </div>
              <Target className="h-10 w-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Task Completion</p>
                <p className="text-3xl font-bold text-green-600">{metrics.taskCompletionRate}%</p>
                <p className="text-xs text-slate-600 mt-1">
                  {metrics.completedTasks}/{metrics.totalTasks} tasks
                </p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Activity (7d)</p>
                <p className="text-3xl font-bold text-amber-600">{metrics.recentActivity}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Platform actions
                </p>
              </div>
              <Activity className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis Results */}
      {aiAnalysis ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="risks">Risks & Issues</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <TrendingUp className="h-5 w-5" />
                    Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {renderList(getAnalysisData('performance_trends'))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-600">
                    <Users className="h-5 w-5" />
                    Engagement Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {renderList(getAnalysisData('engagement_insights'))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Project Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {renderList(getAnalysisData('project_health'))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <Clock className="h-5 w-5" />
                    Productivity Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {renderList(getAnalysisData('productivity_metrics'))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 mt-6">
            <Card className="border-2 border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Factors & Bottlenecks
                </CardTitle>
                <CardDescription>Critical issues requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {renderList(getAnalysisData('risk_factors'))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    Growth Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {renderList(getAnalysisData('growth_opportunities'))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-600">
                    <Sparkles className="h-5 w-5" />
                    Efficiency Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {renderList(getAnalysisData('efficiency_recommendations'))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Predictive Insights */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Sparkles className="h-5 w-5" />
                  Predictive Insights
                </CardTitle>
                <CardDescription>AI-powered predictions and future trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(() => {
                    const insights = getAnalysisData('predictive_insights');
                    return insights.length > 0 ? insights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-200">
                        <Badge className="mt-0.5 bg-blue-600">{idx + 1}</Badge>
                        <span className="text-sm text-slate-800">{item}</span>
                      </li>
                    )) : <li className="text-sm text-slate-500">No predictions available.</li>;
                  })()}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="py-16">
            <div className="text-center">
              <Sparkles className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Analysis Yet</h3>
              <p className="text-slate-600 mb-6">
                Click "Generate AI Analysis" to unlock comprehensive insights about your organization.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

