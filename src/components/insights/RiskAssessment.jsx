import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, AlertCircle, CheckCircle2, Clock, Users, TrendingDown, ChevronRight, Activity, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

export default function RiskAssessment({ project, tasks, stories = [], compact = false }) {
  const [expandedRisks, setExpandedRisks] = useState({});

  const toggleRisk = (index) => {
    setExpandedRisks(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const assessRisks = () => {
    const risks = [];
    const now = new Date();

    // Calculate risk score (0-100, higher = more risk)
    let riskScore = 0;
    const riskFactors = [];

    // Calculate progress for risk assessment using Story Points for consistency
    const totalPoints = stories.reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
    const donePoints = stories
      .filter(s => s.status === 'done')
      .reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
    const currentProgress = totalPoints > 0 ? (donePoints / totalPoints) * 100 : 0;

    // 1. Deadline Risk (0-30 points)
    if (project.deadline) {
      const deadline = new Date(project.deadline);
      const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const progress = currentProgress;
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
      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-6 relative overflow-hidden transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-4 mb-6">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${bg} ${text} shadow-sm border ${border}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 tracking-normal text-lg leading-tight">Risk Assessment</h3>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${text}`}>{overallRiskLevel} Risk</p>
          </div>
          <div className="ml-auto text-right">
            <span className={`text-4xl font-black ${text} tracking-normal`}>{Number(riskScore).toFixed(1)}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">/100</span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${riskScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full ${text.replace('text', 'bg')} rounded-full`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-red-50 border border-red-100/50">
            <span className="text-2xl font-black text-red-600 tracking-normal">{criticalRisks}</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Critical</span>
          </div>
          <div className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-orange-50 border border-orange-100/50">
            <span className="text-2xl font-black text-orange-600 tracking-normal">{highRisks}</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">High</span>
          </div>
          <div className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-amber-50 border border-amber-100/50">
            <span className="text-2xl font-black text-amber-600 tracking-normal">{mediumRisks}</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Medium</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 rounded-2xl border-2 border-white shadow-md">
            <AvatarImage src={project.logo_url} />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-xs">
              {project.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-normal">Risk Assessment</h2>
            <p className="text-sm font-medium text-slate-500">Telemetry for <span className="text-blue-600 font-bold">{project.name}</span></p>
          </div>
        </div>
        <Badge className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-none ${bg} ${text} ${border}`}>
          {overallRiskLevel} Risk Level
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Score Card */}
        <div className={`lg:col-span-4 rounded-[32px] ${bg} border ${border} p-8 flex flex-col justify-center items-center text-center relative overflow-hidden shadow-sm`}>
          <div className="absolute -top-4 -right-4 opacity-5">
            <Icon className="h-40 w-40" />
          </div>
          <div className="relative z-10 w-full space-y-4">
            <p className={`text-[11px] font-black uppercase tracking-widest ${text} opacity-80`}>Overall Risk Score</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className={`text-6xl font-black tracking-normal ${text}`}>{Number(riskScore).toFixed(1)}</span>
              <span className={`text-sm font-bold opacity-60 ${text}`}>/100</span>
            </div>
            <div className="w-full bg-white/40 h-2.5 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${riskScore}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={`h-full ${text.replace('text', 'bg')} rounded-full`}
              />
            </div>
            <div className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 ${text} font-bold text-sm backdrop-blur-sm border border-white/40 shadow-sm`}>
              <Icon className="h-4 w-4" />
              <span className="capitalize">{overallRiskLevel} Risk Detected</span>
            </div>
          </div>
        </div>

        {/* Breakdown & Factors */}
        <div className="lg:col-span-8 space-y-6 flex flex-col">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-4xl font-black tracking-normal text-slate-900 mb-1">{criticalRisks}</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Critical</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-4xl font-black tracking-normal text-slate-900 mb-1">{highRisks}</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-4xl font-black tracking-normal text-slate-900 mb-1">{mediumRisks}</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medium</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex-1">
            <h4 className="flex items-center gap-2 font-black text-slate-900 text-sm mb-6 uppercase tracking-widest">
              <Activity className="h-4 w-4 text-blue-600" />
              Contribution Factors
            </h4>
            {riskFactors.length > 0 ? (
              <div className="space-y-4">
                {riskFactors.slice(0, 3).map((factor, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-700 flex-1 truncate">{factor.factor}</span>
                    <div className="flex items-center gap-3 w-48">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (factor.impact / 30) * 100)}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-blue-600 rounded-full"
                        />
                      </div>
                      <Badge variant="outline" className="font-mono font-black text-blue-600 text-[10px] border-blue-100 bg-blue-50/50 w-14 justify-center">
                        +{Number(factor.impact).toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {riskFactors.length > 3 && (
                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">+{riskFactors.length - 3} More Factors Analysed</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 pb-4">
                <CheckCircle2 className="h-8 w-8 text-slate-300" />
                <span className="text-[10px] font-black uppercase tracking-widest">No active risk factors</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Risks List */}
      {risks.length > 0 && (
        <div className="pt-2">
          <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4 uppercase tracking-widest text-sm">
            <ShieldAlert className="h-4 w-4 text-blue-600" />
            Identified Risks & Mitigations
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {risks.map((risk, index) => {
              const riskStyle = riskColors[risk.level];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={index}
                  className="group flex flex-col sm:flex-row gap-4 bg-white border border-slate-200 rounded-3xl p-5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
                >
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge className={`uppercase text-[9px] font-black tracking-widest border-0 px-2.5 py-1 rounded-lg shadow-none ${riskStyle.bg} ${riskStyle.text}`}>
                        {risk.level}
                      </Badge>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <Badge variant="outline" className="uppercase text-[9px] font-black tracking-widest border-slate-200 px-2.5 py-1 rounded-lg text-slate-500 shadow-none">
                        {risk.category}
                      </Badge>
                    </div>
                    <h4 className="font-black text-slate-900 text-lg mb-1.5 group-hover:text-blue-600 transition-colors">{risk.title}</h4>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">{risk.description}</p>
                  </div>

                  {/* Action Section */}
                  <div
                    className="sm:w-80 bg-slate-50/50 rounded-2xl p-4 border border-slate-100 cursor-pointer transition-all hover:bg-slate-50 flex flex-col justify-center"
                    onClick={() => toggleRisk(index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className={`text-[10px] uppercase tracking-widest font-black ${expandedRisks[index] ? 'text-blue-600' : 'text-slate-500'}`}>Recommended Action</p>
                      </div>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${expandedRisks[index] ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                        <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${expandedRisks[index] ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      <motion.div
                        key="content"
                        initial="collapsed"
                        animate={expandedRisks[index] ? "open" : "collapsed"}
                        exit="collapsed"
                        variants={{
                          open: { opacity: 1, height: "auto", marginTop: 12 },
                          collapsed: { opacity: 0, height: 0, marginTop: 0 }
                        }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm font-bold text-slate-800 leading-snug border-t border-slate-200/60 pt-3">{risk.mitigation}</p>
                      </motion.div>
                    </AnimatePresence>
                    {!expandedRisks[index] && (
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 group-hover:text-blue-500 transition-colors">
                        Click to unmask
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {risks.length === 0 && (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col items-center justify-center gap-4">
          <div className="h-20 w-20 rounded-[32px] bg-green-50 border border-green-100 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-black tracking-normal text-slate-900 mb-1">Optimal State Confirmed</p>
            <p className="text-sm font-medium text-slate-500">Telemetry indicates no active risks across the operational vector.</p>
          </div>
        </div>
      )}
    </div>
  );
}