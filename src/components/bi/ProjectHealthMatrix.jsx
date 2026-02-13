import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  DollarSign,
  Calendar,
  Search,
  ArrowUpDown
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ProjectHealthMatrix({ projects, tasks, activities }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("health_score");
  const [sortDirection, setSortDirection] = useState("desc");

  // Calculate health score for each project
  const calculateHealthScore = (project) => {
    let score = 70; // Base score

    // Progress contribution (30 points)
    score += (project.progress || 0) * 0.3;

    // Task completion rate (20 points)
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
    const taskCompletionRate = projectTasks.length > 0 ? completedTasks / projectTasks.length : 0;
    score += taskCompletionRate * 20;

    // Deadline check (deduct up to 20 points if overdue)
    if (project.deadline) {
      const daysUntilDeadline = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 0) score -= 20; // Overdue
      else if (daysUntilDeadline < 7) score -= 10; // Close to deadline
    }

    // Status check
    if (project.status === 'on_hold') score -= 15;
    if (project.status === 'completed') score = 100;

    // Risk level
    if (project.risk_level === 'critical') score -= 20;
    else if (project.risk_level === 'high') score -= 15;
    else if (project.risk_level === 'medium') score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  // Calculate budget health
  const calculateBudgetHealth = (project) => {
    if (!project.budget || !project.actual_cost) return { status: 'unknown', variance: 0 };
    
    const variance = ((project.actual_cost - project.budget) / project.budget) * 100;
    let status = 'good';
    
    if (variance > 20) status = 'critical';
    else if (variance > 10) status = 'warning';
    else if (variance > 0) status = 'caution';
    
    return { status, variance: variance.toFixed(1) };
  };

  // Enhance projects with health metrics
  const enhancedProjects = projects.map(project => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
    const overdueTasks = projectTasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      t.status !== 'completed'
    ).length;
    
    const healthScore = calculateHealthScore(project);
    const budgetHealth = calculateBudgetHealth(project);
    
    return {
      ...project,
      healthScore,
      budgetHealth,
      totalTasks: projectTasks.length,
      completedTasks,
      overdueTasks,
      taskCompletionRate: projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0,
    };
  });

  // Filter and sort
  const filteredProjects = enhancedProjects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return (a[sortField] > b[sortField] ? 1 : -1) * multiplier;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getHealthBadge = (score) => {
    if (score >= 80) return <Badge className="bg-emerald-500">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-blue-500">Good</Badge>;
    if (score >= 40) return <Badge className="bg-amber-500">Fair</Badge>;
    return <Badge className="bg-red-500">At Risk</Badge>;
  };

  const getBudgetBadge = (budgetHealth) => {
    if (budgetHealth.status === 'unknown') return <Badge variant="outline">N/A</Badge>;
    if (budgetHealth.status === 'good') return <Badge className="bg-emerald-500">On Budget</Badge>;
    if (budgetHealth.status === 'caution') return <Badge className="bg-blue-500">Within Range</Badge>;
    if (budgetHealth.status === 'warning') return <Badge className="bg-amber-500">Over Budget</Badge>;
    return <Badge className="bg-red-500">Critical</Badge>;
  };

  // Calculate summary stats
  const criticalProjects = enhancedProjects.filter(p => p.healthScore < 40).length;
  const atRiskProjects = enhancedProjects.filter(p => p.healthScore >= 40 && p.healthScore < 60).length;
  const healthyProjects = enhancedProjects.filter(p => p.healthScore >= 80).length;
  const budgetIssues = enhancedProjects.filter(p => 
    p.budgetHealth.status === 'warning' || p.budgetHealth.status === 'critical'
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Healthy Projects</p>
                <p className="text-3xl font-bold text-emerald-600">{healthyProjects}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-emerald-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">At Risk</p>
                <p className="text-3xl font-bold text-amber-600">{atRiskProjects}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-amber-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Critical</p>
                <p className="text-3xl font-bold text-red-600">{criticalProjects}</p>
              </div>
              <TrendingDown className="h-10 w-10 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Budget Issues</p>
                <p className="text-3xl font-bold text-orange-600">{budgetIssues}</p>
              </div>
              <DollarSign className="h-10 w-10 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Health Table */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Project Health Matrix
            </CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('name')} className="flex items-center gap-1">
                      Project Name
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('healthScore')} className="flex items-center gap-1">
                      Health Score
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('taskCompletionRate')} className="flex items-center gap-1">
                      Task Progress
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{project.healthScore}</span>
                          {getHealthBadge(project.healthScore)}
                        </div>
                        <Progress value={project.healthScore} className="h-2 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{project.taskCompletionRate}%</span>
                          <span className="text-slate-500">
                            ({project.completedTasks}/{project.totalTasks})
                          </span>
                        </div>
                        <Progress value={project.taskCompletionRate} className="h-1.5 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      {getBudgetBadge(project.budgetHealth)}
                      {project.budgetHealth.status !== 'unknown' && (
                        <p className="text-xs text-slate-500 mt-1">
                          {project.budgetHealth.variance > 0 ? '+' : ''}{project.budgetHealth.variance}%
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {project.overdueTasks > 0 ? (
                        <Badge variant="destructive">{project.overdueTasks} overdue</Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {project.deadline ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(project.deadline).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">No deadline</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No projects found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
