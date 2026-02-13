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
  FileText,
  Sparkles
} from "lucide-react";
import { useUser } from "../components/shared/UserContext"; // Import UserContext
import RiskAssessment from "../components/insights/RiskAssessment";
import TimelinePrediction from "../components/insights/TimelinePrediction";
import ProjectReport from "../components/insights/ProjectReport";
import AskAIInsights from "../components/insights/AskAIInsights";

export default function ProjectInsights() {
  const { user: currentUser, effectiveTenantId } = useUser();
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

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
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Project.list('-updated_date');
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000, // Added to match Dashboard
  });

  // 3. Fetch Tasks scoped to Tenant (Matches Dashboard Logic & StaleTime)
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Task.list('-updated_date');
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000, // Added to match Dashboard
  });

  // 4. Fetch Activities scoped to Tenant
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

  const selectedProject = accessibleProjects.find(p => p.id === selectedProjectId);
  const selectedProjectTasks = accessibleTasks.filter(t => t.project_id === selectedProjectId);

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

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-slate-900">Active Projects</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {accessibleProjects.filter(p => p.status === 'active').length}
          </p>
        </Card>

        <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-900">At Risk</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {accessibleProjects.filter(p => {
              const deadline = p.deadline ? new Date(p.deadline) : null;
              return deadline && deadline < new Date() && p.status !== 'completed';
            }).length}
          </p>
        </Card>

        <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Pending Tasks</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {/* Using 'todo' status to match Dashboard Pending count */}
            {accessibleTasks.filter(t => t.status === 'todo').length}
          </p>
        </Card>

        <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900">Completed</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {accessibleTasks.filter(t => t.status === 'completed').length}
          </p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/60 backdrop-blur-xl border border-slate-200/60">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
          <TabsTrigger value="timeline">Timeline Prediction</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="ai">Ask AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Select a Project</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accessibleProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${selectedProjectId === project.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <h3 className="font-semibold text-slate-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-slate-600 capitalize">{project.status}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    Progress: {project.progress || 0}%
                  </div>
                </button>
              ))}
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
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Select a Project for Risk Assessment</h2>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200"
            >
              <option value="">Choose a project...</option>
              {accessibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Card>

          {selectedProject && (
            <RiskAssessment
              project={selectedProject}
              tasks={selectedProjectTasks}
            />
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Select a Project for Timeline Prediction</h2>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200"
            >
              <option value="">Choose a project...</option>
              {accessibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
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
          <Card className="p-6 bg-white/60 backdrop-blur-xl border-slate-200/60">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Select a Project for Report</h2>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200"
            >
              <option value="">Choose a project...</option>
              {accessibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Card>

          {selectedProject && (
            <ProjectReport
              project={selectedProject}
              tasks={selectedProjectTasks}
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
    </div>
  );
}

