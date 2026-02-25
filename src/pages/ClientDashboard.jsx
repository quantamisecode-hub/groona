import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  FolderKanban, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Target,
  FileText,
  Eye,
  Calendar as CalendarIcon,
  Zap,
  BarChart3,
  History,
  Loader2,
  MessageSquarePlus
} from "lucide-react";
import { useUser } from "../components/shared/UserContext";
import TaskCard from "../components/shared/TaskCard";

// Import Sprint Components
import SprintBurndown from "../components/sprint/SprintBurndown";
import SprintMetrics from "../components/sprint/SprintMetrics";
import VelocityTracker from "../components/sprint/VelocityTracker";
import ChangeLogView from "../components/sprint/ChangeLogView";

// Define the standard columns for the read-only board
const KANBAN_COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "completed", title: "Done" },
];

export default function ClientDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, effectiveTenantId } = useUser();
  const [selectedProject, setSelectedProject] = useState(null);
  const [viewSprint, setViewSprint] = useState(null);
  
  // Dialog State for Change Requests
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", description: "" });

  // Redirect if not a client
  React.useEffect(() => {
    if (currentUser && currentUser.custom_role !== 'client') {
      navigate(createPageUrl("Dashboard"));
    }
  }, [currentUser, navigate]);

  // Fetch client's assigned projects
  const { data: projectAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['client-projects', currentUser?.id],
    queryFn: async () => {
      const assignments = await groonabackend.entities.ProjectClient.filter({
        client_user_id: currentUser.id,
        revoked: false
      });
      return assignments;
    },
    enabled: !!currentUser,
  });

  // Fetch project details
  const { data: projects = [] } = useQuery({
    queryKey: ['client-project-details', projectAssignments],
    queryFn: async () => {
      const projectIds = projectAssignments.map(a => a.project_id);
      if (projectIds.length === 0) return [];
      
      const allProjects = await groonabackend.entities.Project.filter({
        tenant_id: effectiveTenantId
      });
      
      return allProjects.filter(p => projectIds.includes(p.id));
    },
    enabled: projectAssignments.length > 0,
  });

  // Fetch milestones for selected project
  const { data: milestones = [] } = useQuery({
    queryKey: ['client-milestones', selectedProject?.id],
    queryFn: () => groonabackend.entities.Milestone.filter({
      project_id: selectedProject.id
    }, '-due_date'),
    enabled: !!selectedProject,
  });

  // Fetch tasks for selected project
  const { data: tasks = [] } = useQuery({
    queryKey: ['client-tasks', selectedProject?.id],
    queryFn: () => groonabackend.entities.Task.filter({
      project_id: selectedProject.id
    }, '-due_date'),
    enabled: !!selectedProject,
  });

  // Fetch Sprints for selected project
  const { data: sprints = [] } = useQuery({
    queryKey: ['client-sprints', selectedProject?.id],
    queryFn: () => groonabackend.entities.Sprint.filter({
      project_id: selectedProject.id
    }, '-start_date'),
    enabled: !!selectedProject,
  });

  // NEW: Fetch Real Change Logs (Updated to use ChangeLog entity)
  const { data: changeLogs = [] } = useQuery({
    queryKey: ['changeLogs', viewSprint?.id],
    queryFn: () => groonabackend.entities.ChangeLog.filter({ sprint_id: viewSprint.id }, '-timestamp'),
    enabled: !!viewSprint,
  });

  // NEW: Fetch Tasks marked as 'Scope Change' for this sprint
  const { data: changeRequests = [] } = useQuery({
    queryKey: ['changeRequests', viewSprint?.id],
    queryFn: async () => {
       const sprintTasks = await groonabackend.entities.Task.filter({ sprint_id: viewSprint.id, project_id: selectedProject.id });
       return sprintTasks.filter(t => t.labels && t.labels.includes('Scope Change'));
    },
    enabled: !!viewSprint && !!selectedProject
  });

  // NEW: Mutation to Create Change Request Task
  const createChangeRequestMutation = useMutation({
    mutationFn: async (data) => {
       return await groonabackend.entities.Task.create({
        tenant_id: currentUser?.tenant_id,
        project_id: selectedProject.id,
        sprint_id: viewSprint.id,
        title: `Change Request: ${data.title}`,
        description: data.description,
        task_type: 'story',
        status: 'todo',
        priority: 'high',
        labels: ['Scope Change'],
        reporter: currentUser?.email,
        assigned_to: [] 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeRequests', viewSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] }); 
      toast.success("Request submitted successfully");
      setShowRequestDialog(false);
      setRequestForm({ title: "", description: "" });
    },
    onError: (err) => toast.error("Failed to submit request: " + err.message)
  });

  const handleSubmitRequest = () => {
    if (!requestForm.title || !requestForm.description) {
      toast.error("Please fill in title and description");
      return;
    }
    createChangeRequestMutation.mutate(requestForm);
  };

  // Helper: Calculate Sprint Progress
  const getSprintProgress = (sprintId) => {
    const sprintTasks = tasks.filter(t => t.sprint_id === sprintId);
    const total = sprintTasks.reduce((acc, t) => acc + (t.story_points || 0), 0);
    const completed = sprintTasks
      .filter(t => t.status === 'completed')
      .reduce((acc, t) => acc + (t.story_points || 0), 0);
    return { total, completed, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };

  // Auto-select first project
  React.useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject]);

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-100',
      planning: 'text-blue-600 bg-blue-100',
      on_hold: 'text-amber-600 bg-amber-100',
      completed: 'text-slate-600 bg-slate-100',
      cancelled: 'text-red-600 bg-red-100',
    };
    return colors[status] || 'text-slate-600 bg-slate-100';
  };

  const getHealthStatus = (project) => {
    if (project.status === 'completed') return { label: 'Completed', color: 'green' };
    if (project.progress >= 75) return { label: 'On Track', color: 'green' };
    if (project.progress >= 50) return { label: 'At Risk', color: 'amber' };
    return { label: 'Delayed', color: 'red' };
  };

  if (assignmentsLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FolderKanban className="h-12 w-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FolderKanban className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Projects Assigned</h2>
            <p className="text-slate-600">
              You haven't been assigned to any projects yet. Please contact your project manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const health = selectedProject ? getHealthStatus(selectedProject) : null;
  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome, {currentUser?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-slate-600">Track your project progress and updates</p>
      </div>

      {/* Project Selector */}
      <div className="flex gap-3 overflow-x-auto pb-4 p-2">
        {projects.map(project => (
          <Card
            key={project.id}
            className={`cursor-pointer transition-all min-w-[280px] ${
              selectedProject?.id === project.id
                ? 'ring-2 ring-blue-500 bg-blue-50/50'
                : 'hover:shadow-md'
            }`}
            onClick={() => setSelectedProject(project)}
          >
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-2 truncate" title={project.name}>{project.name}</h3>
              <div className="flex items-center justify-between gap-2 mt-4">
                <Badge className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
                <span className="text-sm font-medium text-slate-600">{project.progress || 0}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedProject && (
        <>
          {/* Project Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${health.color}-100`}>
                    <TrendingUp className={`h-5 w-5 text-${health.color}-600`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Health</p>
                    <p className={`font-semibold text-${health.color}-600`}>{health.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Progress</p>
                    <p className="font-semibold text-slate-900">{selectedProject.progress || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Milestones</p>
                    <p className="font-semibold text-slate-900">
                      {completedMilestones}/{milestones.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Tasks</p>
                    <p className="font-semibold text-slate-900">
                      {completedTasks}/{tasks.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Views */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedProject.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full h-auto gap-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="sprints">Sprints & Planning</TabsTrigger> 
                  <TabsTrigger value="milestones">Milestones</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks Board</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                {/* Overview Content */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Project Details</h3>
                      <p className="text-slate-600">{selectedProject.description || 'No description provided'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Start Date</p>
                        <p className="font-medium">
                          {selectedProject.start_date 
                            ? new Date(selectedProject.start_date).toLocaleDateString() 
                            : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">End Date</p>
                        <p className="font-medium">
                          {selectedProject.deadline 
                            ? new Date(selectedProject.deadline).toLocaleDateString() 
                            : 'Not set'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600 mb-2">Overall Progress</p>
                      <Progress value={selectedProject.progress || 0} className="h-3" />
                    </div>
                  </div>
                </TabsContent>

                {/* Sprints & Planning Content */}
                <TabsContent value="sprints" className="mt-4">
                    <Card className="border-0 shadow-none">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Sprint Name</TableHead>
                              <TableHead>Dates</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-[200px]">Completion Progress</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sprints.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                  No sprints found for this project.
                                </TableCell>
                              </TableRow>
                            ) : (
                              sprints.map(sprint => {
                                const progress = getSprintProgress(sprint.id);
                                return (
                                  <TableRow key={sprint.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium">
                                      {sprint.name}
                                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{sprint.goal}</div>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                      {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : '-'} 
                                      {' → '}
                                      {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={`
                                        ${sprint.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 
                                          sprint.status === 'completed' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}
                                      `}>
                                        {sprint.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-600">
                                          <span>{progress.completed} pts done</span>
                                          <span>{progress.total} pts total</span>
                                        </div>
                                        <Progress value={progress.percentage} className="h-2" />
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="gap-2"
                                        onClick={() => setViewSprint(sprint)}
                                      >
                                        <Eye className="h-4 w-4" /> View
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                </TabsContent>

                {/* Milestones Content */}
                <TabsContent value="milestones" className="space-y-3 mt-4">
                  {milestones.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No milestones defined yet</p>
                  ) : (
                    milestones.map(milestone => (
                      <Card key={milestone.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900">{milestone.title}</h4>
                              <p className="text-sm text-slate-600 mt-1">{milestone.description}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <Badge className={
                                  milestone.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  milestone.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-slate-100 text-slate-800'
                                }>
                                  {milestone.status}
                                </Badge>
                                {milestone.due_date && (
                                  <span className="text-sm text-slate-600">
                                    Due: {new Date(milestone.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {milestone.status === 'completed' ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            ) : milestone.status === 'in_progress' ? (
                              <Clock className="h-6 w-6 text-blue-600" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-slate-400" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* Tasks Board Content */}
                <TabsContent value="tasks" className="mt-4">
                  <div className="flex h-[calc(100vh-300px)] min-h-[500px] gap-4 overflow-x-auto pb-4">
                    {KANBAN_COLUMNS.map(col => {
                      const colTasks = tasks.filter(t => t.status === col.id);
                      return (
                         <div key={col.id} className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200/50 shadow-sm">
                           <div className="p-3 font-semibold text-slate-700 border-b border-slate-200 flex items-center justify-between bg-white/50 rounded-t-xl backdrop-blur-sm">
                              <span>{col.title}</span>
                              <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-700">
                                {colTasks.length}
                              </Badge>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
                              {colTasks.map(task => (
                                <div key={task.id} className="hover:scale-[1.02] transition-transform duration-200">
                                   <TaskCard task={task} allTasks={tasks} />
                                </div>
                              ))}
                              
                              {colTasks.length === 0 && (
                                 <div className="flex items-center justify-center h-24 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                   No tasks
                                 </div>
                              )}
                           </div>
                         </div>
                      )
                    })}
                  </div>
                </TabsContent>

                {/* Timeline Content */}
                <TabsContent value="timeline" className="mt-4">
                  <div className="space-y-6">
                    {milestones.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No timeline data available</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                        {milestones.map((milestone, idx) => (
                          <div key={milestone.id} className="relative pl-12 pb-8">
                            <div className={`absolute left-2 w-4 h-4 rounded-full ${
                              milestone.status === 'completed' ? 'bg-green-500' :
                              milestone.status === 'in_progress' ? 'bg-blue-500' :
                              'bg-slate-300'
                            }`}></div>
                            <Card>
                              <CardContent className="pt-4">
                                <h4 className="font-semibold text-slate-900">{milestone.title}</h4>
                                <p className="text-sm text-slate-600 mt-1">
                                  {milestone.due_date 
                                    ? new Date(milestone.due_date).toLocaleDateString() 
                                    : 'No date set'}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* SPRINT DETAILS DIALOG */}
      <Dialog open={!!viewSprint} onOpenChange={() => setViewSprint(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              {viewSprint?.name}
              <Badge variant="outline">{viewSprint?.status}</Badge>
            </DialogTitle>
            <p className="text-slate-500">{viewSprint?.goal || 'No sprint goal set.'}</p>
          </DialogHeader>

          {viewSprint && (
            <div className="space-y-6 mt-4">
              {/* Top Status Bar */}
              <Card className="bg-slate-50 border-dashed">
                <CardContent className="py-4 flex flex-col md:flex-row gap-6 items-center justify-between">
                  <div className="w-full">
                     <div className="flex justify-between text-sm font-medium mb-2">
                        <span>Sprint Completion Status</span>
                        <span className="text-blue-600">
                          {getSprintProgress(viewSprint.id).completed} / {getSprintProgress(viewSprint.id).total} pts
                        </span>
                     </div>
                     <Progress value={getSprintProgress(viewSprint.id).percentage} className="h-3" />
                  </div>
                  <div className="flex gap-4 text-sm whitespace-nowrap">
                     <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4 text-slate-400" />
                        <span>{new Date(viewSprint.start_date).toLocaleDateString()}</span>
                     </div>
                     <span className="text-slate-300">|</span>
                     <div className="flex items-center gap-1.5">
                        <Target className="h-4 w-4 text-slate-400" />
                        <span>{new Date(viewSprint.end_date).toLocaleDateString()}</span>
                     </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detail Tabs */}
              <Tabs defaultValue="burndown" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                  <TabsTrigger 
                    value="burndown" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-0 py-2"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" /> Burndown
                  </TabsTrigger>
                  <TabsTrigger 
                    value="metrics" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-0 py-2"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" /> Metrics
                  </TabsTrigger>
                  <TabsTrigger 
                    value="velocity" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-0 py-2"
                  >
                    <Zap className="h-4 w-4 mr-2" /> Velocity
                  </TabsTrigger>
                  <TabsTrigger 
                    value="changes" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-0 py-2"
                  >
                    <History className="h-4 w-4 mr-2" /> Changes Log
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="burndown" className="pt-4 h-[400px]">
                   <SprintBurndown 
                      sprint={viewSprint} 
                      tasks={tasks.filter(t => t.sprint_id === viewSprint.id)} 
                   />
                </TabsContent>

                <TabsContent value="metrics" className="pt-4">
                   <SprintMetrics 
                      sprint={viewSprint} 
                      tasks={tasks.filter(t => t.sprint_id === viewSprint.id)} 
                      projectId={selectedProject.id}
                      hideAI={true} // Hide AI Insights for clients
                   />
                </TabsContent>

                <TabsContent value="velocity" className="pt-4">
                   <VelocityTracker 
                      sprints={sprints} 
                      allTasks={tasks} 
                   />
                </TabsContent>

                {/* UPDATED: Change Log with Requests */}
                <TabsContent value="changes" className="pt-4">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-800">Scope Change History</h3>
                      {/* FIXED: Show count of change requests instead of logs */}
                      <Badge variant="outline">{changeRequests.length} changes detected</Badge>
                   </div>
                   <ChangeLogView 
                      logs={changeLogs} 
                      requests={changeRequests}
                      isLocked={!!viewSprint.locked_date}
                      onRequestChange={() => setShowRequestDialog(true)}
                      currentUser={currentUser}
                   />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* NEW: Change Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Scope Change</DialogTitle>
            <DialogDescription>
              Submit a request for changes in this sprint. The team will review and update the status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Request Title</Label>
              <Input 
                placeholder="e.g. Update button color, Change text copy..." 
                value={requestForm.title}
                onChange={(e) => setRequestForm({...requestForm, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea 
                placeholder="Describe the required changes..." 
                rows={4}
                value={requestForm.description}
                onChange={(e) => setRequestForm({...requestForm, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={createChangeRequestMutation.isPending}>
              {createChangeRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

