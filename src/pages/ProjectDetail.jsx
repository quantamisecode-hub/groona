import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, Edit, Folder, Users, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PermissionGuard from "../components/shared/PermissionGuard";
import { useUser } from "../components/shared/UserContext";
import ProjectHeader from "../components/project-detail/ProjectHeader";
import TasksList from "../components/project-detail/TasksList";
import CreateTaskModal from "../components/tasks/CreateTaskModal";
import EditProjectDialog from "../components/project-detail/EditProjectDialog";
import ProjectTeamManagement from "../components/project-detail/ProjectTeamManagement";
import ActivityFeed from "../components/project-detail/ActivityFeed";
import CommentsSection from "../components/project-detail/CommentsSection";
import ProjectFiles from "../components/project-detail/ProjectFiles";
import ProjectDashboard from "../components/project-detail/dashboard/ProjectDashboard";
import ProjectExpenses from "../components/project-detail/ProjectExpenses";
import ProjectBacklog from "../components/sprint/ProjectBacklog";
import SprintManagement from "../components/sprint/SprintManagement";
import RetrospectiveView from "../components/sprint/RetrospectiveView";
import MilestonesList from "../components/project-detail/MilestonesList";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog";
import StoryDetailDialog from "../components/stories/StoryDetailDialog";
import { notificationService } from "../components/shared/notificationService";
import { toast } from "sonner";
import EpicsList from "../components/epics/EpicsList";

