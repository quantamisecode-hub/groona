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

  const health = selectedProject ? getHealthStatus(selectedProject) : { label: '--', color: 'slate' };
  const completedMilestones = selectedProject ? milestones.filter(m => m.status === 'completed').length : 0;
  const completedTasks = selectedProject ? tasks.filter(t => t.status === 'completed').length : 0;

  return (
    <div className="flex flex-col bg-[#f8f9fa] w-full min-h-screen relative overflow-x-hidden p-6 md:p-8 space-y-8">
      {/* Header Section */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-slate-900 tracking-tight">
          Welcome, {currentUser?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm sm:text-base text-slate-500 font-medium">
          Track your project progress and updates
        </p>
      </div>

      {/* Project Selector */}
      <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 hide-scrollbar">
        {projects.map(project => (
          <div
            key={project.id}
            className={`cursor-pointer transition-all min-w-[220px] p-5 rounded-[1.8rem] border duration-300 ${selectedProject?.id === project.id
              ? 'bg-blue-600 border-blue-600 shadow-[0_12px_24px_rgba(37,99,235,0.22)] text-white'
              : 'bg-white border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-lg hover:-translate-y-1'
              }`}
            onClick={() => setSelectedProject(project)}
          >
            <h3 className={`font-bold text-base mb-3 truncate ${selectedProject?.id === project.id ? 'text-white' : 'text-slate-900'}`} title={project.name}>
              {project.name}
            </h3>
            <div className="space-y-3">
              <Badge className={`${selectedProject?.id === project.id
                ? 'bg-white/20 text-white border-none'
                : 'bg-emerald-50 text-emerald-600 border-none'
                } rounded-md px-2 py-0.5 text-[10px] uppercase font-bold tracking-tight`}>
                {project.status || 'active'}
              </Badge>
              <div className="flex items-center gap-3">
                <div className={`flex-1 h-1 rounded-full overflow-hidden ${selectedProject?.id === project.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full ${selectedProject?.id === project.id ? 'bg-white' : 'bg-blue-600'}`}
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
                <span className={`text-[11px] font-black ${selectedProject?.id === project.id ? 'text-white' : 'text-slate-600'}`}>
                  {project.progress || 0}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProject && (
        <>
          {/* Project Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.8rem] transition-all duration-300">
              <CardContent className="p-7">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health</p>
                    <p className={`text-2xl font-black leading-tight ${health.color === 'red' ? 'text-rose-600' : health.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {health.label}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-rose-500 shadow-lg shadow-rose-500/30 flex items-center justify-center text-white">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.8rem] transition-all duration-300">
              <CardContent className="p-7">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                    <p className="text-3xl font-black text-slate-900 leading-tight">{selectedProject.progress || 0}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center justify-center text-white">
                    <Target className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-100 shadow-[0_4_20px_rgba(0,0,0,0.03)] rounded-[1.8rem] transition-all duration-300">
              <CardContent className="p-7">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Milestones</p>
                    <p className="text-3xl font-black text-slate-900 leading-tight">
                      {completedMilestones}/{milestones.length}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500 shadow-lg shadow-purple-500/30 flex items-center justify-center text-white">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.8rem] transition-all duration-300">
              <CardContent className="p-7">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasks</p>
                    <p className="text-3xl font-black text-slate-900 leading-tight">
                      {completedTasks}/{tasks.length}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white">
                    <FileText className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Views */}
          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] rounded-[2rem] overflow-hidden">
            <CardContent className="p-0">
              <Tabs defaultValue="overview" className="w-full">
                <div className="px-8 pt-8 pb-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FolderKanban className="h-4 w-4 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {selectedProject.name}
                    </h2>
                  </div>
                  <TabsList className="bg-slate-50/80 p-1 w-full justify-start overflow-x-auto rounded-xl flex gap-1 border border-slate-100/50 hide-scrollbar">
                    <TabsTrigger value="overview" className="flex items-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                      <TrendingUp className="h-3.5 w-3.5" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="sprints" className="flex items-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                      <Zap className="h-3.5 w-3.5" /> Sprints & Planning
                    </TabsTrigger>
                    <TabsTrigger value="milestones" className="flex items-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                      <Target className="h-3.5 w-3.5" /> Milestones
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex items-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                      <FileText className="h-3.5 w-3.5" /> Tasks Board
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="flex items-center gap-2 rounded-lg py-2.5 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all">
                      <CalendarIcon className="h-3.5 w-3.5" /> Timeline
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-6 md:p-8">
                  {/* Overview Content */}
                  <TabsContent value="overview" className="mt-0 focus-visible:outline-none space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                      <div className="lg:col-span-2 space-y-8">
                        <div>
                          <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-[0.15em]">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Project Scope
                          </h3>
                          <div className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-8">
                            <p className="text-slate-500 font-medium leading-relaxed text-sm">
                              {selectedProject.description || 'No description provided for this project.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <Card className="bg-white border border-slate-100/80 rounded-[1.5rem] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Start Date</p>
                            <p className="text-xl font-black text-slate-900">
                              {selectedProject.start_date
                                ? new Date(selectedProject.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                                : 'Not scheduled'}
                            </p>
                          </Card>
                          <Card className="bg-white border border-slate-100/80 rounded-[1.5rem] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target End Date</p>
                            <p className="text-xl font-black text-slate-900">
                              {selectedProject.deadline
                                ? new Date(selectedProject.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                                : 'Not set'}
                            </p>
                          </Card>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white rounded-[2rem] p-10 shadow-2xl shadow-blue-200/50 relative overflow-hidden h-full flex flex-col justify-center min-h-[300px]">
                          <div className="relative z-10">
                            <p className="text-blue-100 font-black uppercase tracking-[0.2em] text-[10px] mb-4">Overall Delivery</p>
                            <h4 className="text-6xl font-black mb-8 tracking-tighter">{selectedProject.progress || 0}%</h4>
                            <Progress value={selectedProject.progress || 0} className="h-2 bg-white/20" indicatorClassName="bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]" />
                            <p className="mt-8 text-xs font-medium text-blue-100/80 italic">Projected completion: {selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString() : 'TBD'}</p>
                          </div>
                          {/* Background Glow */}
                          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-white/10 rounded-full blur-[100px] opacity-40"></div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Sprints & Planning Content */}
                  <TabsContent value="sprints" className="mt-0 focus-visible:outline-none">
                    <div className="rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                            <TableHead className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Sprint Details</TableHead>
                            <TableHead className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Dates</TableHead>
                            <TableHead className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Status</TableHead>
                            <TableHead className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 w-[250px]">Progress</TableHead>
                            <TableHead className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Preview</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sprints.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                                <div className="flex flex-col items-center gap-2">
                                  <Zap className="h-8 w-8 opacity-20" />
                                  <p>No sprints scheduled for this project yet.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            sprints.map(sprint => {
                              const progress = getSprintProgress(sprint.id);
                              return (
                                <TableRow key={sprint.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 group">
                                  <TableCell className="py-5 px-6">
                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{sprint.name}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[250px] mt-1 font-medium">{sprint.goal}</div>
                                  </TableCell>
                                  <TableCell className="py-5 px-6">
                                    <div className="text-sm font-bold text-slate-900">
                                      {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : '-'}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                      TO {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-5 px-6">
                                    <Badge variant="outline" className={`
                                        rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider
                                        ${sprint.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        sprint.status === 'completed' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'}
                                      `}>
                                      {sprint.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-5 px-6">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        <span>{progress.completed} pts</span>
                                        <span>{Math.round(progress.percentage)}%</span>
                                      </div>
                                      <Progress value={progress.percentage} className="h-1.5 bg-slate-100" />
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-5 px-6 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-10 w-10 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 text-slate-400 transition-all border border-transparent hover:border-blue-100"
                                      onClick={() => setViewSprint(sprint)}
                                    >
                                      <Eye className="h-5 w-5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* Milestones Content */}
                  <TabsContent value="milestones" className="mt-0 focus-visible:outline-none space-y-4">
                    {milestones.length === 0 ? (
                      <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                        <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-slate-900">No Milestones Found</h4>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1 font-medium">Project deliverables and key milestones will appear here once defined.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {milestones.map(milestone => (
                          <div key={milestone.id} className="group relative bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-3">
                                <Badge className={`
                                    rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider
                                    ${milestone.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    milestone.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200'}
                                  `}>
                                  {milestone.status}
                                </Badge>
                                <div>
                                  <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{milestone.title}</h4>
                                  <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">{milestone.description}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 w-fit px-3 py-1.5 rounded-full">
                                  <CalendarIcon className="h-3 w-3" />
                                  {milestone.due_date ? new Date(milestone.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'}
                                </div>
                              </div>
                              <div className={`
                                  h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500
                                  ${milestone.status === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rotate-0' :
                                  milestone.status === 'in_progress' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}
                                `}>
                                {milestone.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> :
                                  milestone.status === 'in_progress' ? <Loader2 className="h-6 w-6 animate-spin" /> :
                                    <Target className="h-6 w-6" />}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tasks Board Content */}
                  <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
                    <div className="flex h-[calc(100vh-350px)] min-h-[600px] gap-6 overflow-x-auto pb-4 hide-scrollbar">
                      {KANBAN_COLUMNS.map(col => {
                        const colTasks = tasks.filter(t => t.status === col.id);
                        return (
                          <div key={col.id} className="w-80 flex-shrink-0 flex flex-col bg-slate-50/50 rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
                            <div className="p-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${col.id === 'completed' ? 'bg-emerald-500' : col.id === 'in_progress' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                <span className="font-bold text-slate-900 text-sm tracking-tight capitalize">{col.title}</span>
                              </div>
                              <Badge variant="secondary" className="text-[10px] font-bold bg-slate-100 text-slate-500 rounded-lg px-2 py-0.5">
                                {colTasks.length}
                              </Badge>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 scroll-smooth hide-scrollbar">
                              {colTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs border border-dashed border-slate-200/60 rounded-2xl bg-white/30 gap-2">
                                  <p className="font-medium">All clear here</p>
                                </div>
                              ) : (
                                colTasks.map(task => (
                                  <div key={task.id} className="hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                                    <TaskCard task={task} allTasks={tasks} />
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </TabsContent>

                  {/* Timeline Content */}
                  <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
                    <div className="space-y-12 py-8 px-4">
                      {milestones.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                          <CalendarIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                          <h4 className="text-lg font-bold text-slate-900">No Timeline Data</h4>
                          <p className="text-slate-500 max-w-xs mx-auto mt-1 font-medium">Milestones will appear on the timeline as they are scheduled.</p>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Main line */}
                          <div className="absolute left-[19px] top-6 bottom-0 w-[2px] bg-slate-100 hidden md:block"></div>

                          {milestones.map((milestone, idx) => (
                            <div key={milestone.id} className="relative md:pl-16 pb-12 last:pb-0">
                              {/* Dot - Updated style */}
                              <div className={`
                                  absolute left-0 top-1 w-10 h-10 rounded-2xl flex items-center justify-center z-10 hidden md:flex transition-all duration-500
                                  ${milestone.status === 'completed' ? 'bg-emerald-500' : milestone.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-200'}
                                `}>
                                <div className="h-4 w-4 rounded-full border-2 border-white/50" />
                              </div>

                              <div className="group bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className={`
                                          rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider
                                          ${milestone.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                          milestone.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600'}
                                        `}>
                                        {milestone.status}
                                      </Badge>
                                      <span className="text-xs font-bold text-slate-400 capitalize">{milestone.due_date ? new Date(milestone.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Future'}</span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{milestone.title}</h4>
                                    <p className="text-slate-500 font-medium leading-relaxed max-w-2xl">{milestone.description}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Date</p>
                                    <p className="text-lg font-black text-slate-900">
                                      {milestone.due_date
                                        ? new Date(milestone.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : 'PENDING'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>


                </div>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )
      }

      {/* SPRINT DETAILS DIALOG */}
      <Dialog open={!!viewSprint} onOpenChange={() => setViewSprint(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-[#f8f9fa]">
          <div className="flex flex-col h-full bg-[#f8f9fa]">
            {/* Header Area */}
            <div className="bg-white px-8 md:px-12 py-10 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{viewSprint?.name || 'Sprint Details'}</h2>
                    {viewSprint?.status && (
                      <Badge className={`
                          rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider
                          ${viewSprint.status === 'active' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                          viewSprint.status === 'completed' ? 'bg-slate-900 text-white' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'}
                        `}>
                        {viewSprint.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-500 font-medium max-w-2xl">{viewSprint?.goal || 'No sprint goal defined for this cycle.'}</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="text-center px-4 border-r border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Start</p>
                    <p className="text-sm font-bold text-slate-900">{viewSprint?.start_date ? new Date(viewSprint.start_date).toLocaleDateString() : 'TBD'}</p>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">End</p>
                    <p className="text-sm font-bold text-slate-900">{viewSprint?.end_date ? new Date(viewSprint.end_date).toLocaleDateString() : 'TBD'}</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar in Header */}
              <div className="mt-8">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Velocity Status</span>
                  <span className="text-blue-600">
                    {getSprintProgress(viewSprint?.id || '').completed} / {getSprintProgress(viewSprint?.id || '').total} points delivered
                  </span>
                </div>
                <Progress value={getSprintProgress(viewSprint?.id || '').percentage} className="h-2 bg-slate-100" indicatorClassName="bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12">
              <Tabs defaultValue="burndown" className="w-full space-y-8">
                <TabsList className="bg-slate-100/80 p-1 w-fit rounded-xl flex gap-1 mb-8">
                  <TabsTrigger value="burndown" className="flex items-center gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <TrendingUp className="h-4 w-4" /> Burndown
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="flex items-center gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <BarChart3 className="h-4 w-4" /> Metrics
                  </TabsTrigger>
                  <TabsTrigger value="velocity" className="flex items-center gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Zap className="h-4 w-4" /> Velocity
                  </TabsTrigger>
                  <TabsTrigger value="changes" className="flex items-center gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <History className="h-4 w-4" /> Changes
                  </TabsTrigger>
                </TabsList>

                <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                  <TabsContent value="burndown" className="mt-0 focus-visible:outline-none h-[400px]">
                    {viewSprint && (
                      <SprintBurndown
                        sprint={viewSprint}
                        tasks={tasks.filter(t => t.sprint_id === viewSprint.id)}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="metrics" className="mt-0 focus-visible:outline-none">
                    {viewSprint && selectedProject && (
                      <SprintMetrics
                        sprint={viewSprint}
                        tasks={tasks.filter(t => t.sprint_id === viewSprint.id)}
                        projectId={selectedProject.id}
                        hideAI={true}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="velocity" className="mt-0 focus-visible:outline-none">
                    <VelocityTracker
                      sprints={sprints}
                      allTasks={tasks}
                    />
                  </TabsContent>

                  <TabsContent value="changes" className="mt-0 focus-visible:outline-none">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Scope Change Control</h3>
                        <p className="text-sm text-slate-500 font-medium">Tracking all approved and requested changes for this sprint cycle.</p>
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 font-bold">
                        {changeRequests.length} changes detected
                      </Badge>
                    </div>
                    {viewSprint && (
                      <ChangeLogView
                        logs={changeLogs}
                        requests={changeRequests}
                        isLocked={!!viewSprint.locked_date}
                        onRequestChange={() => setShowRequestDialog(true)}
                        currentUser={currentUser}
                      />
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
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
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea
                placeholder="Describe the required changes..."
                rows={4}
                value={requestForm.description}
                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
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

