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
      <div className="flex flex-col bg-[#f8f9fa] w-full min-h-screen relative overflow-x-hidden">
        <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-8 flex-1 flex flex-col">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <BarChart3 className="h-7 w-7 md:h-9 md:w-9 text-blue-600 flex-shrink-0" />
                Productivity Dashboard
              </h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium">
                Unified productivity hub for projects, resources, and AI insights
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={projectsLoading || tasksLoading || usersLoading || timesheetsLoading || activitiesLoading}
              className="flex items-center gap-2 bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl px-4 py-5 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${(projectsLoading || tasksLoading || usersLoading || timesheetsLoading || activitiesLoading) ? "animate-spin" : ""}`} />
              <span className="font-semibold text-xs uppercase tracking-wider">Refresh All</span>
            </Button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Total Projects */}
            <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2.5rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Total Projects</p>
                    <p className="text-4xl font-black text-slate-900 leading-tight">{projects.length}</p>
                    <p className="text-xs font-bold text-slate-400">{projects.filter(p => p.status === "active").length} active</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-blue-500 shadow-[0_8px_16px_rgba(59,130,246,0.25)] flex items-center justify-center">
                    <FolderKanban className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Tasks */}
            <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2.5rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Total Tasks</p>
                    <p className="text-4xl font-black text-slate-900 leading-tight">{tasks.length}</p>
                    <p className="text-xs font-bold text-slate-400">{tasks.filter(t => t.status === "completed").length} completed</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500 shadow-[0_8px_16px_rgba(16,185,129,0.25)] flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2.5rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Team Members</p>
                    <p className="text-4xl font-black text-slate-900 leading-tight">{users.length}</p>
                    <p className="text-xs font-bold text-slate-400">{users.filter(u => u.role === "admin").length} admins</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-purple-500 shadow-[0_8px_16px_rgba(168,85,247,0.25)] flex items-center justify-center">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logged Hours */}
            <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2.5rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Logged Hours</p>
                    <p className="text-4xl font-black text-slate-900 leading-tight">
                      {Math.round(timesheets.reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60)}
                    </p>
                    <p className="text-xs font-bold text-slate-400">{timesheets.filter(t => t.status === "approved").length} approved</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-amber-500 shadow-[0_8px_16_rgba(245,158,11,0.25)] flex items-center justify-center">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col">
            <div className="border-b border-slate-200/60 pb-1">
              <TabsList className="bg-transparent border-none p-0 flex justify-start overflow-x-auto h-auto gap-2 md:gap-4 hide-scrollbar">
                {[
                  { id: "overview", label: "System Overview", icon: TrendingUp },
                  { id: "projects", label: "Project Analytics", icon: Target },
                  { id: "resources", label: "Resource Management", icon: Users },
                  { id: "insights", label: "AI & Insights", icon: BrainCircuit },
                  { id: "reports", label: "Custom Reports", icon: FileText },
                  ...(currentUser && currentUser.custom_role === "owner" ? [{ id: "profitability", label: "Profitability", icon: DollarSign }] : []),
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onClick={() => setShowSummary(false)}
                    className="flex items-center gap-2 whitespace-nowrap px-4 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-500 font-bold transition-all border-none"
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="mt-8 flex-1 flex flex-col">
              {/* Content Areas */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                  <p className="text-slate-600">Loading business intelligence data...</p>
                </div>
              ) : (
                <>
                  <TabsContent value="overview" className="m-0 focus-visible:outline-none space-y-6">
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

                  <TabsContent value="projects" className="m-0 focus-visible:outline-none space-y-6">
                    <Tabs defaultValue="health" className="w-full">
                      <TabsList className="bg-slate-100/80 p-1 w-full justify-start overflow-x-auto rounded-xl">
                        <TabsTrigger value="health" className="gap-2 rounded-lg">
                          <Target className="h-4 w-4" /> Health Matrix
                        </TabsTrigger>
                        <TabsTrigger value="timeline" className="gap-2 rounded-lg">
                          <Calendar className="h-4 w-4" /> Timeline
                        </TabsTrigger>
                        <TabsTrigger value="risks" className="gap-2 rounded-lg">
                          <AlertTriangle className="h-4 w-4" /> Risk Assessment
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="gap-2 rounded-lg">
                          <FileText className="h-4 w-4" /> Project Reports
                        </TabsTrigger>
                      </TabsList>

                      <div className="mt-6">
                        <TabsContent value="health" className="m-0 focus-visible:outline-none">
                          <ProjectHealthMatrix
                            projects={projects}
                            tasks={tasks}
                            activities={activities}
                          />
                        </TabsContent>

                        <TabsContent value="timeline" className="m-0 focus-visible:outline-none">
                          <div className="space-y-6">
                            <Card className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                              <h3 className="text-lg font-bold text-slate-900 mb-4">Timeline Prediction</h3>
                              <div className="max-w-xs">
                                <Select
                                  value={selectedProjectId || "none"}
                                  onValueChange={(value) => setSelectedProjectId(value === "none" ? null : value)}
                                >
                                  <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl">
                                    <SelectValue placeholder="Select a project" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-50">
                                    <SelectItem value="none">Select a project</SelectItem>
                                    {projects.map(p => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {selectedProject && (
                                <div className="mt-8">
                                  <TimelinePrediction
                                    project={selectedProject}
                                    tasks={projectTasks}
                                    activities={projectActivities}
                                  />
                                </div>
                              )}
                            </Card>

                            <GanttChart projects={projects} tasks={tasks} users={users} />
                          </div>
                        </TabsContent>

                        <TabsContent value="risks" className="m-0 focus-visible:outline-none">
                          <Card className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Project Risk Analysis</h3>
                            <div className="max-w-xs mb-8">
                              <Select
                                value={selectedProjectId || "none"}
                                onValueChange={(value) => setSelectedProjectId(value === "none" ? null : value)}
                              >
                                <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl">
                                  <SelectValue placeholder="Select a project" />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-50">
                                  <SelectItem value="none">Select a project</SelectItem>
                                  {projects.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {selectedProject && (
                              <RiskAssessment project={selectedProject} tasks={projectTasks} />
                            )}
                          </Card>
                        </TabsContent>

                        <TabsContent value="reports" className="m-0 focus-visible:outline-none">
                          <Card className="p-6 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Generate Project Report</h3>
                            <div className="max-w-xs mb-8">
                              <Select
                                value={selectedProjectId || "none"}
                                onValueChange={(value) => setSelectedProjectId(value === "none" ? null : value)}
                              >
                                <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl">
                                  <SelectValue placeholder="Select a project" />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-50">
                                  <SelectItem value="none">Select a project</SelectItem>
                                  {projects.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {selectedProject && (
                              <ProjectReport
                                project={selectedProject}
                                tasks={projectTasks}
                                activities={projectActivities}
                              />
                            )}
                          </Card>
                        </TabsContent>
                      </div>
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="resources" className="m-0 focus-visible:outline-none space-y-6">
                    <ResourceUtilization
                      users={users}
                      tasks={tasks}
                      timesheets={timesheets}
                      projects={projects}
                    />
                  </TabsContent>

                  <TabsContent value="insights" className="m-0 focus-visible:outline-none space-y-6">
                    <Tabs defaultValue="deep-analytics" className="w-full">
                      <TabsList className="bg-slate-100/80 p-1 rounded-xl">
                        <TabsTrigger value="deep-analytics" className="gap-2 rounded-lg">
                          <Sparkles className="h-4 w-4" /> Deep Analytics
                        </TabsTrigger>
                        <TabsTrigger value="ask-ai" className="gap-2 rounded-lg">
                          <BrainCircuit className="h-4 w-4" /> Ask AI
                        </TabsTrigger>
                      </TabsList>
                      <div className="mt-6">
                        <TabsContent value="deep-analytics" className="m-0 focus-visible:outline-none">
                          <DeepAnalytics
                            projects={projects}
                            tasks={tasks}
                            users={users}
                            activities={activities}
                            tenants={tenant || tenantData ? [tenant || tenantData] : []}
                          />
                        </TabsContent>
                        <TabsContent value="ask-ai" className="m-0 focus-visible:outline-none">
                          <AskAIInsights
                            projects={projects}
                            tasks={tasks}
                            activities={activities}
                          />
                        </TabsContent>
                      </div>
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="reports" className="m-0 focus-visible:outline-none space-y-6">
                    <CustomReportBuilder
                      projects={projects}
                      tasks={tasks}
                      users={users}
                      timesheets={timesheets}
                      activities={activities}
                    />
                  </TabsContent>

                  {currentUser?.custom_role === "owner" && (
                    <TabsContent value="profitability" className="m-0 focus-visible:outline-none space-y-6">
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
          </Tabs>
        </div>
      </div>
    </PermissionGuard>
  );
}