export default function ProjectDetail() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Robust URL Parameter Handling
  const projectId = searchParams.get('id');
  const taskIdParam = searchParams.get('taskId');
  const commentIdParam = searchParams.get('commentId');

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);

  // State for Deep Linked Task
  const [selectedTaskId, setSelectedTaskId] = useState(taskIdParam || null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [showStoryDetail, setShowStoryDetail] = useState(false);

  const { user: currentUser, tenant, effectiveTenantId } = useUser();
  const isMarketingCompany = tenant?.company_type === 'MARKETING';

  // Deep Linking Effect
  useEffect(() => {
    setSelectedTaskId(taskIdParam);
  }, [taskIdParam]);

  // Close Task & Clean URL
  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('taskId');
    newParams.delete('commentId');
    setSearchParams(newParams, { replace: true });
  };

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await groonabackend.entities.Project.list();
      // Handle both id and _id formats
      return projects.find(p => (p.id === projectId) || (p._id === projectId));
    },
    enabled: !!projectId,
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace', project?.workspace_id],
    queryFn: async () => {
      if (!project?.workspace_id) return null;
      const workspaces = await groonabackend.entities.Workspace.list();
      return workspaces.find(ws => ws.id === project.workspace_id);
    },
    enabled: !!project?.workspace_id,
  });

  const { data: clientOrg } = useQuery({
    queryKey: ['client', project?.client],
    queryFn: async () => {
      if (!project?.client) return null;
      const clients = await groonabackend.entities.Client.list();
      return clients.find(c => c.id === project.client);
    },
    enabled: !!project?.client,
  });

  const { data: clientUser } = useQuery({
    queryKey: ['user', project?.client_user_id],
    queryFn: async () => {
      if (!project?.client_user_id) return null;
      // Use list() and find() for reliability, mirroring dialog logic
      const users = await groonabackend.entities.User.list();
      return users.find(u => u.id === project.client_user_id || u._id === project.client_user_id);
    },
    enabled: !!project?.client_user_id,
  });

  // === UPDATED: Real-time Polling for Tasks ===
  // 1. fetches tasks every 2 seconds (refetchInterval: 2000)
  // 2. fetches immediately on window focus (refetchOnWindowFocus: true)
  // 3. staleTime: 0 ensures data is considered "old" immediately so it refetches
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => groonabackend.entities.Task.filter({ project_id: projectId }, '-created_date'),
    enabled: !!projectId,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', projectId],
    queryFn: () => groonabackend.entities.Activity.filter({ project_id: projectId }, '-created_date', 50),
    enabled: !!projectId,
    refetchInterval: 5000, // Keep activity feed updated every 5s
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', projectId],
    queryFn: () => groonabackend.entities.Comment.filter({
      entity_type: 'project',
      entity_id: projectId
    }, '-created_date'),
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', currentUser?.tenant_id],
    queryFn: async () => {
      const allUsers = await groonabackend.entities.User.list();
      if (!currentUser) return [];

      const tenantId = currentUser.active_tenant_id || currentUser.tenant_id;
      return allUsers.filter(u => u.tenant_id === tenantId);
    },
    enabled: !!currentUser,
  });

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => groonabackend.entities.Sprint.filter({ project_id: projectId }, '-start_date'),
    enabled: !!projectId && !isMarketingCompany,
  });

  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => groonabackend.entities.Story.filter({ project_id: projectId }),
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const { data: projectTimesheets = [] } = useQuery({
    queryKey: ['project-timesheets', projectId],
    queryFn: () => groonabackend.entities.Timesheet.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  // Check if current user is a project manager for this specific project
  const { data: projectUserRole } = useQuery({
    queryKey: ['project-user-role', projectId, currentUser?.id],
    queryFn: async () => {
      if (!projectId || !currentUser?.id) return null;
      const roles = await groonabackend.entities.ProjectUserRole.filter({
        project_id: projectId,
        user_id: currentUser.id,
        role: 'project_manager'
      });
      return roles.length > 0 ? roles[0] : null;
    },
    enabled: !!projectId && !!currentUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isProjectManagerForThisProject = !!projectUserRole;
  const isViewer = currentUser?.custom_role === 'viewer';

  const createSprintMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Sprint.create({
      ...data,
      tenant_id: currentUser?.tenant_id,
      project_id: projectId,
      status: 'planned'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create sprint: ${error.message}`);
    }
  });

  const updateSprintMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.Sprint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update sprint: ${error.message}`);
    }
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.Sprint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete sprint: ${error.message}`);
    }
  });

  const moveTaskToSprintMutation = useMutation({
    mutationFn: ({ taskId, sprintId }) => groonabackend.entities.Task.update(taskId, { sprint_id: sprintId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task moved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to move task: ${error.message}`);
    }
  });

  const createActivityMutation = useMutation({
    mutationFn: (activityData) => groonabackend.entities.Activity.create(activityData),
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data) => {
      const updated = await groonabackend.entities.Project.update(projectId, data);

      await createActivityMutation.mutateAsync({
        tenant_id: currentUser?.tenant_id,
        action: "updated",
        entity_type: "project",
        entity_id: projectId,
        entity_name: project.name,
        project_id: projectId,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
      });

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      setShowEditProject(false);
      toast.success('Project updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    }
  });


  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const oldTask = tasks.find(t => t.id === id);
      const updated = await groonabackend.entities.Task.update(id, data);

      await createActivityMutation.mutateAsync({
        tenant_id: effectiveTenantId,
        action: data.status === 'completed' ? "completed" : "updated",
        entity_type: "task",
        entity_id: id,
        entity_name: updated.title || oldTask.title,
        project_id: projectId,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
      });

      if (data.assigned_to) {
        const newAssignees = Array.isArray(data.assigned_to)
          ? data.assigned_to
          : (data.assigned_to ? [data.assigned_to] : []);
        const oldAssignees = Array.isArray(oldTask.assigned_to)
          ? oldTask.assigned_to
          : (oldTask.assigned_to ? [oldTask.assigned_to] : []);

        const addedAssignees = newAssignees.filter(email => !oldAssignees.includes(email));

        if (addedAssignees.length > 0) {
          await notificationService.notifyTaskAssignment({
            task: { ...oldTask, ...updated, project_id: projectId },
            assignedUsers: addedAssignees,
            assignedBy: currentUser.full_name || currentUser.email,
            tenantId: effectiveTenantId
          });
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id) => {
      const task = tasks.find(t => t.id === id);
      const taskTitle = task?.title || "Unknown Task";

      await groonabackend.entities.Task.delete(id);

      try {
        await createActivityMutation.mutateAsync({
          action: "deleted",
          entity_type: "task",
          entity_id: id,
          entity_name: taskTitle,
          project_id: projectId,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
        });
      } catch (activityError) {
        console.warn("Failed to create activity log for task deletion", activityError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      toast.success('Task deleted');
    },
    onError: (error) => {
      console.error('Failed to delete task:', error);
      toast.error(`Failed to delete task: ${error.message || 'Please try again.'}`);
    },
  });

  // === UPDATED: Hybrid Update Strategy ===
  // 1. Manually update cache for instant feedback (User perception)
  // 2. Poll automatically (via useQuery) to keep sync with server (Real truth)
  const handleTaskCreated = (newTask) => {
    if (newTask) {
      queryClient.setQueryData(['tasks', projectId], (oldTasks) => {
        const currentTasks = Array.isArray(oldTasks) ? oldTasks : [];
        // Prevent duplicates
        if (currentTasks.some(t => t.id === newTask.id)) return currentTasks;
        // Add new task to the TOP of the list immediately
        return [newTask, ...currentTasks];
      });
    }

    // Force an invalidation after a small delay to ensure the backend has indexed it,
    // ensuring the "Realtime" poll doesn't accidentally overwrite our manual update with an empty list.
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
    }, 500);

    setShowCreateTask(false);
  };

  return (
    <>
      {projectLoading ? (
        <div className="p-6 md:p-8">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-white/60 rounded-2xl" />
            <div className="h-96 bg-white/60 rounded-2xl" />
          </div>
        </div>
      ) : !project ? (
        <div className="p-6 md:p-8 text-center">
          <p className="text-slate-600 mb-4">Project not found</p>
          <Button onClick={() => navigate(createPageUrl("Projects"))}>
            Back to Projects
          </Button>
        </div>
      ) : (
        <div className="flex flex-col space-y-0">
          {/* Sticky Header Section */}
          <div className="bg-white px-6 md:p-8 pb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(createPageUrl("Projects"))}
                className="border-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{project.name}</h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    {workspace && (
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        <span>{workspace.name}</span>
                      </div>
                    )}

                    {clientOrg && (
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-slate-300" /> {/* Separator */}
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium text-slate-700">{clientOrg.name}</span>
                      </div>
                    )}

                    {clientUser && (
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-slate-300" /> {/* Separator */}
                        <Briefcase className="h-4 w-4" />
                        <span>{clientUser.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <PermissionGuard permission="can_manage_team" context={{ project }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowTeamManagement(true)}
                    className="border-slate-200"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Team
                  </Button>
                </PermissionGuard>

                <PermissionGuard permission="can_edit_project" context={{ project }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowEditProject(true)}
                    className="border-slate-200"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          </div>

          <div className="px-6 md:p-8 pt-0 space-y-4">

            <ProjectHeader
              project={project}
              tasks={tasks}
              tasksCount={(() => {
                // For viewers, only count assigned tasks
                // For project managers of this project, show all tasks
                if (isViewer) {
                  if (currentUser?.email) {
                    const userEmail = currentUser.email.toLowerCase();
                    return tasks.filter(t => {
                      const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
                      return taskAssignees.some(assignee => assignee?.toLowerCase() === userEmail);
                    }).length;
                  }
                  return 0;
                }
                // Project managers and admins see all tasks
                return tasks.length;
              })()}
              projectTimesheets={(() => {
                // For viewers, only show timesheets for assigned tasks
                // For project managers of this project, show all timesheets
                if (isViewer) {
                  if (currentUser?.email) {
                    const userEmail = currentUser.email.toLowerCase();
                    // Get task IDs assigned to the user
                    const assignedTaskIds = tasks
                      .filter(t => {
                        const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
                        return taskAssignees.some(assignee => assignee?.toLowerCase() === userEmail);
                      })
                      .map(t => t.id);
                    // Filter timesheets to only those for assigned tasks
                    return projectTimesheets.filter(ts => assignedTaskIds.includes(ts.task_id));
                  }
                  return [];
                }
                // Project managers and admins see all timesheets
                return projectTimesheets;
              })()}
            />

            <Tabs defaultValue="overview" className="space-y-6">
              <div className="border-b border-slate-200/60 -mx-6 md:-mx-8 px-6 md:px-8 mb-6 pt-4">
                <TabsList className="w-full justify-start border-none rounded-none h-auto p-0 bg-transparent gap-6">
                  <TabsTrigger
                    value="overview"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="backlog"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3"
                  >
                    Backlog
                  </TabsTrigger>
                  {!isMarketingCompany && (
                    <>
                      <TabsTrigger
                        value="sprints"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3"
                      >
                        Sprints & Planning
                      </TabsTrigger>
                      <TabsTrigger
                        value="retrospectives"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3"
                      >
                        Retrospectives
                      </TabsTrigger>
                    </>
                  )}
                  <TabsTrigger
                    value="milestones"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3"
                  >
                    Milestones
                  </TabsTrigger>
                  {/* Hide Budget & Expenses tab for viewer and project_manager */}
                  {currentUser && currentUser.custom_role !== 'viewer' && currentUser.custom_role !== 'project_manager' && (
                    <TabsTrigger
                      value="budget"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3"
                    >
                      Budget & Expenses
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-6">
                <ProjectDashboard
                  project={project}
                  tasks={tasks}
                  stories={stories}
                  activities={activities}
                  onUpdateSettings={(data) => updateProjectMutation.mutate(data)}
                />

                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold text-slate-900">Recent Tasks</h2>
                      <Button
                        onClick={() => setShowCreateTask(true)}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New
                      </Button>
                    </div>

                    <TasksList
                      tasks={(() => {
                        // For viewers, only show assigned tasks
                        // For project managers of this project, show all tasks
                        if (isViewer && currentUser?.email) {
                          const userEmail = currentUser.email.toLowerCase();
                          return tasks.filter(t => {
                            const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
                            return taskAssignees.some(assignee => assignee?.toLowerCase() === userEmail);
                          }).slice(0, 5);
                        }
                        // For team members (not admin, not project manager), only show assigned tasks
                        if (!isProjectManagerForThisProject && !currentUser?.is_super_admin && currentUser?.role !== 'admin' && currentUser?.email) {
                          const userEmail = currentUser.email.toLowerCase();
                          return tasks.filter(t => {
                            const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
                            return taskAssignees.some(assignee => assignee?.toLowerCase() === userEmail);
                          }).slice(0, 5);
                        }
                        // Project managers and admins see all tasks
                        return tasks.slice(0, 5);
                      })()}
                      loading={tasksLoading}
                      onUpdate={(id, data) => updateTaskMutation.mutate({ id, data })}
                      onDelete={(id) => deleteTaskMutation.mutate(id)}
                      allTasks={tasks}
                    />

                    <ProjectFiles projectId={projectId} />

                    <CommentsSection
                      comments={comments}
                      users={users} // Passed strictly filtered users
                      loading={commentsLoading}
                      entityId={projectId}
                      entityType="project"
                      entityName={project.name}
                      currentUser={currentUser}
                      // Highlight Project Level Comments only if no task is selected
                      highlightCommentId={!taskIdParam ? commentIdParam : null}
                    />
                  </div>

                  <div className="pr-2 sm:pr-4 lg:pr-6">
                    <ActivityFeed activities={activities} loading={activitiesLoading} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="backlog" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Side - Backlog */}
                  <div className="space-y-4 border-r-0 lg:border-r lg:border-slate-200 lg:pr-6">
                    <ProjectBacklog
                      tasks={tasks}
                      stories={stories}
                      sprints={sprints}
                      users={users}
                      projectId={projectId}
                      onMoveTask={(taskId, sprintId) => moveTaskToSprintMutation.mutate({ taskId, sprintId })}
                      onTaskCreated={handleTaskCreated}
                      onUpdate={(id, data) => updateTaskMutation.mutate({ id, data })}
                      onDelete={(id) => deleteTaskMutation.mutate(id)}
                      onTaskClick={(taskId) => {
                        setSelectedTaskId(taskId);
                        setShowTaskDetail(true);
                      }}
                      onStoryClick={(storyId) => {
                        setSelectedStoryId(storyId);
                        setShowStoryDetail(true);
                      }}
                    />
                  </div>

                  {/* Right Side - Epics */}
                  <div className="space-y-4 lg:pl-6">
                    <EpicsList projectId={projectId} sprints={sprints} />
                  </div>
                </div>
              </TabsContent>

              {!isMarketingCompany && (
                <>
                  <TabsContent value="sprints">
                    <SprintManagement
                      projectId={projectId}
                      sprints={sprints}
                      tasks={tasks}
                      tenantId={effectiveTenantId}
                      onCreateSprint={(data) => createSprintMutation.mutate(data)}
                      onUpdateSprint={(id, data) => updateSprintMutation.mutate({ id, data })}
                      onDeleteSprint={(id) => deleteSprintMutation.mutate(id)}
                      onMoveTask={(taskId, sprintId) => moveTaskToSprintMutation.mutate({ taskId, sprintId })}
                      onUpdateTask={(id, data) => updateTaskMutation.mutate({ id, data })}
                      onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
                    />
                  </TabsContent>

                  <TabsContent value="retrospectives">
                    <RetrospectiveView
                      projectId={projectId}
                      tenantId={currentUser?.tenant_id}
                    />
                  </TabsContent>
                </>
              )}

              <TabsContent value="milestones">
                <MilestonesList projectId={projectId} />
              </TabsContent>

              {/* Hide Budget & Expenses content for viewer and project_manager */}
              {currentUser && currentUser.custom_role !== 'viewer' && currentUser.custom_role !== 'project_manager' && (
                <TabsContent value="budget">
                  <ProjectExpenses
                    projectId={projectId}
                    currentUser={currentUser}
                    project={project}
                  />
                </TabsContent>
              )}
            </Tabs>

            <CreateTaskModal
              open={showCreateTask}
              onClose={() => setShowCreateTask(false)}
              projectId={projectId}
              onSuccess={handleTaskCreated}
            />

            <EditProjectDialog
              open={showEditProject}
              onClose={() => setShowEditProject(false)}
              onSubmit={(data) => updateProjectMutation.mutate(data)}
              project={project}
              loading={updateProjectMutation.isPending}
            />

            {/* Task Detail Dialog for Deep Linking */}


            {showStoryDetail && selectedStoryId && (
              <StoryDetailDialog
                open={showStoryDetail}
                onClose={() => setShowStoryDetail(false)}
                storyId={selectedStoryId}
              />
            )}

            {showTeamManagement && (
              <ProjectTeamManagement
                open={showTeamManagement}
                onClose={() => setShowTeamManagement(false)}
                project={project}
                currentUser={currentUser}
              />
            )}
          </div>
        </div>
      )}

      {/* Task Detail Dialog - Lifted to Root to persist across loading states */}
      {(selectedTaskId || taskIdParam) && (
        <TaskDetailDialog
          open={!!selectedTaskId || !!taskIdParam}
          onClose={handleCloseTaskDetail}
          taskId={selectedTaskId || taskIdParam}
          highlightCommentId={commentIdParam}
          key="global-task-dialog"
        />
      )}
    </>
  );
}

