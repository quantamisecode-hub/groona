import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, Activity, Loader2, Sparkles, Target, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function AIAnalyticsDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      if (!user.is_super_admin) {
        window.location.href = createPageUrl("Dashboard");
      }
      setCurrentUser(user);
    }).catch(() => {
      window.location.href = createPageUrl("Dashboard");
    });
  }, []);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list('-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: () => groonabackend.entities.Task.list(),
  });

  const { data: allActivities = [] } = useQuery({
    queryKey: ['all-activities'],
    queryFn: () => groonabackend.entities.Activity.list('-created_date', 500),
  });

  // Filter data by selected tenant
  const filteredUsers = selectedTenant === "all" ? allUsers : allUsers.filter(u => u.tenant_id === selectedTenant);
  const filteredProjects = selectedTenant === "all" ? allProjects : allProjects.filter(p => p.tenant_id === selectedTenant);
  const filteredTasks = selectedTenant === "all" ? allTasks : allTasks.filter(t => t.tenant_id === selectedTenant);
  const filteredActivities = selectedTenant === "all" ? allActivities : allActivities.filter(a => a.tenant_id === selectedTenant);

  // Generate Deep AI Analysis
  const generateDeepAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const scopeName = selectedTenant === "all" ? "Platform-Wide" : tenants.find(t => t.id === selectedTenant)?.name;
      
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

      setAiAnalysis(response);
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

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Deep Analytics Dashboard
            </h1>
            <p className="text-slate-600">AI-powered insights and comprehensive platform analytics</p>
          </div>
          <div className="flex gap-3">
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={generateDeepAnalysis}
              disabled={loadingAnalysis}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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
        {aiAnalysis && (
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
                      {aiAnalysis.performance_trends?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600 font-bold">•</span>
                          <span className="text-slate-700">{item}</span>
                        </li>
                      ))}
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
                      {aiAnalysis.engagement_insights?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-purple-600 font-bold">•</span>
                          <span className="text-slate-700">{item}</span>
                        </li>
                      ))}
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
                      {aiAnalysis.project_health?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600 font-bold">•</span>
                          <span className="text-slate-700">{item}</span>
                        </li>
                      ))}
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
                      {aiAnalysis.productivity_metrics?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600 font-bold">•</span>
                          <span className="text-slate-700">{item}</span>
                        </li>
                      ))}
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
                    {aiAnalysis.risk_factors?.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <Badge className="mt-0.5 bg-red-600">!</Badge>
                        <span className="text-sm text-slate-800">{item}</span>
                      </li>
                    ))}
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
                      {aiAnalysis.growth_opportunities?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600 font-bold">•</span>
                          <span className="text-slate-700">{item}</span>
                        </li>
                      ))}
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
                      {aiAnalysis.efficiency_recommendations?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-purple-600 font-bold">•</span>
                          <span className="text-slate-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Predictive Insights */}
              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <Sparkles className="h-5 w-5" />
                    Predictive Insights
                  </CardTitle>
                  <CardDescription>AI-powered predictions and future trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {aiAnalysis.predictive_insights?.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-200">
                        <Badge className="mt-0.5 bg-blue-600">{idx + 1}</Badge>
                        <span className="text-sm text-slate-800">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

