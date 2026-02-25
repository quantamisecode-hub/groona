import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, TrendingUp, CheckCircle2, Clock, AlertCircle, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsCard from "../components/dashboard/StatsCard";
import ProjectsList from "../components/dashboard/ProjectsList";
import RecentTasks from "../components/dashboard/RecentTasks";
import QuickActions from "../components/dashboard/QuickActions";
import DashboardInsights from "../components/dashboard/DashboardInsights";
import CreateProjectDialog from "../components/projects/CreateProjectDialog";
import WorkspaceSelector from "../components/workspaces/WorkspaceSelector";
import { useHasPermission } from "../components/shared/usePermissions";
import { toast } from "sonner";
import { useUser } from "../components/shared/UserContext";
import OnboardingChecklist from "../components/onboarding/OnboardingChecklist";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import TenantBrandingHeader from "../components/shared/TenantBrandingHeader"; // Import the header

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

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

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

  const stats = useMemo(() => ({
    totalProjects: filteredProjects.length,
    activeProjects: filteredProjects.filter(p => p.status === 'active').length,
    completedTasks: filteredTasks.filter(t => t.status === 'completed').length,
    pendingTasks: filteredTasks.filter(t => t.status === 'todo').length,
  }), [filteredProjects, filteredTasks]);

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

      <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
        <div className="max-w-[1800px] mx-auto w-full flex flex-col relative" style={{ maxWidth: '100%' }}>
          {/* Sticky Tenant Branding Header */}
          <div className="sticky top-0 z-20 bg-slate-50 pt-[34px]">
            <div className="px-6 md:px-8 py-0 bg-transparent">
              <TenantBrandingHeader currentUser={currentUser} />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 px-6 md:px-8 pt-6 pb-6 md:pb-8 space-y-8" data-onboarding="stats-cards">

            {tenant && tenant.onboarding_completed === false && currentUser && !currentUser.is_super_admin && (
              <OnboardingChecklist
                items={DASHBOARD_ONBOARDING_ITEMS}
                tenant={tenant}
                onDismiss={() => queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] })}
              />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Welcome back, {firstName}</h1>
                <p className="text-slate-600">Here's what's happening with your projects today.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <WorkspaceSelector currentUser={currentUser} onWorkspaceChange={setSelectedWorkspaceId} selectedWorkspaceId={selectedWorkspaceId} />
                {canCreateProject ? (
                  <Button onClick={() => setShowCreateProject(true)} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25">
                    <Plus className="w-4 h-4 mr-2" /> New Project
                  </Button>
                ) : (
                  <Link to={createPageUrl("Projects")}>
                    <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25">View Projects</Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-lg p-3">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Filter className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-600">Filters:</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-3 text-sm text-slate-600 hover:shadow-sm">
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard title="Total Projects" value={stats.totalProjects} icon={TrendingUp} gradient="from-blue-500 to-cyan-500" loading={projectsLoading} />
              <StatsCard title="Active Projects" value={stats.activeProjects} icon={Clock} gradient="from-purple-500 to-pink-500" loading={projectsLoading} />
              <StatsCard title="Completed Tasks" value={stats.completedTasks} icon={CheckCircle2} gradient="from-green-500 to-emerald-500" loading={tasksLoading} />
              <StatsCard title="Pending Tasks" value={stats.pendingTasks} icon={AlertCircle} gradient="from-orange-500 to-amber-500" loading={tasksLoading} />
            </div>

            {/* CONDITIONALLY RENDER INSIGHTS BASED ON PERMISSION */}
            {canViewInsights && (
              <DashboardInsights
                projects={filteredProjects}
                tasks={filteredTasks}
                stories={stories}
                activities={activities}
                loading={projectsLoading || tasksLoading}
              />
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><ProjectsList projects={filteredProjects.slice(0, 4)} loading={projectsLoading} /></div>
              <div className="space-y-6"><QuickActions /><RecentTasks tasks={(() => {
                // For team members, only show assigned tasks
                const isTeamMember = currentUser && !currentUser.is_super_admin && currentUser.role !== 'admin';
                if (isTeamMember && currentUser?.email) {
                  const userEmail = currentUser.email.toLowerCase();
                  return filteredTasks.filter(t => {
                    const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
                    return taskAssignees.some(assignee => assignee?.toLowerCase() === userEmail);
                  }).slice(0, 5);
                }
                return filteredTasks.slice(0, 5);
              })()} loading={tasksLoading} /></div>
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
    </OnboardingProvider>
  );
}

