import React, { useState, useEffect, useRef } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectCard from "../components/projects/ProjectCard";
import CreateProjectDialog from "../components/projects/CreateProjectDialog";
import WorkspaceSelector from "../components/workspaces/WorkspaceSelector";
import { useHasPermission } from "../components/shared/usePermissions";
import { toast } from "sonner";
import ConfirmationDialog from "../components/shared/ConfirmationDialog";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import { useUser } from "../components/shared/UserContext"; // Import Global User Context
import { io } from "socket.io-client";

export default function Projects() {
  // Use Global Context for User (Instant access, no loading delay on navigation)
  const { user: currentUser, loading: userLoading, tenant } = useUser();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  const canCreateProject = useHasPermission('can_create_project');
  const canDeleteProject = useHasPermission('can_delete_project');

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';


  // 1. Fetch Tenant (Cached via React Query)
  const { data: tenantData } = useQuery({
    queryKey: ['tenant', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;
      // If tenant is already available from context, use it to speed up initial render
      if (tenant && tenant.id === effectiveTenantId) return tenant;

      const tenants = await groonabackend.entities.Tenant.filter({ _id: effectiveTenantId });
      return tenants[0];
    },
    enabled: !!effectiveTenantId,
    staleTime: Infinity, // Tenant data rarely changes, keep it fresh indefinitely
  });

  const activeTenant = tenantData || tenant;
  const isMarketing = activeTenant?.company_type === 'MARKETING';
  const termSingular = isMarketing ? "Campaign" : "Project";
  const termPlural = isMarketing ? "Campaigns" : "Projects";

  // 2. WebSocket Connection (Real-time triggers)
  useEffect(() => {
    if (!effectiveTenantId) return;

    const socketUrl = API_BASE;
    socketRef.current = io(socketUrl);

    socketRef.current.on("connect", () => {
      console.log("[Projects] Socket connected");
      socketRef.current.emit("join_room", effectiveTenantId);
    });

    // When an update comes, invalidate queries to force a background refresh
    // This overrides 'staleTime', ensuring we see new projects immediately
    socketRef.current.on("project_change", (data) => {
      console.log("[Projects] Real-time update received:", data);
      queryClient.invalidateQueries(['projects']);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [effectiveTenantId, queryClient]);

  // Fetch ProjectUserRole
  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // 3. Projects Query (Optimized for Cache)
  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ['projects', effectiveTenantId, selectedWorkspaceId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser && !!effectiveTenantId,
    placeholderData: (previousData) => previousData,

    // === OPTIMIZATION SETTINGS ===
    // 1 minute stale time: Visiting the page again within 1 min shows data INSTANTLY.
    staleTime: 60 * 1000,
    // Polling as a backup to Sockets, but less frequent to save resources
    refetchInterval: 10000,
  });

  const projectsRef = useRef({});

  // Effect to handle deeplinking/scrolling to a specific project card
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlightId');

    if (highlightId && projectsRef.current[highlightId] && projects.length > 0) {
      setTimeout(() => {
        projectsRef.current[highlightId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [projects.length, window.location.search]);

  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => {
      const dataToCreate = {
        ...projectData,
        tenant_id: effectiveTenantId,
        owner: currentUser?.email,
        workspace_id: projectData.workspace_id || undefined,
      };

      const newProject = await groonabackend.entities.Project.create(dataToCreate);

      if (projectData.template_id && selectedTemplate?.task_templates) {
        const taskPromises = selectedTemplate.task_templates.map(taskTemplate =>
          groonabackend.entities.Task.create({
            tenant_id: effectiveTenantId,
            workspace_id: newProject.workspace_id,
            project_id: newProject.id,
            title: taskTemplate.title,
            description: taskTemplate.description,
            task_type: taskTemplate.task_type || 'task',
            priority: taskTemplate.priority || 'medium',
            estimated_hours: taskTemplate.estimated_hours,
            status: 'todo',
            reporter: currentUser?.email,
          })
        );
        await Promise.all(taskPromises);
      }
      return newProject;
    },
    onSuccess: async (newProject) => {
      // 1. Instant Cache Update: Show new project immediately without fetching
      queryClient.setQueryData(['projects', effectiveTenantId, selectedWorkspaceId], (old) => {
        return old ? [newProject, ...old] : [newProject];
      });

      // 2. Background Consistency Check
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // 3. Real-time Broadcast
      if (socketRef.current) {
        socketRef.current.emit("notify_project_change", {
          tenant_id: effectiveTenantId,
          action: "created",
          project: newProject
        });
      }

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
          details: `Created new ${termSingular.toLowerCase()}: ${newProject.name}`
        });
      } catch (error) {
        console.error('[Projects] Failed to create activity:', error);
      }

      setShowCreateDialog(false);
      setSelectedTemplate(null);
      toast.success(`${termSingular} "${newProject.name}" created successfully!`);
    },
    onError: (error) => {
      toast.error(`Failed to create ${termSingular.toLowerCase()}`, { description: error.message });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id) => {
      // 1. Clean up all child entities first to avoid "orphans" and stale stats
      const entitiesToCleanup = [
        { name: 'Task', filter: { project_id: id } },
        { name: 'Story', filter: { project_id: id } },
        { name: 'Sprint', filter: { project_id: id } },
        { name: 'Epic', filter: { project_id: id } },
        { name: 'Activity', filter: { project_id: id } },
        { name: 'Timesheet', filter: { project_id: id } },
        { name: 'Milestone', filter: { project_id: id } },
        { name: 'ProjectExpense', filter: { project_id: id } }
      ];

      for (const entity of entitiesToCleanup) {
        try {
          const items = await groonabackend.entities[entity.name].filter(entity.filter);
          if (items.length > 0) {
            await Promise.all(
              items.map(item => groonabackend.entities[entity.name].delete(item.id || item._id))
            );
          }
        } catch (e) {
          console.error(`Cleanup failed for ${entity.name}:`, e);
          // Continue with next entity even if one fails
        }
      }

      // Also clean up project-level comments
      try {
        const comments = await groonabackend.entities.Comment.filter({
          entity_type: 'project',
          entity_id: id
        });
        if (comments.length > 0) {
          await Promise.all(
            comments.map(c => groonabackend.entities.Comment.delete(c.id || c._id))
          );
        }
      } catch (e) {
        console.error('Comment cleanup failed:', e);
      }

      // 2. Finally delete the project itself
      await groonabackend.entities.Project.delete(id);
      return id;
    },
    onSuccess: async (deletedId) => {
      // Instant UI update
      queryClient.setQueryData(['projects', effectiveTenantId, selectedWorkspaceId], (old) => {
        return old ? old.filter(p => p.id !== deletedId) : [];
      });

      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      if (socketRef.current) {
        socketRef.current.emit("notify_project_change", {
          tenant_id: effectiveTenantId,
          action: "deleted"
        });
      }

      toast.success(`${termSingular} deleted successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to delete ${termSingular.toLowerCase()}`, { description: error.message });
    },
  });

  // Filter logic...
  let filteredProjects = projects;
  if (!isAdmin && currentUser) {
    filteredProjects = projects.filter(p => {
      const isTeamMember = p.team_members?.some(m => m.email === currentUser.email);
      const isProjectManager = projectRoles.some(r => r.project_id === p.id);
      const isOwner = p.owner === currentUser.email;
      return isTeamMember || isProjectManager || isOwner;
    });
  }
  if (selectedWorkspaceId) {
    filteredProjects = filteredProjects.filter(p => p.workspace_id === selectedWorkspaceId);
  }

  const isProjectManager = projectRoles.length > 0;
  const userRole = isAdmin ? 'admin' : (isProjectManager ? 'project_manager' : 'user');

  const handleCreateProject = (templateToUse = null) => {
    setSelectedTemplate(templateToUse);
    setShowCreateDialog(true);
  };

  const handleDeleteProject = (project) => {
    if (!canDeleteProject) {
      toast.error(`You do not have permission to delete ${termPlural.toLowerCase()}`);
      return;
    }
    setDeletingProject(project);
  };

  const confirmDeleteProject = () => {
    if (deletingProject) {
      deleteProjectMutation.mutate(deletingProject.id);
      setDeletingProject(null);
    }
  };

  const handleManualRefresh = async () => {
    await refetch();
    toast.success(`${termPlural} updated`);
  };

  // === SMART LOADING LOGIC ===
  // Only show Skeleton if we have NO user data AND NO project data (Fresh Load).
  // If we have cached project data, show it immediately (isPageLoading = false).
  const isPageLoading = (userLoading && !currentUser) || (!projects.length && isProjectsLoading);

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="projects">
      <FeatureOnboarding currentUser={currentUser} featureArea="projects" userRole={userRole} />
      <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
        <div className="max-w-7xl mx-auto w-full flex flex-col relative" style={{ maxWidth: '100%' }}>
          {/* Sticky Header Section */}
          <div className="sticky top-0 z-30 bg-white border-b border-slate-200/60 pb-4 pt-8">
            <div className="px-4 md:px-6 lg:px-8 pt-0 pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{termPlural}</h1>
                  <div className="text-slate-600">
                    {isPageLoading
                      ? <Skeleton className="h-4 w-32 inline-block" />
                      : <span>{filteredProjects.length} {filteredProjects.length === 1 ? termSingular.toLowerCase() : termPlural.toLowerCase()}</span>
                    }
                    {!isPageLoading && selectedWorkspaceId && <span> in selected workspace</span>}
                    {!isPageLoading && !selectedWorkspaceId && projects.length > 0 && <span> (all workspaces)</span>}
                    {isRefetching && !isPageLoading && <span className="ml-2 text-xs text-blue-500 animate-pulse font-medium">Syncing...</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <WorkspaceSelector
                    currentUser={currentUser}
                    onWorkspaceChange={setSelectedWorkspaceId}
                    selectedWorkspaceId={selectedWorkspaceId}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleManualRefresh}
                    disabled={isPageLoading || isRefetching}
                    title={`Refresh ${termPlural.toLowerCase()}`}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin text-blue-600' : ''}`} />
                  </Button>
                  {canCreateProject && (
                    <Button
                      onClick={() => handleCreateProject(null)}
                      disabled={isPageLoading}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New {termSingular}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1">
            <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-4">
              {/* LOADING STATE: Shimmering Skeletons */}
              {isPageLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                      <div className="space-y-3 pt-2">
                        <Skeleton className="h-6 w-3/4 rounded" />
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-2/3 rounded" />
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex gap-4 mt-auto">
                        <Skeleton className="h-4 w-16 rounded" />
                        <Skeleton className="h-4 w-16 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-600 mb-4">
                    {!isAdmin && projects.length > 0
                      ? `You haven't been assigned to any ${termPlural.toLowerCase()} yet.`
                      : (selectedWorkspaceId
                        ? `No ${termPlural.toLowerCase()} in this workspace yet.`
                        : `No ${termPlural.toLowerCase()} yet. Create your first ${termSingular.toLowerCase()} to get started!`)
                    }
                  </p>
                  {canCreateProject && (
                    <Button
                      onClick={() => handleCreateProject(null)}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create {termSingular}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-onboarding="projects-list">
                  {filteredProjects.map(project => {
                    // Extract project ID safely
                    const pId = project.id || project._id;
                    return (
                      <div key={pId} ref={el => projectsRef.current[pId] = el}>
                        <ProjectCard
                          project={project}
                          onDelete={() => handleDeleteProject(project)}
                          termSingular={termSingular}
                          highlighted={new URLSearchParams(window.location.search).get('highlightId') === pId}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {canCreateProject && (
        <CreateProjectDialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            setSelectedTemplate(null);
          }}
          onSubmit={(data) => createProjectMutation.mutate(data)}
          loading={createProjectMutation.isPending}
          error={createProjectMutation.error}
          selectedTemplate={selectedTemplate}
          preselectedWorkspaceId={selectedWorkspaceId}
          title={`Create New ${termSingular}`}
          termSingular={termSingular}
        />
      )}

      <ConfirmationDialog
        open={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={confirmDeleteProject}
        title={`Delete ${termSingular}?`}
        description={`Are you sure you want to delete "${deletingProject?.name}"?`}
        confirmLabel={`Delete ${termSingular}`}
        confirmType="danger"
        requiresTyping={true}
        keyword="DELETE"
        loading={deleteProjectMutation.isPending}
      />
    </OnboardingProvider>
  );
}