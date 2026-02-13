import React, { useState, useEffect, useRef } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3,
  ArrowLeft,
  TrendingUp,
  Users,
  FolderKanban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Clock,
  Target,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  BrainCircuit
} from "lucide-react";
import SystemHealthOverview from "../components/bi/SystemHealthOverview";
import ProjectHealthMatrix from "../components/bi/ProjectHealthMatrix";
import ResourceUtilization from "../components/bi/ResourceUtilization";
import CustomReportBuilder from "../components/bi/CustomReportBuilder";
import GanttChart from "../components/bi/GanttChart";
import ProjectProfitabilityTable from "../components/bi/ProjectProfitabilityTable";
import DeepAnalytics from "../components/bi/DeepAnalytics";
import AskAIInsights from "../components/insights/AskAIInsights";
import RiskAssessment from "../components/insights/RiskAssessment";
import TimelinePrediction from "../components/insights/TimelinePrediction";
import ProjectReport from "../components/insights/ProjectReport";
import PermissionGuard from "../components/shared/PermissionGuard";
import { useUser } from "../components/shared/UserContext";
import { toast } from "sonner";
import { io } from "socket.io-client"; // Import Socket Client

export default function AdminBIDashboard() {
  // Use global user context to prevent loading spinner on navigation
  const { user: currentUser, effectiveTenantId, tenant } = useUser();

  const [activeTab, setActiveTab] = useState("overview");
  const [showSummary, setShowSummary] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const tabsRef = useRef(null);
  const location = useLocation();

  // Reset dashboard when navigating via sidebar (location change)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
      if (tabParam !== 'overview') setShowSummary(false);
    } else {
      setShowSummary(true);
      setActiveTab("overview");
    }
  }, [location.key, location.search]);

  const handleTabChange = (value) => {
    setActiveTab(value);

    // Auto-scroll to focus tabs
    if (tabsRef.current) {
      tabsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  const isMarketingCompany = tenant?.company_type === 'MARKETING';

  // === 1. WebSocket Integration ===
  useEffect(() => {
    if (!effectiveTenantId) return;

    // Connect to backend
    const socketUrl = API_BASE;
    socketRef.current = io(socketUrl);

    socketRef.current.on("connect", () => {
      console.log("[BI Dashboard] Socket connected");
      socketRef.current.emit("join_room", effectiveTenantId);
    });

    // Listen for Entity Changes and Invalidate Queries
    const handleUpdate = (entity, queryKey) => {
      console.log(`[BI Dashboard] ${entity} update received. Refreshing...`);
      queryClient.invalidateQueries(queryKey);
    };

    socketRef.current.on("project_change", () => handleUpdate("Project", ['bi-projects']));
    socketRef.current.on("task_change", () => handleUpdate("Task", ['bi-tasks']));
    socketRef.current.on("user_change", () => handleUpdate("User", ['bi-users']));
    socketRef.current.on("timesheet_change", () => handleUpdate("Timesheet", ['bi-timesheets']));
    socketRef.current.on("activity_change", () => handleUpdate("Activity", ['bi-activities']));

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [effectiveTenantId, queryClient]);

  // === 2. Queries with Caching (staleTime) and placeholderData for instant loading ===
  const queryOptions = {
    staleTime: 1000 * 60 * 30, // 30 Minutes (Data is fresh unless socket says otherwise)
    refetchOnWindowFocus: false, // Don't refetch just because user clicked window
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
  };

  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['bi-projects', effectiveTenantId, refreshKey],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser && !!effectiveTenantId,
    ...queryOptions
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['bi-tasks', effectiveTenantId, refreshKey],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser && !!effectiveTenantId,
    ...queryOptions
  });

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['bi-users', effectiveTenantId, refreshKey],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!currentUser && !!effectiveTenantId,
    ...queryOptions
  });

  const { data: timesheets = [], isLoading: timesheetsLoading, refetch: refetchTimesheets } = useQuery({
    queryKey: ['bi-timesheets', effectiveTenantId, refreshKey],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Timesheet.filter({ tenant_id: effectiveTenantId }, '-date');
    },
    enabled: !!currentUser && !!effectiveTenantId,
    ...queryOptions
  });

  const { data: activities = [], isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ['bi-activities', effectiveTenantId, refreshKey],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Activity.filter({ tenant_id: effectiveTenantId }, '-created_date', 1000);
    },
    enabled: !!currentUser && !!effectiveTenantId,
    ...queryOptions
  });

  const { data: sprints = [], refetch: refetchSprints } = useQuery({
    queryKey: ['bi-sprints', effectiveTenantId, refreshKey],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allSprints = await groonabackend.entities.Sprint.list();
      return allSprints.filter(s => {
        const project = projects.find(p => p.id === s.project_id);
        return project && project.tenant_id === effectiveTenantId;
      });
    },
    enabled: !!currentUser && !!effectiveTenantId && projects.length > 0 && !isMarketingCompany,
    ...queryOptions
  });

  // Keep tenant fetch as fallback/refresher, but main tenant comes from context
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;
      const tenants = await groonabackend.entities.Tenant.filter({ id: effectiveTenantId });
      return tenants[0] || null;
    },
    enabled: !!currentUser && !!effectiveTenantId,
    staleTime: Infinity,
  });

  // Only show loading on initial load when we have no data at all
  const hasAnyData = projects.length > 0 || tasks.length > 0 || users.length > 0 || timesheets.length > 0 || activities.length > 0;
  const isLoading = (projectsLoading || tasksLoading || usersLoading || timesheetsLoading || activitiesLoading) && !hasAnyData;

  const handleRefreshAll = async () => {
    console.log('[Productivity Dashboard] Refreshing all data...');
    setRefreshKey(prev => prev + 1);

    await Promise.all([
      refetchProjects(),
      refetchTasks(),
      refetchUsers(),
      refetchTimesheets(),
      refetchActivities(),
      refetchSprints()
    ]);

    toast.success('Dashboard refreshed!');
  };

  // Helper to get selected project object
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;
  const projectTasks = selectedProjectId ? tasks.filter(t => t.project_id === selectedProjectId) : [];
  const projectActivities = selectedProjectId ? activities.filter(a => a.project_id === selectedProjectId) : [];

  // Don't show loader if user is already in context
  if (!currentUser) {
    return null;
  }

  return (
    <PermissionGuard permissionKey="can_view_reports">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative min-h-full">

          {/* Main Content Rendered Naturally */}
          <div className="w-full relative" style={{ maxWidth: '100vw' }}>
            <div className="max-w-[1800px] mx-auto w-full flex flex-col relative" style={{ maxWidth: '100%' }}>
              {/* Header Section (Scrollable) */}
              {showSummary && (
                <div className="bg-white border-b border-slate-200/60">
                  <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
                    {/* Header */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                      <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                          <BarChart3 className="h-8 w-8 text-blue-600" />
                          Productivity Dashboard
                        </h1>
                        <p className="text-slate-600">
                          Unified productivity hub for projects, resources, and AI insights
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshAll}
                          disabled={projectsLoading || tasksLoading || usersLoading || timesheetsLoading || activitiesLoading}
                          className="flex items-center gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${(projectsLoading || tasksLoading || usersLoading || timesheetsLoading || activitiesLoading) ? 'animate-spin' : ''}`} />
                          Refresh All
                        </Button>
                      </div>
                    </div>

                    {/* Quick Stats Cards */}
                    {!isLoading && (
                      <div
                        className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                      >
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg hover:shadow-xl transition-all flex-shrink-0 w-[280px] md:w-auto">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 mb-1">Total Projects</p>
                                <p className="text-3xl font-bold text-slate-900">{projects.length}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {projects.filter(p => p.status === 'active').length} active
                                </p>
                              </div>
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <FolderKanban className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg hover:shadow-xl transition-all flex-shrink-0 w-[280px] md:w-auto">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 mb-1">Total Tasks</p>
                                <p className="text-3xl font-bold text-slate-900">{tasks.length}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {tasks.filter(t => t.status === 'completed').length} completed
                                </p>
                              </div>
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <CheckCircle2 className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg hover:shadow-xl transition-all flex-shrink-0 w-[280px] md:w-auto">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 mb-1">Team Members</p>
                                <p className="text-3xl font-bold text-slate-900">{users.length}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {users.filter(u => u.role === 'admin').length} admins
                                </p>
                              </div>
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                                <Users className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg hover:shadow-xl transition-all flex-shrink-0 w-[280px] md:w-auto">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 mb-1">Logged Hours</p>
                                <p className="text-3xl font-bold text-slate-900">
                                  {Math.round(timesheets.reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60)}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {timesheets.filter(t => t.status === 'approved').length} approved
                                </p>
                              </div>
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                                <Clock className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sticky Tabs Section */}
              <div
                ref={tabsRef}
                className="sticky z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all duration-300"
                style={{ top: 0 }}
              >
                <div className="px-4 md:px-6 lg:px-8 py-2">
                  <TabsList className="bg-transparent border-none p-0 flex-wrap h-auto gap-1">
                    <TabsTrigger value="overview" className="gap-2" onClick={() => setShowSummary(false)}>
                      <TrendingUp className="h-4 w-4" />
                      System Overview
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="gap-2" onClick={() => setShowSummary(false)}>
                      <Target className="h-4 w-4" />
                      Project Analytics
                    </TabsTrigger>
                    <TabsTrigger value="resources" className="gap-2" onClick={() => setShowSummary(false)}>
                      <Users className="h-4 w-4" />
                      Resource Management
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="gap-2" onClick={() => setShowSummary(false)}>
                      <BrainCircuit className="h-4 w-4" />
                      AI & Insights
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="gap-2" onClick={() => setShowSummary(false)}>
                      <FileText className="h-4 w-4" />
                      Custom Reports
                    </TabsTrigger>
                    {/* Show Profitability tab only for owners */}
                    {currentUser && currentUser.custom_role === 'owner' && (
                      <TabsTrigger value="profitability" className="gap-2" onClick={() => setShowSummary(false)}>
                        <DollarSign className="h-4 w-4" />
                        Profitability
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>
              </div>

              {/* Main Content */}
              <div className="w-full">
                <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-4">
                  {/* Loading State - Only shows on initial hard load when we have no cached data */}
                  {isLoading ? (
                    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                      <CardContent className="py-12">
                        <div className="text-center">
                          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                          <p className="text-slate-600">Loading business intelligence data...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <TabsContent value="overview" className="space-y-6 mt-4">
                        {!showSummary && (
                          <div className="flex items-center gap-2 mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-slate-600 hover:text-slate-900"
                              onClick={() => setShowSummary(true)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Back to Dashboard
                            </Button>
                          </div>
                        )}
                        <SystemHealthOverview
                          projects={projects}
                          tasks={tasks}
                          users={users}
                          tenant={tenant || tenantData}
                          activities={activities}
                          timesheets={timesheets}
                          sprints={isMarketingCompany ? [] : sprints}
                        />
                      </TabsContent>

                      <TabsContent value="projects" className="space-y-6 mt-4">
                        {!showSummary && (
                          <div className="flex items-center gap-2 mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-slate-600 hover:text-slate-900"
                              onClick={() => setShowSummary(true)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Back to Dashboard
                            </Button>
                          </div>
                        )}
                        <Tabs defaultValue="health" className="w-full">
                          <TabsList className="bg-slate-100/80 p-1 w-full justify-start overflow-x-auto">
                            <TabsTrigger value="health" className="gap-2">
                              <Target className="h-4 w-4" /> Health Matrix
                            </TabsTrigger>
                            <TabsTrigger value="timeline" className="gap-2">
                              <Calendar className="h-4 w-4" /> Timeline
                            </TabsTrigger>
                            <TabsTrigger value="risks" className="gap-2">
                              <AlertTriangle className="h-4 w-4" /> Risk Assessment
                            </TabsTrigger>
                            <TabsTrigger value="reports" className="gap-2">
                              <FileText className="h-4 w-4" /> Project Reports
                            </TabsTrigger>
                          </TabsList>

                          <div className="mt-6">
                            <TabsContent value="health">
                              <ProjectHealthMatrix
                                projects={projects}
                                tasks={tasks}
                                activities={activities}
                              />
                            </TabsContent>

                            <TabsContent value="timeline">
                              <div className="space-y-6">
                                {/* Timeline Prediction Card - Above GanttChart */}
                                <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
                                  <h3 className="text-lg font-semibold mb-4">Timeline Prediction</h3>
                                  <div className="max-w-md">
                                    <Select
                                      value={selectedProjectId || 'none'}
                                      onValueChange={(value) => setSelectedProjectId(value === 'none' ? null : value)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a project to predict timeline..." />
                                      </SelectTrigger>
                                      <SelectContent position="popper" sideOffset={5} className="z-50 max-h-[300px]">
                                        <SelectItem value="none">Select a project to predict timeline...</SelectItem>
                                        {projects.map(p => (
                                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {selectedProject && (
                                    <div className="mt-6">
                                      <TimelinePrediction
                                        project={selectedProject}
                                        tasks={projectTasks}
                                        activities={projectActivities}
                                      />
                                    </div>
                                  )}
                                </Card>

                                {/* GanttChart - Always visible, shows all projects or filtered by selection */}
                                <GanttChart
                                  projects={projects}
                                  tasks={tasks}
                                  users={users}
                                />
                              </div>
                            </TabsContent>

                            <TabsContent value="risks">
                              <div className="space-y-6">
                                <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
                                  <h3 className="text-lg font-semibold mb-4">Project Risk Analysis</h3>
                                  <div className="max-w-md">
                                    <select
                                      value={selectedProjectId || ''}
                                      onChange={(e) => setSelectedProjectId(e.target.value)}
                                      className="w-full p-2 rounded-lg border border-slate-200"
                                    >
                                      <option value="">Select a project to analyze risks...</option>
                                      {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {selectedProject && (
                                    <div className="mt-6">
                                      <RiskAssessment
                                        project={selectedProject}
                                        tasks={projectTasks}
                                      />
                                    </div>
                                  )}
                                </Card>
                              </div>
                            </TabsContent>

                            <TabsContent value="reports">
                              <div className="space-y-6">
                                <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
                                  <h3 className="text-lg font-semibold mb-4">Generate Project Report</h3>
                                  <div className="max-w-md">
                                    <select
                                      value={selectedProjectId || ''}
                                      onChange={(e) => setSelectedProjectId(e.target.value)}
                                      className="w-full p-2 rounded-lg border border-slate-200"
                                    >
                                      <option value="">Select a project...</option>
                                      {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {selectedProject && (
                                    <div className="mt-6">
                                      <ProjectReport
                                        project={selectedProject}
                                        tasks={projectTasks}
                                        activities={projectActivities}
                                      />
                                    </div>
                                  )}
                                </Card>
                              </div>
                            </TabsContent>
                          </div>
                        </Tabs>
                      </TabsContent>

                      <TabsContent value="resources" className="space-y-6 mt-4">
                        {!showSummary && (
                          <div className="flex items-center gap-2 mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-slate-600 hover:text-slate-900"
                              onClick={() => setShowSummary(true)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Back to Dashboard
                            </Button>
                          </div>
                        )}
                        <ResourceUtilization
                          users={users}
                          tasks={tasks}
                          timesheets={timesheets}
                          projects={projects}
                        />
                      </TabsContent>

                      <TabsContent value="insights" className="space-y-6 mt-4">
                        {!showSummary && (
                          <div className="flex items-center gap-2 mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-slate-600 hover:text-slate-900"
                              onClick={() => setShowSummary(true)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Back to Dashboard
                            </Button>
                          </div>
                        )}
                        <Tabs defaultValue="deep-analytics" className="w-full">
                          <TabsList className="bg-slate-100/80 p-1">
                            <TabsTrigger value="deep-analytics" className="gap-2">
                              <Sparkles className="h-4 w-4" /> Deep Analytics
                            </TabsTrigger>
                            <TabsTrigger value="ask-ai" className="gap-2">
                              <BrainCircuit className="h-4 w-4" /> Ask AI
                            </TabsTrigger>
                          </TabsList>
                          <div className="mt-6">
                            <TabsContent value="deep-analytics">
                              <DeepAnalytics
                                projects={projects}
                                tasks={tasks}
                                users={users}
                                activities={activities}
                                tenants={tenant || tenantData ? [tenant || tenantData] : []}
                              />
                            </TabsContent>
                            <TabsContent value="ask-ai">
                              <AskAIInsights
                                projects={projects}
                                tasks={tasks}
                                activities={activities}
                              />
                            </TabsContent>
                          </div>
                        </Tabs>
                      </TabsContent>

                      <TabsContent value="reports" className="space-y-6 mt-4">
                        {!showSummary && (
                          <div className="flex items-center gap-2 mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-slate-600 hover:text-slate-900"
                              onClick={() => setShowSummary(true)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Back to Dashboard
                            </Button>
                          </div>
                        )}
                        <CustomReportBuilder
                          projects={projects}
                          tasks={tasks}
                          users={users}
                          timesheets={timesheets}
                          activities={activities}
                        />
                      </TabsContent>

                      {/* Profitability Tab Content */}
                      {currentUser && currentUser.custom_role === 'owner' && (
                        <TabsContent value="profitability" className="space-y-6 mt-4">
                          {!showSummary && (
                            <div className="flex items-center gap-2 mb-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2 text-slate-600 hover:text-slate-900"
                                onClick={() => setShowSummary(true)}
                              >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Dashboard
                              </Button>
                            </div>
                          )}
                          <ProjectProfitabilityTable
                            projects={projects}
                            users={users}
                            timesheets={timesheets}
                            tasks={tasks}
                            sprints={sprints}
                            onRefresh={handleRefreshAll}
                          />
                        </TabsContent>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </PermissionGuard>
  );
}

