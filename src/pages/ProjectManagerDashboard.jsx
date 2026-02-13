import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FolderKanban, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  Users,
  Calendar,
  Target,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectCard from "../components/projects/ProjectCard";

export default function ProjectManagerDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  // Fetch projects where user is assigned as Project Manager
  const { data: projectRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['project-manager-roles', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      tenant_id: effectiveTenantId,
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !!effectiveTenantId,
  });

  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: () => groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }),
    enabled: !!effectiveTenantId,
  });

  // Filter projects where user is PM
  const managedProjects = allProjects.filter(project => 
    projectRoles.some(role => role.project_id === project.id)
  );

  // Fetch tasks for managed projects
  const { data: allTasks = [] } = useQuery({
    queryKey: ['pm-tasks', managedProjects.map(p => p.id)],
    queryFn: async () => {
      if (managedProjects.length === 0) return [];
      const taskPromises = managedProjects.map(p => 
        groonabackend.entities.Task.filter({ project_id: p.id })
      );
      const results = await Promise.all(taskPromises);
      return results.flat();
    },
    enabled: managedProjects.length > 0,
  });

  // Fetch expenses for managed projects
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['pm-expenses', managedProjects.map(p => p.id)],
    queryFn: async () => {
      if (managedProjects.length === 0) return [];
      const expensePromises = managedProjects.map(p => 
        groonabackend.entities.ProjectExpense.filter({ project_id: p.id })
      );
      const results = await Promise.all(expensePromises);
      return results.flat();
    },
    enabled: managedProjects.length > 0,
  });

  // Calculate metrics
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;
  const overdueTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'completed') return false;
    return new Date(t.due_date) < new Date();
  }).length;
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;

  // Calculate project health with AI scoring
  const projectHealthScores = managedProjects.map(project => {
    const projectTasks = allTasks.filter(t => t.project_id === project.id);
    const completed = projectTasks.filter(t => t.status === 'completed').length;
    const total = projectTasks.length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    // Budget health
    const projectExpenses = allExpenses.filter(e => e.project_id === project.id && e.status === 'approved');
    const totalSpent = projectExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const budget = project.budget || project.budget_amount || 0;
    const budgetUsage = budget > 0 ? (totalSpent / budget) * 100 : 0;
    
    // AI Health Score calculation (0-100)
    let healthScore = 100;
    
    // Task completion impact (40% weight)
    healthScore -= (100 - completionRate) * 0.4;
    
    // Budget adherence impact (30% weight)
    if (budgetUsage > 100) {
      healthScore -= (budgetUsage - 100) * 0.3; // Overrun penalty
    } else if (budgetUsage > 90) {
      healthScore -= 10; // Near budget limit
    }
    
    // Schedule impact (30% weight)
    if (project.deadline) {
      const daysUntilDeadline = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 0) {
        healthScore -= 30; // Overdue
      } else if (daysUntilDeadline < 7 && completionRate < 90) {
        healthScore -= 15; // Close to deadline but not near completion
      }
    }
    
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    let health = 'good';
    if (healthScore < 50) health = 'at_risk';
    else if (healthScore < 75) health = 'attention';
    
    return { 
      project, 
      health, 
      completionRate, 
      budgetUsage,
      totalSpent,
      healthScore: Math.round(healthScore)
    };
  });

  const atRiskProjects = projectHealthScores.filter(p => p.health === 'at_risk').length;

  const isLoading = rolesLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-32 bg-white/60 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-white/60 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
          Project Manager Dashboard
        </h1>
        <p className="text-slate-600">
          Manage and monitor your {managedProjects.length} assigned {managedProjects.length === 1 ? 'project' : 'projects'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">Total Projects</p>
                <p className="text-3xl font-bold text-blue-900">{managedProjects.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium mb-1">Tasks Completed</p>
                <p className="text-3xl font-bold text-green-900">
                  {completedTasks}/{totalTasks}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium mb-1">In Progress</p>
                <p className="text-3xl font-bold text-amber-900">{inProgressTasks}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium mb-1">At Risk</p>
                <p className="text-3xl font-bold text-red-900">{atRiskProjects}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-500 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Project Health Overview */}
      {projectHealthScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              AI Project Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectHealthScores.map(({ project, health, completionRate, budgetUsage, totalSpent, healthScore }) => (
                <div key={project.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-slate-900">{project.name}</h4>
                      <div className={`px-3 py-1 rounded-full font-bold text-lg ${
                        healthScore >= 75 ? 'bg-green-100 text-green-800' :
                        healthScore >= 50 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {healthScore}/100
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge className={
                        health === 'good' ? 'bg-green-100 text-green-800' :
                        health === 'attention' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }>
                        {health === 'good' ? 'On Track' : health === 'attention' ? 'Needs Attention' : 'At Risk'}
                      </Badge>
                      <span className="text-slate-600">
                        {completionRate.toFixed(0)}% Complete
                      </span>
                      {(project.budget || project.budget_amount) && (
                        <span className={`${budgetUsage > 90 ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                          Budget: {budgetUsage.toFixed(0)}% used
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`${createPageUrl("ProjectDetail")}?id=${project.id}`)}
                  >
                    View <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Managed Projects */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Projects</h2>
        {managedProjects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderKanban className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No projects assigned yet</p>
              <p className="text-sm text-slate-500">Contact your tenant admin to be assigned as a Project Manager</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {managedProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

