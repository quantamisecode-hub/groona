import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, AlertCircle, CheckCircle2, Clock, Users, TrendingDown, ChevronRight, Activity, ShieldAlert } from "lucide-react";

export default function RiskAssessment({ project, tasks, compact = false }) {
  const assessRisks = () => {
    const risks = [];
    const now = new Date();

    // Calculate risk score (0-100, higher = more risk)
    let riskScore = 0;
    const riskFactors = [];

    // 1. Deadline Risk (0-30 points)
    if (project.deadline) {
      const deadline = new Date(project.deadline);
      const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const progress = project.progress || 0;
      const expectedProgress = 100 - ((daysUntilDeadline / 90) * 100); // Assuming 90 day project
      const progressGap = Math.max(0, expectedProgress - progress);

      if (daysUntilDeadline < 0 && project.status !== 'completed') {
        riskScore += 30;
        riskFactors.push({ factor: 'Overdue deadline', impact: 30 });
        risks.push({
          level: 'critical',
          category: 'Deadline',
          title: 'Project Overdue',
          description: `Project is ${Math.abs(daysUntilDeadline)} days past deadline`,
          impact: 'Critical',
          mitigation: 'Immediate action required: reassess scope, add resources, or extend deadline',
        });
      } else if (daysUntilDeadline <= 7 && progress < 80) {
        const points = Math.min(25, (80 - progress) / 3);
        riskScore += points;
        riskFactors.push({ factor: 'Tight deadline', impact: points });
        risks.push({
          level: 'high',
          category: 'Deadline',
          title: 'Tight Timeline',
          description: `Only ${daysUntilDeadline} days remaining with ${100 - progress}% work left`,
          impact: 'High',
          mitigation: 'Prioritize critical tasks, consider overtime, or negotiate deadline extension',
        });
      } else if (progressGap > 20) {
        const points = Math.min(15, progressGap / 5);
        riskScore += points;
        riskFactors.push({ factor: 'Behind schedule', impact: points });
        risks.push({
          level: 'medium',
          category: 'Progress',
          title: 'Behind Schedule',
          description: `Project ${progressGap.toFixed(0)}% behind expected progress`,
          impact: 'Medium',
          mitigation: 'Review task priorities and remove blockers',
        });
      }
    }

    // 2. Task Health Risk (0-25 points)
    const pendingTasks = tasks.filter(t => t.status !== 'completed').length;
    const totalTasks = tasks.length;

    if (totalTasks > 0) {
      const completionRate = ((totalTasks - pendingTasks) / totalTasks) * 100;

      if (completionRate < 25 && totalTasks > 10) {
        riskScore += 20;
        riskFactors.push({ factor: 'Low completion rate', impact: 20 });
        risks.push({
          level: 'high',
          category: 'Progress',
          title: 'Low Completion Rate',
          description: `Only ${completionRate.toFixed(0)}% of tasks completed (${totalTasks - pendingTasks}/${totalTasks})`,
          impact: 'High',
          mitigation: 'Break down complex tasks, reassign resources, identify and remove blockers',
        });
      } else if (completionRate < 50 && totalTasks > 5) {
        riskScore += 10;
        riskFactors.push({ factor: 'Moderate completion rate', impact: 10 });
      }
    }

    // 3. Overdue Tasks Risk (0-20 points)
    const overdueTasks = tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      return new Date(t.due_date) < now;
    });

    if (overdueTasks.length > 0) {
      const points = Math.min(20, overdueTasks.length * 2);
      riskScore += points;
      riskFactors.push({ factor: 'Overdue tasks', impact: points });
      risks.push({
        level: overdueTasks.length > 5 ? 'critical' : 'high',
        category: 'Tasks',
        title: 'Overdue Tasks',
        description: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} past due date`,
        impact: overdueTasks.length > 5 ? 'Critical' : 'High',
        mitigation: 'Review with task owners, reassign if needed, update deadlines if realistic',
      });
    }

    // 4. Workflow Bottleneck Risk (0-15 points)
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const reviewTasks = tasks.filter(t => t.status === 'review');

    if (inProgressTasks.length > totalTasks * 0.4) {
      riskScore += 10;
      riskFactors.push({ factor: 'Too many in-progress tasks', impact: 10 });
      risks.push({
        level: 'medium',
        category: 'Workflow',
        title: 'Work-in-Progress Overload',
        description: `${inProgressTasks.length} tasks in progress - possible multitasking issues`,
        impact: 'Medium',
        mitigation: 'Encourage team to finish tasks before starting new ones',
      });
    }

    if (reviewTasks.length > 5) {
      riskScore += 8;
      riskFactors.push({ factor: 'Review backlog', impact: 8 });
      risks.push({
        level: 'medium',
        category: 'Workflow',
        title: 'Review Backlog',
        description: `${reviewTasks.length} tasks waiting for review`,
        impact: 'Medium',
        mitigation: 'Assign dedicated reviewers, set review time limits',
      });
    }

    // 5. Resource Risk (0-10 points)
    const unassignedTasks = tasks.filter(t => !t.assigned_to && t.status !== 'completed');
    if (unassignedTasks.length > 0) {
      const points = Math.min(10, unassignedTasks.length);
      riskScore += points;
      riskFactors.push({ factor: 'Unassigned tasks', impact: points });
      risks.push({
        level: 'medium',
        category: 'Resources',
        title: 'Unassigned Tasks',
        description: `${unassignedTasks.length} task${unassignedTasks.length > 1 ? 's' : ''} need assignment`,
        impact: 'Medium',
        mitigation: 'Use auto-assignment feature or manually assign to available team members',
      });
    }

    return { risks, riskScore, riskFactors };
  };

  const { risks, riskScore, riskFactors } = assessRisks();
  const criticalRisks = risks.filter(r => r.level === 'critical').length;
  const highRisks = risks.filter(r => r.level === 'high').length;
  const mediumRisks = risks.filter(r => r.level === 'medium').length;

  const overallRiskLevel = riskScore >= 60 ? 'critical' : riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

  const riskColors = {
    critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: AlertCircle },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
    low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
  };

  const { bg, text, border, icon: Icon } = riskColors[overallRiskLevel];

  if (compact) {
    return (
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`p-4 rounded-xl ${bg} border ${border}`}>
            <div className="flex items-center gap-3 mb-3">
              <Icon className={`h-8 w-8 ${text}`} />
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Overall Risk Level</p>
                <p className={`text-2xl font-bold ${text} capitalize`}>{overallRiskLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Risk Score</p>
                <p className={`text-3xl font-bold ${text}`}>{riskScore}</p>
              </div>
            </div>
            <Progress value={riskScore} className="h-2" />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-red-600">{criticalRisks}</p>
              <p className="text-[10px] sm:text-xs text-slate-600">Critical</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-orange-600">{highRisks}</p>
              <p className="text-[10px] sm:text-xs text-slate-600">High</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-amber-600">{mediumRisks}</p>
              <p className="text-[10px] sm:text-xs text-slate-600">Medium</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="truncate">Risk Assessment: {project.name}</span>
          </CardTitle>
          <Badge variant="outline" className={`${text} ${bg} border-${riskColors[overallRiskLevel].border} px-3 py-1 text-sm capitalize`}>
            {overallRiskLevel} Risk Level
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Section: Score & Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

          {/* 1. Main Score Card */}
          <div className={`md:col-span-5 lg:col-span-4 p-6 rounded-xl ${bg} border ${border} flex flex-col justify-center items-center text-center relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Icon className="h-24 w-24" />
            </div>

            <div className="relative z-10 w-full">
              <p className="text-sm font-medium text-slate-600 mb-1 uppercase tracking-wider">Risk Score</p>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className={`text-5xl font-bold ${text}`}>{riskScore}</span>
                <span className="text-slate-500 font-medium">/100</span>
              </div>

              <Progress value={riskScore} className="h-2 w-full max-w-[160px] mx-auto bg-white/50 mb-4" />

              <div className="flex items-center justify-center gap-2 text-sm font-medium bg-white/40 p-2 rounded-lg backdrop-blur-sm">
                <Icon className={`h-4 w-4 ${text}`} />
                <span className="capitalize text-slate-700">{overallRiskLevel} Risk Detected</span>
              </div>
            </div>
          </div>

          {/* 2. Detail Metrics Grid */}
          <div className="md:col-span-7 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Critical */}
            <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-red-50 transition-colors cursor-default">
              <p className="text-3xl font-bold text-red-600 mb-1">{criticalRisks}</p>
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Critical Risks</p>
            </div>

            {/* High */}
            <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-orange-50 transition-colors cursor-default">
              <p className="text-3xl font-bold text-orange-600 mb-1">{highRisks}</p>
              <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">High Risks</p>
            </div>

            {/* Medium */}
            <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-amber-50 transition-colors cursor-default">
              <p className="text-3xl font-bold text-amber-600 mb-1">{mediumRisks}</p>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Medium Risks</p>
            </div>

            {/* Risk Factors Breakdown - Spans Full Width of this sub-grid */}
            <div className="sm:col-span-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <h4 className="flex items-center gap-2 font-semibold text-slate-800 text-sm mb-3">
                <Activity className="h-4 w-4 text-slate-500" />
                Risk Contribution Factors
              </h4>
              {riskFactors.length > 0 ? (
                <div className="space-y-3">
                  {riskFactors.slice(0, 3).map((factor, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-600 flex-1 truncate">{factor.factor}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, (factor.impact / 30) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono font-medium text-slate-700 text-xs w-6 text-right">+{factor.impact}</span>
                      </div>
                    </div>
                  ))}
                  {riskFactors.length > 3 && (
                    <p className="text-xs text-center text-slate-400 pt-1">+{riskFactors.length - 3} more factors</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-slate-400 text-sm italic">
                  No negative risk factors currently affecting score.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Risks List */}
        {risks.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              Identified Risks & Mitigation
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {risks.map((risk, index) => {
                const riskStyle = riskColors[risk.level];
                return (
                  <div key={index} className={`relative p-4 rounded-xl border ${riskStyle.border} ${riskStyle.bg} flex flex-col sm:flex-row gap-4 transition-all hover:shadow-sm`}>
                    {/* Left Stripe */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${riskStyle.text.replace('text', 'bg').replace('700', '500')}`}></div>

                    <div className="flex-1 pl-2">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge className={`uppercase text-[10px] font-bold tracking-wider border-0 ${riskStyle.bg} ${riskStyle.text}`}>
                          {risk.level}
                        </Badge>
                        <span className="text-xs font-medium text-slate-500 bg-white/50 px-2 py-0.5 rounded-full border border-slate-200/50">
                          {risk.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-base mb-1">{risk.title}</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{risk.description}</p>
                    </div>

                    {/* Action Section */}
                    <div className="sm:w-1/3 min-w-[250px] bg-white/60 rounded-lg p-3 border border-slate-200/50 backdrop-blur-sm self-start">
                      <div className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Recommended Action</p>
                          <p className="text-xs md:text-sm font-medium text-slate-800 leading-snug">{risk.mitigation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {risks.length === 0 && (
          <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-80" />
            <p className="font-medium text-slate-900">No Significant Risks Identified</p>
            <p className="text-sm text-slate-500">Project is on track with no major concerns</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}