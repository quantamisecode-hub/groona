import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  Target,
  Activity,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "../components/shared/UserContext"; // Import UserContext
import RiskAssessment from "../components/insights/RiskAssessment";
import TimelinePrediction from "../components/insights/TimelinePrediction";
import ProjectReport from "../components/insights/ProjectReport";
import AskAIInsights from "../components/insights/AskAIInsights";
import ProjectDataTable from "../components/insights/ProjectDataTable";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

export default function ProjectInsights() {
  const { user: currentUser, effectiveTenantId } = useUser();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || "overview"; // Changed from "project_list" to "overview" to match existing tab
  const initialProjectId = searchParams.get('projectId') || null;

  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [activeTab, setActiveTab] = useState(initialTab);

  // State for Overview Modal
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [overviewModalType, setOverviewModalType] = useState(null); // 'projects', 'critical', 'high', 'medium', 'pending', 'done'
  const [overviewModalPage, setOverviewModalPage] = useState(1);
  const overviewModalItemsPerPage = 5;

  // State for Inline Task Detail Modal
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';

  // 1. Fetch Project Roles (Matches Dashboard Logic & StaleTime)
  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !isAdmin,
    staleTime: 5 * 60 * 1000, // Added to match Dashboard
  });

  // 2. Fetch Projects scoped to Tenant (Matches Dashboard Logic & StaleTime)
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Project.list('-updated_date');
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000, // Added to match Dashboard
  });

  // 3. Fetch Tasks scoped to Tenant (Matches Dashboard Logic & StaleTime)
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Task.list('-updated_date');
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000, // Added to match Dashboard
  });

  // 4. Fetch Stories scoped to Tenant (for accurate progress calculation)
  const { data: stories = [] } = useQuery({
    queryKey: ['stories', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Story.list();
      return groonabackend.entities.Story.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // 5. Fetch Activities scoped to Tenant
  const { data: activities = [] } = useQuery({
    queryKey: ['all-activities', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Activity.list('-created_date', 100);
      return groonabackend.entities.Activity.filter({ tenant_id: effectiveTenantId }, '-created_date', 100);
    },
    enabled: !!currentUser,
    staleTime: 1 * 60 * 1000, // Added reasonable staleTime
  });

  // 5. Calculate Accessible Projects (Exact Match to Dashboard)
  const accessibleProjects = useMemo(() => {
    if (!currentUser || !projects.length) return [];

    return projects.filter(p => {
      // Admin sees all
      if (isAdmin) return true;

      const isOwner = p.owner === currentUser.email;
      const isTeamMember = p.team_members?.some(m => m.email === currentUser.email);
      // Check if user has a PM role for this project
      const isProjectManager = projectRoles?.some(r => r.project_id === p.id);

      return isOwner || isTeamMember || isProjectManager;
    });
  }, [projects, currentUser, isAdmin, projectRoles]);

  // 6. Filter Tasks belonging to Accessible Projects
  const accessibleTasks = useMemo(() => {
    if (!accessibleProjects.length || !tasks.length) return [];
    const projectIds = new Set(accessibleProjects.map(p => p.id));
    return tasks.filter(t => projectIds.has(t.project_id));
  }, [tasks, accessibleProjects]);

  // 7. Filter Activities belonging to Accessible Projects
  const accessibleActivities = useMemo(() => {
    if (!accessibleProjects.length || !activities.length) return [];
    const projectIds = new Set(accessibleProjects.map(p => p.id));
    return activities.filter(a => projectIds.has(a.project_id));
  }, [activities, accessibleProjects]);

  // 8. Calculate live progress for each project (Story Point Based)
  const projectProgressMap = useMemo(() => {
    const map = {};
    accessibleProjects.forEach(project => {
      const projectStories = stories.filter(s => s.project_id === project.id);
      const projectTasks = accessibleTasks.filter(t => t.project_id === project.id);

      if (projectStories.length === 0) {
        map[project.id] = project.progress || 0;
        return;
      }

      const completedStoryPoints = projectStories
        .filter(s => {
          const status = (s.status || '').toLowerCase();
          return status === 'done' || status === 'completed';
        })
        .reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

      const totalStoryPoints = projectStories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);
      map[project.id] = totalStoryPoints === 0 ? 0 : Math.round((completedStoryPoints / totalStoryPoints) * 100);
    });
    return map;
  }, [accessibleProjects, stories, accessibleTasks]);

  const selectedProject = accessibleProjects.find(p => p.id === selectedProjectId);
  const selectedProjectTasks = accessibleTasks.filter(t => t.project_id === selectedProjectId);
  const selectedProjectStories = useMemo(() => stories.filter(s => s.project_id === selectedProjectId), [stories, selectedProjectId]);

  // New Overview Modal Analytics Logic
  const activeProjectIdSet = new Set(accessibleProjects.filter(p => p.status === 'active').map(p => p.id));
  const activeProjectsTasks = accessibleTasks.filter(t => activeProjectIdSet.has(t.project_id));

  const analyticsSummary = useMemo(() => {
    return {
      activeProjects: activeProjectIdSet.size,
      critical: activeProjectsTasks.filter(t => t.status !== 'completed' && t.priority === 'urgent').length,
      high: activeProjectsTasks.filter(t => t.status !== 'completed' && t.priority === 'high').length,
      medium: activeProjectsTasks.filter(t => t.status !== 'completed' && t.priority === 'medium').length,
      pendingTasks: activeProjectsTasks.filter(t => t.status === 'todo').length,
      doneTasks: activeProjectsTasks.filter(t => t.status === 'completed').length,
      velocity: Math.round(activeProjectsTasks.filter(t => t.status === 'completed').length / 7) || 0,
      bottlenecks: activeProjectsTasks.filter(t => t.status === 'review').length
    };
  }, [activeProjectIdSet.size, activeProjectsTasks]);

  const handleOpenOverviewModal = (type) => {
    setOverviewModalType(type);
    setOverviewModalPage(1);
    setIsOverviewModalOpen(true);
  };

  const getOverviewModalData = () => {
    if (overviewModalType === 'projects') {
      return accessibleProjects.filter(p => p.status === 'active').map(p => {
        const pTasks = accessibleTasks.filter(t => t.project_id === p.id);
        const pendingCount = pTasks.filter(t => t.status !== 'completed').length;
        const criticalCount = pTasks.filter(t => t.status !== 'completed' && t.priority === 'urgent').length;
        return { ...p, pendingCount, criticalCount };
      });
    }

    let filtered = [];
    if (overviewModalType === 'critical') filtered = activeProjectsTasks.filter(t => t.status !== 'completed' && t.priority === 'urgent');
    else if (overviewModalType === 'high') filtered = activeProjectsTasks.filter(t => t.status !== 'completed' && t.priority === 'high');
    else if (overviewModalType === 'medium') filtered = activeProjectsTasks.filter(t => t.status !== 'completed' && t.priority === 'medium');
    else if (overviewModalType === 'pending') filtered = activeProjectsTasks.filter(t => t.status === 'todo');
    else if (overviewModalType === 'done') filtered = activeProjectsTasks.filter(t => t.status === 'completed');

    return filtered.map(task => {
      const p = accessibleProjects.find(pr => pr.id === task.project_id);
      return { ...task, projectName: p ? p.name : 'Unknown' };
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overviewModalData = useMemo(() => getOverviewModalData(), [overviewModalType, accessibleTasks, accessibleProjects, activeProjectsTasks]);
  const overviewModalTotalPages = Math.ceil(overviewModalData.length / overviewModalItemsPerPage);
  const overviewModalStartIndex = (overviewModalPage - 1) * overviewModalItemsPerPage;
  const paginatedOverviewData = overviewModalData.slice(overviewModalStartIndex, overviewModalStartIndex + overviewModalItemsPerPage);

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Project Insights</h1>
              <p className="text-slate-600">AI-powered analytics and predictions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Card 1: Active Projects */}
        <Card
          onClick={() => analyticsSummary.activeProjects > 0 && handleOpenOverviewModal('projects')}
          className={cn("p-5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-0 shadow-lg flex items-center gap-5", analyticsSummary.activeProjects > 0 && "cursor-pointer hover:scale-105 hover:shadow-indigo-500/50 transition-all active:scale-95")}
        >
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
            <TrendingUp className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Active Projects</h3>
            <p className="text-4xl font-black">{analyticsSummary.activeProjects}</p>
          </div>
        </Card>

        {/* Metric Card 2: Velocity */}
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Weekly Velocity</h3>
            <p className="text-4xl font-black text-white">{analyticsSummary.velocity} <span className="text-sm font-medium opacity-80">tasks/day</span></p>
          </div>
        </Card>

        {/* Metric Card 3: Bottlenecks */}
        <Card className="p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
            <AlertTriangle className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Bottlenecks</h3>
            <p className="text-4xl font-black text-white">{analyticsSummary.bottlenecks} <span className="text-sm font-medium opacity-80">in review</span></p>
          </div>
        </Card>
      </div>

      {/* Unified Task Overview Card */}
      <Card className="p-6 bg-white/40 backdrop-blur-2xl border-slate-200/40 shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-10 -mr-4 -mt-4 transition-transform group-hover:scale-110">
          <Target className="h-24 w-24 text-slate-400" />
        </div>

        <div className="relative">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Filter className="h-5 w-5 text-indigo-500" />
            Task Details Overall
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <Card
              onClick={() => analyticsSummary.critical > 0 && handleOpenOverviewModal('critical')}
              className={cn("p-4 border-slate-100 shadow-sm transition-all flex flex-col justify-between group h-full", analyticsSummary.critical > 0 ? "cursor-pointer hover:shadow-md hover:border-red-200" : "opacity-75")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Critical</span>
                <div className={cn("h-6 min-w-[24px] px-2 rounded-full flex items-center justify-center text-xs font-black", analyticsSummary.critical > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>
                  {analyticsSummary.critical}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className={cn("h-full transition-all duration-1000", analyticsSummary.critical > 0 ? "bg-red-500 group-hover:bg-red-400" : "bg-transparent")} style={{ width: `${Math.min(100, (analyticsSummary.critical / Math.max(1, accessibleTasks.length)) * 100)}%` }} />
              </div>
            </Card>

            <Card
              onClick={() => analyticsSummary.high > 0 && handleOpenOverviewModal('high')}
              className={cn("p-4 border-slate-100 shadow-sm transition-all flex flex-col justify-between group h-full", analyticsSummary.high > 0 ? "cursor-pointer hover:shadow-md hover:border-orange-200" : "opacity-75")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> High</span>
                <div className={cn("h-6 min-w-[24px] px-2 rounded-full flex items-center justify-center text-xs font-black", analyticsSummary.high > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500")}>
                  {analyticsSummary.high}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className={cn("h-full transition-all duration-1000", analyticsSummary.high > 0 ? "bg-orange-500 group-hover:bg-orange-400" : "bg-transparent")} style={{ width: `${Math.min(100, (analyticsSummary.high / Math.max(1, accessibleTasks.length)) * 100)}%` }} />
              </div>
            </Card>

            <Card
              onClick={() => analyticsSummary.medium > 0 && handleOpenOverviewModal('medium')}
              className={cn("p-4 border-slate-100 shadow-sm transition-all flex flex-col justify-between group h-full", analyticsSummary.medium > 0 ? "cursor-pointer hover:shadow-md hover:border-amber-200" : "opacity-75")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><Activity className="h-3 w-3" /> Medium</span>
                <div className={cn("h-6 min-w-[24px] px-2 rounded-full flex items-center justify-center text-xs font-black", analyticsSummary.medium > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>
                  {analyticsSummary.medium}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className={cn("h-full transition-all duration-1000", analyticsSummary.medium > 0 ? "bg-amber-500 group-hover:bg-amber-400" : "bg-transparent")} style={{ width: `${Math.min(100, (analyticsSummary.medium / Math.max(1, accessibleTasks.length)) * 100)}%` }} />
              </div>
            </Card>

            <Card
              onClick={() => analyticsSummary.pendingTasks > 0 && handleOpenOverviewModal('pending')}
              className={cn("p-4 border-slate-100 shadow-sm transition-all flex flex-col justify-between group h-full", analyticsSummary.pendingTasks > 0 ? "cursor-pointer hover:shadow-md hover:border-blue-200" : "opacity-75")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1.5"><Clock className="h-3 w-3" /> Pending</span>
                <div className={cn("h-6 min-w-[24px] px-2 rounded-full flex items-center justify-center text-xs font-black", analyticsSummary.pendingTasks > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>
                  {analyticsSummary.pendingTasks}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className={cn("h-full transition-all duration-1000", analyticsSummary.pendingTasks > 0 ? "bg-blue-500 group-hover:bg-blue-400" : "bg-transparent")} style={{ width: `${Math.min(100, (analyticsSummary.pendingTasks / Math.max(1, accessibleTasks.length)) * 100)}%` }} />
              </div>
            </Card>

            <Card
              onClick={() => analyticsSummary.doneTasks > 0 && handleOpenOverviewModal('done')}
              className={cn("p-4 border-slate-100 shadow-sm transition-all flex flex-col justify-between group h-full", analyticsSummary.doneTasks > 0 ? "cursor-pointer hover:shadow-md hover:border-emerald-200" : "opacity-75")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Done</span>
                <div className={cn("h-6 min-w-[24px] px-2 rounded-full flex items-center justify-center text-xs font-black", analyticsSummary.doneTasks > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                  {analyticsSummary.doneTasks}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className={cn("h-full transition-all duration-1000", analyticsSummary.doneTasks > 0 ? "bg-emerald-500 group-hover:bg-emerald-400" : "bg-transparent")} style={{ width: `${Math.min(100, (analyticsSummary.doneTasks / Math.max(1, accessibleTasks.length)) * 100)}%` }} />
              </div>
            </Card>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/60 backdrop-blur-xl border border-slate-200/60">
          <TabsTrigger value="project_list">Project List</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
          <TabsTrigger value="timeline">Timeline Prediction</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="ai">Ask AI</TabsTrigger>
        </TabsList>

        <TabsContent value="project_list" className="space-y-6">
          <ProjectDataTable
            projects={accessibleProjects}
            tasks={accessibleTasks}
            onTaskClick={(taskId) => setSelectedTaskId(taskId)}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Project Overview</h2>
                <p className="text-sm text-slate-500">Select a project to view detailed analytics and insights.</p>
              </div>
              <div className="w-full sm:w-[360px]">
                <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full h-14 bg-white border-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl shadow-sm text-left px-4">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] rounded-xl border-slate-200 shadow-xl overflow-y-auto">
                    {accessibleProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="cursor-pointer py-3 px-4 focus:bg-indigo-50 rounded-lg my-0.5 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="h-10 w-10 shrink-0 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={project.logo_url} alt={project.name} className="object-cover" />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xs uppercase">
                              {project.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-slate-900 truncate">{project.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md",
                                project.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                                  project.status === 'completed' ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-100 text-slate-600"
                              )}>
                                {project.status}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                • {projectProgressMap[project.id] || 0}% Progress
                              </span>
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {selectedProject && (
            <div className="grid lg:grid-cols-2 gap-6">
              <RiskAssessment
                project={selectedProject}
                tasks={selectedProjectTasks}
                compact={true}
              />
              <TimelinePrediction
                project={selectedProject}
                tasks={selectedProjectTasks}
                compact={true}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Risk Assessment</h2>
                <p className="text-sm text-slate-500">Select a project to view its risk profile and open issues.</p>
              </div>
              <div className="w-full sm:w-[360px]">
                <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full h-14 bg-white border-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl shadow-sm text-left px-4">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] rounded-xl border-slate-200 shadow-xl overflow-y-auto">
                    {accessibleProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="cursor-pointer py-3 px-4 focus:bg-indigo-50 rounded-lg my-0.5 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="h-10 w-10 shrink-0 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={project.logo_url} alt={project.name} className="object-cover" />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xs uppercase">
                              {project.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-slate-900 truncate">{project.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md",
                                project.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                                  project.status === 'completed' ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-100 text-slate-600"
                              )}>
                                {project.status}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                • {projectProgressMap[project.id] || 0}% Progress
                              </span>
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {selectedProject && (
            <RiskAssessment
              project={selectedProject}
              tasks={selectedProjectTasks}
            />
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Timeline Prediction</h2>
                <p className="text-sm text-slate-500">Select a project to forecast its estimated completion.</p>
              </div>
              <div className="w-full sm:w-[360px]">
                <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full h-14 bg-white border-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl shadow-sm text-left px-4">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] rounded-xl border-slate-200 shadow-xl overflow-y-auto">
                    {accessibleProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="cursor-pointer py-3 px-4 focus:bg-indigo-50 rounded-lg my-0.5 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="h-10 w-10 shrink-0 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={project.logo_url} alt={project.name} className="object-cover" />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xs uppercase">
                              {project.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-slate-900 truncate">{project.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md",
                                project.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                                  project.status === 'completed' ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-100 text-slate-600"
                              )}>
                                {project.status}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                • {projectProgressMap[project.id] || 0}% Progress
                              </span>
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {selectedProject && (
            <TimelinePrediction
              project={selectedProject}
              tasks={selectedProjectTasks}
              activities={accessibleActivities.filter(a => a.project_id === selectedProjectId)}
            />
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Project Reports</h2>
                <p className="text-sm text-slate-500">Select a project to generate and download comprehensive reports.</p>
              </div>
              <div className="w-full sm:w-[360px]">
                <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full h-14 bg-white border-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl shadow-sm text-left px-4">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] rounded-xl border-slate-200 shadow-xl overflow-y-auto">
                    {accessibleProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="cursor-pointer py-3 px-4 focus:bg-indigo-50 rounded-lg my-0.5 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="h-10 w-10 shrink-0 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={project.logo_url} alt={project.name} className="object-cover" />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xs uppercase">
                              {project.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-slate-900 truncate">{project.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md",
                                project.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                                  project.status === 'completed' ? "bg-blue-100 text-blue-700" :
                                    "bg-slate-100 text-slate-600"
                              )}>
                                {project.status}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                • {projectProgressMap[project.id] || 0}% Progress
                              </span>
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {selectedProject && (
            <ProjectReport
              project={selectedProject}
              tasks={selectedProjectTasks}
              stories={selectedProjectStories}
              activities={accessibleActivities.filter(a => a.project_id === selectedProjectId)}
            />
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <AskAIInsights
            projects={accessibleProjects}
            tasks={accessibleTasks}
            activities={accessibleActivities}
          />
        </TabsContent>
      </Tabs>

      {/* Overview Modal Dialog */}
      <Dialog open={isOverviewModalOpen} onOpenChange={setIsOverviewModalOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {overviewModalType === 'projects' ? (
                <span className="capitalize text-slate-800">Active Projects Overall</span>
              ) : (
                <>
                  <span className="capitalize text-slate-800">{overviewModalType} Tasks</span>
                  <span className="text-slate-400 font-normal text-sm">Overall</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 overflow-y-auto">
            {paginatedOverviewData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <p>No data found in this category.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overviewModalType === 'projects' ? (
                  paginatedOverviewData.map((project) => (
                    <div key={project.id} className="group p-4 rounded-xl border border-slate-200/60 bg-white hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-slate-100 shadow-sm group-hover:border-indigo-100 transition-colors">
                          <AvatarImage src={project.logo_url} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 font-bold tracking-wider">
                            {project.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base flex items-center gap-2">
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={cn(
                              "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border-0",
                              project.status === 'active' ? "bg-emerald-50 text-emerald-700" :
                                project.status === 'completed' ? "bg-blue-50 text-blue-700" :
                                  "bg-slate-50 text-slate-700"
                            )}>
                              {project.status === 'active' ? <Activity className="h-3 w-3 mr-1" /> : null}
                              {project.status}
                            </Badge>
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {projectProgressMap[project.id] || 0}% Done
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg px-3 py-1.5 min-w-[70px] border border-slate-100/50">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending</span>
                          <span className="font-black text-slate-700 text-sm">{project.pendingCount || 0}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-red-50/50 rounded-lg px-3 py-1.5 min-w-[70px] border border-red-100/50">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Critical</span>
                          <span className="font-black text-red-600 text-sm">{project.criticalCount || 0}</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-400 transition-colors ml-1" />
                      </div>
                    </div>
                  ))
                ) : (
                  paginatedOverviewData.map((task) => (
                    <div
                      key={task.id}
                      className="group relative p-4 rounded-xl border border-slate-200/60 bg-white hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-indigo-400 transition-colors" />

                      <div className="flex items-start justify-between gap-4 pl-2">
                        <div className="space-y-2.5 w-full pr-6">

                          {/* Top Row: Project Tag & Priority */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                                {task.projectName || "Unknown Project"}
                              </Badge>
                            </div>

                            {task.priority && (
                              <div className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase",
                                task.priority === 'urgent' ? "bg-red-50 text-red-700" :
                                  task.priority === 'high' ? "bg-orange-50 text-orange-700" :
                                    task.priority === 'medium' ? "bg-amber-50 text-amber-700" :
                                      "bg-slate-50 text-slate-600"
                              )}>
                                {task.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5" />}
                                {task.priority === 'high' && <AlertCircle className="h-3.5 w-3.5" />}
                                {task.priority === 'medium' && <Activity className="h-3.5 w-3.5" />}
                                {task.priority === 'low' && <Target className="h-3.5 w-3.5" />}
                                {task.priority}
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors">
                            {task.title}
                          </h4>

                          {/* Bottom Row: Status & Date */}
                          <div className="flex items-center gap-3 pt-1">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "capitalize font-semibold text-xs border-0 px-2.5 py-0.5",
                                task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                    task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                                      'bg-slate-100 text-slate-700'
                              )}
                            >
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full mr-1.5 inline-block",
                                task.status === 'completed' ? 'bg-emerald-500' :
                                  task.status === 'in_progress' ? 'bg-blue-500' :
                                    task.status === 'review' ? 'bg-purple-500' :
                                      'bg-slate-400'
                              )} />
                              {task.status.replace('_', ' ')}
                            </Badge>

                            {task.due_date && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                {format(new Date(task.due_date), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>

                        </div>

                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center">
                            <ChevronRight className="h-4 w-4 text-indigo-600" />
                          </div>
                        </div>

                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>

          {/* Modal Pagination */}
          {overviewModalTotalPages > 1 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                Showing {overviewModalStartIndex + 1} to {Math.min(overviewModalStartIndex + overviewModalItemsPerPage, overviewModalData.length)} of {overviewModalData.length} items
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600" onClick={() => setOverviewModalPage(p => Math.max(1, p - 1))} disabled={overviewModalPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <div className="text-xs font-semibold text-slate-700 px-2 border border-slate-200 bg-white h-8 flex items-center justify-center rounded-md min-w-[32px]">
                  {overviewModalPage}
                </div>
                <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600" onClick={() => setOverviewModalPage(p => Math.min(overviewModalTotalPages, p + 1))} disabled={overviewModalPage === overviewModalTotalPages}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inline Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailDialog
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
        />
      )}
    </div>
  );
}

