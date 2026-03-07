import React, { useState, useEffect, useRef } from "react";
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
  const [sortField, setSortField] = useState("healthScore");
  const [sortDirection, setSortDirection] = useState("desc");
  const projectRefs = useRef({});

  // Effect to handle deeplinking/scrolling to a specific project if highlightId is provided
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlightId');

    if (highlightId && projectRefs.current[highlightId]) {
      setTimeout(() => {
        projectRefs.current[highlightId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [projects]);

  // Get health score for each project from backend calculation
  const getHealthScore = (project) => {
    return (project.health_score !== undefined && project.health_score !== null) ? project.health_score : null;
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
    const projectTasks = tasks.filter(t => t.project_id === (project.id || project._id));
    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
    const overdueTasks = projectTasks.filter(t =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'completed'
    ).length;

    const healthScore = getHealthScore(project);
    const budgetHealth = calculateBudgetHealth(project);

    return {
      ...project,
      healthScore,
      budgetHealth,
      totalTasks: projectTasks.length,
      completedTasks,
      overdueTasks,
      taskCompletionRate: projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : (project.progress || 0),
    };
  });

  const getHealthBadge = (score) => {
    if (score === null) return <Badge variant="outline" className="bg-slate-50 text-slate-400">No Data</Badge>;
    if (score >= 85) return <Badge className="bg-emerald-500">Low Risk</Badge>;
    if (score >= 70) return <Badge className="bg-blue-500">Medium Risk</Badge>;
    if (score >= 50) return <Badge className="bg-amber-500">High Risk</Badge>;
    return <Badge className="bg-red-500">Critical</Badge>;
  };

  const getBudgetBadge = (budgetHealth) => {
    if (budgetHealth.status === 'unknown') return <Badge variant="outline">N/A</Badge>;
    if (budgetHealth.status === 'good') return <Badge className="bg-emerald-500">On Budget</Badge>;
    if (budgetHealth.status === 'caution') return <Badge className="bg-blue-500">Within Range</Badge>;
    if (budgetHealth.status === 'warning') return <Badge className="bg-amber-500">Over Budget</Badge>;
    return <Badge className="bg-red-500">Critical</Badge>;
  };

  // Filter and sort
  const filteredProjects = enhancedProjects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      const valA = a[sortField];
      const valB = b[sortField];
      return (valA > valB ? 1 : -1) * multiplier;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Calculate summary stats
  const criticalProjects = enhancedProjects.filter(p => p.healthScore !== null && p.healthScore < 50).length;
  const highRiskProjects = enhancedProjects.filter(p => p.healthScore !== null && p.healthScore >= 50 && p.healthScore < 70).length;
  const mediumRiskProjects = enhancedProjects.filter(p => p.healthScore !== null && p.healthScore >= 70 && p.healthScore < 85).length;
  const lowRiskProjects = enhancedProjects.filter(p => p.healthScore !== null && p.healthScore >= 85).length;
  const budgetIssues = enhancedProjects.filter(p =>
    p.budgetHealth.status === 'warning' || p.budgetHealth.status === 'critical'
  ).length;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Low Risk */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Low Risk</p>
                <p className="text-4xl font-black text-emerald-600 leading-tight">{lowRiskProjects}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medium Risk */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Medium Risk</p>
                <p className="text-4xl font-black text-blue-600 leading-tight">{mediumRiskProjects}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* High Risk */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">High Risk</p>
                <p className="text-4xl font-black text-amber-600 leading-tight">{highRiskProjects}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Critical</p>
                <p className="text-4xl font-black text-red-600 leading-tight">{criticalProjects}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                <TrendingDown className="h-7 w-7 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Health Table */}
      <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30 py-6 px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                Project Health Matrix
              </CardTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-10">Real-time project vitals and performance</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search projects by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm font-medium focus:ring-blue-500/20"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-8">
                    <Button variant="ghost" onClick={() => handleSort('name')} className="h-auto p-0 hover:bg-transparent font-bold text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
                      Project Name
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('healthScore')} className="h-auto p-0 hover:bg-transparent font-bold text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
                      Health Score
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4">Status</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('taskCompletionRate')} className="h-auto p-0 hover:bg-transparent font-bold text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
                      Task Progress
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4">Budget</TableHead>
                  <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4">Overdue</TableHead>
                  <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4">Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow
                    key={project.id || project._id}
                    className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                    ref={el => projectRefs.current[project.id || project._id] = el}
                  >
                    <TableCell className="py-6 pl-8">
                      <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{project.name}</p>
                    </TableCell>
                    <TableCell className="py-6">
                      <div className="space-y-3 min-w-[140px]">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-black text-slate-900">{project.healthScore !== null ? project.healthScore : "--"}</span>
                          {project.healthScore !== null && (
                            <Badge className={`
                              ${project.healthScore >= 85 ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15' :
                                project.healthScore >= 70 ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/15' :
                                  project.healthScore >= 50 ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/15' :
                                    'bg-red-500/10 text-red-600 hover:bg-red-500/15'}
                              border-none font-black text-[10px] uppercase tracking-wider py-1 rounded-lg
                            `}>
                              {project.healthScore >= 85 ? 'Low Risk' :
                                project.healthScore >= 70 ? 'Medium Risk' :
                                  project.healthScore >= 50 ? 'High Risk' : 'Critical'}
                            </Badge>
                          )}
                        </div>
                        {project.healthScore !== null ? (
                          <Progress
                            value={project.healthScore}
                            className={`h-1.5 w-28 rounded-full bg-slate-100 ${project.healthScore >= 85 ? '[&>div]:bg-emerald-500' :
                              project.healthScore >= 70 ? '[&>div]:bg-blue-500' :
                                project.healthScore >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                              }`}
                          />
                        ) : (
                          <div className="h-1.5 w-28 bg-slate-50 rounded-full" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-6">
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold px-3 py-1 rounded-lg capitalize">
                        {project.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-6">
                      <div className="space-y-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{project.taskCompletionRate}%</span>
                          <span className="text-[11px] font-bold text-slate-400">
                            ({project.completedTasks}/{project.totalTasks})
                          </span>
                        </div>
                        <Progress value={project.taskCompletionRate} className="h-1.5 w-28 rounded-full bg-slate-100 [&>div]:bg-blue-600" />
                      </div>
                    </TableCell>
                    <TableCell className="py-6">
                      <div className="space-y-1">
                        {getBudgetBadge(project.budgetHealth)}
                        {project.budgetHealth.status !== 'unknown' && (
                          <p className={`text-[11px] font-bold ${project.budgetHealth.variance > 10 ? 'text-red-500' : 'text-slate-400'}`}>
                            {project.budgetHealth.variance > 0 ? '+' : ''}{project.budgetHealth.variance}%
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-6">
                      {project.overdueTasks > 0 ? (
                        <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/15 border-none font-bold px-3 py-1 rounded-lg">
                          {project.overdueTasks} overdue
                        </Badge>
                      ) : (
                        <span className="text-slate-400 font-bold text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell className="py-6 pr-8">
                      {project.deadline ? (
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          {new Date(project.deadline).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold text-sm">No deadline</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-24 bg-slate-50/20">
              <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                <Target className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-800">No projects found</h3>
              <p className="text-slate-500 font-medium">Try adjusting your search term to find what you're looking for.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
