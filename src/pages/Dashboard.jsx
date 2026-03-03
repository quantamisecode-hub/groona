import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Plus, TrendingUp, CheckCircle2, Clock, AlertCircle, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsCard from "../components/dashboard/StatsCard";
import ProjectsList from "../components/dashboard/ProjectsList";
import RecentTasks from "../components/dashboard/RecentTasks";
import DashboardInsights from "../components/dashboard/DashboardInsights";
import CreateProjectDialog from "../components/projects/CreateProjectDialog";
import WorkspaceSelector from "../components/workspaces/WorkspaceSelector";
import { useHasPermission } from "../components/shared/usePermissions";
import { toast } from "sonner";
import { useUser } from "../components/shared/UserContext";
import OnboardingChecklist from "../components/onboarding/OnboardingChecklist";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog";
import WeeklyTimesheetChart from "../components/dashboard/WeeklyTimesheetChart";
import ResourceAllocationChart from "../components/dashboard/ResourceAllocationChart";
import TeamActivityWidget from "../components/dashboard/TeamActivityWidget";
import SprintVelocityChart from "../components/dashboard/SprintVelocityChart";
import UpcomingDeadlines from "../components/dashboard/UpcomingDeadlines";
import TaskOverviewDonutChart from "../components/dashboard/TaskOverviewDonutChart";
import CompanyProfitabilityChart from "../components/dashboard/CompanyProfitabilityChart";
import AdminTopPerformers from "../components/dashboard/AdminTopPerformers";
import AdminLostRevenueWidget from "../components/dashboard/AdminLostRevenueWidget";

const DASHBOARD_ONBOARDING_ITEMS = [
  { id: 'create_workspace', label: 'Create a Workspace', hint: 'Organize your projects' },
  { id: 'create_project', label: 'Create your first project', hint: 'Start managing tasks' },
  { id: 'invite_team', label: 'Invite team members', hint: 'Collaborate with your organization' },
  { id: 'complete_profile', label: 'Complete your profile', hint: 'Add your details' }
];

export default function Dashboard() {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const taskIdParam = searchParams.get('taskId');
  const [selectedTaskId, setSelectedTaskId] = useState(taskIdParam || null);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState(null);
  const [selectedDonutStatus, setSelectedDonutStatus] = useState(null);

  // Sync selectedTaskId with URL param
  React.useEffect(() => {
    if (taskIdParam) setSelectedTaskId(taskIdParam);
  }, [taskIdParam]);

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('taskId');
    setSearchParams(newParams, { replace: true });
  };

  const { user: currentUser, tenant, effectiveTenantId } = useUser();
  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';

  // Permissions
  const canCreateProject = useHasPermission('can_create_project');
  const canViewInsights = useHasPermission('can_view_project_insights');

  // === UPDATED ONBOARDING LOGIC ===
  // Note: Onboarding redirect is now handled in Layout.jsx to prevent Dashboard from rendering first
  // This useEffect is kept as a fallback safety check
  React.useEffect(() => {
    // Robust checks to prevent false positives for existing users
    const shouldCheckOnboarding =
      tenant &&
      tenant.onboarding_completed === false &&
      currentUser &&
      !currentUser.is_super_admin &&
      currentUser.status === 'active' &&
      tenant.owner_email === currentUser.email &&
      !location.pathname.includes('TenantOnboarding');

    if (shouldCheckOnboarding) {
      console.log("[Dashboard] Fallback redirect to onboarding. Tenant status:", tenant.onboarding_completed);
      navigate(createPageUrl("TenantOnboarding"));
    }
  }, [tenant, currentUser, navigate, location.pathname]);

  // NEW: Fetch Project Roles to identify Project Managers
  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Project.list('-updated_date');
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Task.list('-updated_date');
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['recent-activities', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Activity.list('-created_date', 50);
      return groonabackend.entities.Activity.filter({ tenant_id: effectiveTenantId }, '-created_date', 50);
    },
    enabled: !!currentUser,
    staleTime: 1 * 60 * 1000,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Story.list();
      return groonabackend.entities.Story.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000,
  });

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set();
    tasks.forEach(task => {
      if (Array.isArray(task.assigned_to)) {
        task.assigned_to.forEach(email => assignees.add(email));
      } else if (task.assigned_to) {
        assignees.add(task.assigned_to);
      }
    });
    return Array.from(assignees);
  }, [tasks]);

  const { filteredProjects, filteredTasks } = useMemo(() => {
    // FIX: Show projects if Admin, Owner, Team Member, OR Project Manager
    const accessibleProjects = projects.filter(p => {
      if (isAdmin) return true;
      if (!currentUser) return false;

      const isOwner = p.owner === currentUser.email;
      const isTeamMember = p.team_members?.some(m => m.email === currentUser.email);
      const isProjectManager = projectRoles?.some(r => r.project_id === p.id);

      return isOwner || isTeamMember || isProjectManager;
    });

    let filteredP = selectedWorkspaceId
      ? accessibleProjects.filter(p => p.workspace_id === selectedWorkspaceId)
      : accessibleProjects;

    if (statusFilter !== "all") filteredP = filteredP.filter(p => p.status === statusFilter);
    if (priorityFilter !== "all") filteredP = filteredP.filter(p => p.priority === priorityFilter);

    const projectIds = new Set(filteredP.map(p => p.id));

    const validTaskStatuses = ['todo', 'in_progress', 'review', 'completed'];

    let filteredT = tasks.filter(t => {
      if (!projectIds.has(t.project_id)) return false;

      if (selectedWorkspaceId) {
        const taskProject = filteredP.find(p => p.id === t.project_id);
        if (taskProject?.workspace_id !== selectedWorkspaceId) return false;
      }

      if (statusFilter !== "all") {
        if (validTaskStatuses.includes(statusFilter) && t.status !== statusFilter) {
          return false;
        }
      }

      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all") {
        const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
        if (!taskAssignees.includes(assigneeFilter)) return false;
      }
      return true;
    });

    return { filteredProjects: filteredP, filteredTasks: filteredT };
  }, [projects, tasks, selectedWorkspaceId, statusFilter, priorityFilter, assigneeFilter, currentUser, isAdmin, projectRoles]);

  const createProjectMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Project.create(data),
    onSuccess: async (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      try {
        await groonabackend.entities.Activity.create({
          tenant_id: effectiveTenantId,
          action: 'created',
          entity_type: 'project',
          entity_id: newProject.id,
          entity_name: newProject.name,
          project_id: newProject.id,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          details: `Created new project: ${newProject.name}`
        });
      } catch (e) { console.error(e); }
      setShowCreateProject(false);
      toast.success('Project created successfully!');
    },
    onError: (error) => toast.error('Failed to create project.'),
  });

  const stats = useMemo(() => {
    return {
      totalProjects: filteredProjects.length,
      activeProjects: filteredProjects.filter(p => p.status === 'active').length,
      completedTasks: filteredTasks.filter(t => t.status === 'completed').length,
      pendingTasks: filteredTasks.filter(t => t.status === 'todo').length,
    };
  }, [filteredProjects, filteredTasks]);

  const firstName = currentUser?.full_name ? currentUser.full_name.split(' ')[0] : 'User';
  const userRole = currentUser?.is_super_admin || currentUser?.role === 'admin' ? 'admin' : 'user';

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
  };
  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || assigneeFilter !== "all";

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="dashboard">
      <FeatureOnboarding currentUser={currentUser} featureArea="dashboard" userRole={userRole} />

      <div className="flex flex-col bg-[#f8f9fa] w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
        <div className="max-w-[1800px] mx-auto w-full flex flex-col relative" style={{ maxWidth: '100%' }}>

          {/* Scrollable Content */}
          <div className="flex-1 px-6 md:px-8 pt-6 pb-6 md:pb-8 space-y-8" data-onboarding="stats-cards">

            {tenant && tenant.onboarding_completed === false && currentUser && !currentUser.is_super_admin && (
              <OnboardingChecklist
                items={DASHBOARD_ONBOARDING_ITEMS}
                tenant={tenant}
                onDismiss={() => queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] })}
              />
            )}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-2">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight mb-1">Welcome back, {firstName}</h1>
                <p className="text-sm text-slate-500">Here's what's happening with your projects today.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* 1. Filters */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-xl p-1 px-3 h-10">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[120px] text-sm border-0 shadow-none focus:ring-0 bg-transparent px-1">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700">
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>

                {/* 2. Workspace Selector */}
                <WorkspaceSelector currentUser={currentUser} onWorkspaceChange={setSelectedWorkspaceId} selectedWorkspaceId={selectedWorkspaceId} />

                {/* 3. Action Button */}
                {canCreateProject ? (
                  <Button onClick={() => setShowCreateProject(true)} className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-10 rounded-lg px-4 font-bold transition-all active:scale-95">
                    <Plus className="w-4 h-4 mr-2" /> New Project
                  </Button>
                ) : (
                  <Link to={createPageUrl("Projects")}>
                    <Button className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-10 rounded-lg px-4 font-bold transition-all active:scale-95">View Projects</Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatsCard title="Total Projects" value={stats.totalProjects} icon={TrendingUp} iconColor="text-blue-600" loading={projectsLoading} />
              <StatsCard title="Active Projects" value={stats.activeProjects} icon={Clock} iconColor="text-purple-600" loading={projectsLoading} />
              <StatsCard title="Total Completed Tasks" value={stats.completedTasks} icon={CheckCircle2} iconColor="text-green-600" loading={tasksLoading} />
              <StatsCard title="Total Pending Tasks" value={stats.pendingTasks} icon={AlertCircle} iconColor="text-orange-600" loading={tasksLoading} />
            </div>

            {isAdmin && (
              <div className="flex flex-col gap-6">
                <DashboardInsights projects={filteredProjects} tasks={filteredTasks} activities={activities} loading={projectsLoading || tasksLoading} />
                <AdminTopPerformers projects={filteredProjects} tasks={filteredTasks} />
                <CompanyProfitabilityChart />
                <AdminLostRevenueWidget />
              </div>
            )}

            {/* CONDITIONALLY RENDER ADMIN WIDGETS */}            {/* CONDITIONALLY RENDER INSIGHTS BASED ON PERMISSION */}
            {canViewInsights && !isAdmin && (
              <DashboardInsights projects={filteredProjects} tasks={filteredTasks} activities={activities} loading={projectsLoading || tasksLoading} />
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {!isAdmin && (
                  <>
                    <UpcomingDeadlines
                      tasks={filteredTasks}
                      selectedDate={selectedDeadlineDate}
                      onDateSelect={setSelectedDeadlineDate}
                    />
                    <RecentTasks
                      title={
                        selectedDeadlineDate
                          ? `Tasks due ${format(selectedDeadlineDate, 'MMM d')}`
                          : selectedDonutStatus
                            ? `My ${selectedDonutStatus === 'to_do' ? 'To Do' : selectedDonutStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Tasks`
                            : "My Active Tasks"
                      }
                      tasks={(() => {
                        if (currentUser?.email) {
                          const userEmail = currentUser.email.toLowerCase();
                          let myTasks = filteredTasks.filter(t => {
                            const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
                            const isAssigned = taskAssignees.some(assignee => assignee?.toLowerCase() === userEmail);
                            return isAssigned && t.status !== 'completed';
                          });

                          if (selectedDeadlineDate) {
                            myTasks = myTasks.filter(t => {
                              if (!t.due_date) return false;
                              const taskDateStr = t.due_date.split('T')[0];
                              const selectedDateStr = format(selectedDeadlineDate, 'yyyy-MM-dd');
                              return taskDateStr === selectedDateStr;
                            });
                          }

                          if (selectedDonutStatus) {
                            myTasks = myTasks.filter(t => {
                              let s = (t.status || 'todo').toLowerCase();
                              if (s === 'to_do') s = 'todo'; // normalize
                              const filterS = selectedDonutStatus === 'to_do' ? 'todo' : selectedDonutStatus;
                              return s === filterS;
                            });
                          }

                          return myTasks.slice(0, 5);
                        }
                        return [];
                      })()}
                      loading={tasksLoading}
                    />
                  </>
                )}
                <ProjectsList projects={filteredProjects} stories={stories} loading={projectsLoading} />
                <SprintVelocityChart isAdmin={isAdmin} tenantId={effectiveTenantId} className="flex-1 min-h-[320px]" />
              </div>
              <div className="space-y-6">
                <TaskOverviewDonutChart
                  tasks={filteredTasks}
                  selectedStatus={selectedDonutStatus}
                  onSelectStatus={setSelectedDonutStatus}
                  isAdmin={isAdmin}
                />
                <WeeklyTimesheetChart isAdmin={isAdmin} tenantId={effectiveTenantId} />
                <ResourceAllocationChart isAdmin={isAdmin} tenantId={effectiveTenantId} />
                <TeamActivityWidget activities={activities} />
              </div>
            </div>

            {canCreateProject && (
              <CreateProjectDialog
                open={showCreateProject}
                onClose={() => setShowCreateProject(false)}
                onSubmit={(data) => createProjectMutation.mutate({ ...data, tenant_id: effectiveTenantId, workspace_id: selectedWorkspaceId || data.workspace_id })}
                loading={createProjectMutation.isPending}
                error={createProjectMutation.error}
              />
            )}
          </div>
        </div>
      </div>
      {/* Global Task Detail Dialog for Deep Linking */}
      {(selectedTaskId || taskIdParam) && (
        <TaskDetailDialog
          open={!!selectedTaskId || !!taskIdParam}
          onClose={handleCloseTaskDetail}
          taskId={selectedTaskId || taskIdParam}
          key="global-dashboard-task-dialog"
        />
      )}
    </OnboardingProvider>
  );
}
