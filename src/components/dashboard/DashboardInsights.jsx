import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, AlertTriangle, AlertCircle, Target, ArrowRight, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInDays } from "date-fns";

export default function DashboardInsights({ projects, tasks, stories = [], activities, loading }) {
  const [insights, setInsights] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  useEffect(() => {
    if (loading || !projects.length) return;

    const calculateInsights = () => {
      const now = new Date();

      // Helper to calculate project risks (consistent with ProjectInsights logic)
      const getProjectRisks = (project) => {
        const risks = [];
        const projectTasks = tasks.filter(t => t.project_id === project.id);
        const projectStories = stories.filter(s => s.project_id === project.id);

        // 1. Progress/Points
        const totalPoints = projectStories.reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
        const donePoints = projectStories
          .filter(s => s.status === 'done')
          .reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
        const progress = totalPoints > 0 ? (donePoints / totalPoints) * 100 : 0;

        // 2. Deadline Risk
        if (project.deadline) {
          const deadline = new Date(project.deadline);
          const daysUntilDeadline = differenceInDays(deadline, now);
          if (daysUntilDeadline < 0 && project.status !== 'completed') {
            risks.push({ level: 'critical' });
          } else if (daysUntilDeadline <= 7 && progress < 80) {
            risks.push({ level: 'high' });
          } else {
            const expectedProgress = 100 - ((Math.max(0, daysUntilDeadline) / 90) * 100);
            if (expectedProgress - progress > 20) {
              risks.push({ level: 'medium' });
            }
          }
        }

        // 3. Task Health
        if (projectTasks.length > 0) {
          const pending = projectTasks.filter(t => t.status !== 'completed').length;
          const completionRate = ((projectTasks.length - pending) / projectTasks.length) * 100;
          if (completionRate < 25 && projectTasks.length > 10) risks.push({ level: 'high' });
        }

        // 4. Overdue Tasks
        const overdue = projectTasks.filter(t => {
          if (!t.due_date || t.status === 'completed') return false;
          return new Date(t.due_date) < now;
        });
        if (overdue.length > 5) risks.push({ level: 'critical' });
        else if (overdue.length > 0) risks.push({ level: 'high' });

        return risks;
      };

      const atRiskProjects = projects.filter(p => p.status === 'active').filter(p => {
        const projectRisks = getProjectRisks(p);
        return projectRisks.some(r => r.level === 'critical' || r.level === 'high');
      });

      // Granular Risk Analysis
      let criticalRisks = 0;
      let highRisks = 0;
      let mediumRisks = 0;

      projects.filter(p => p.status === 'active').forEach(p => {
        const projectRisks = getProjectRisks(p);
        criticalRisks += projectRisks.filter(r => r.level === 'critical').length;
        highRisks += projectRisks.filter(r => r.level === 'high').length;
        mediumRisks += projectRisks.filter(r => r.level === 'medium').length;
      });

      // Velocity Analysis (average completions per day in last 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentCompleted = tasks.filter(t =>
        t.status === 'completed' && t.updated_date && new Date(t.updated_date) > sevenDaysAgo
      ).length;
      const weeklyVelocity = (recentCompleted / 7).toFixed(1);

      // Performance Trend (Compare last 7 days vs previous 7 days)
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const prevWeekCompleted = tasks.filter(t =>
        t.status === 'completed' &&
        t.updated_date &&
        new Date(t.updated_date) > fourteenDaysAgo &&
        new Date(t.updated_date) <= sevenDaysAgo
      ).length;

      const velocityTrend = recentCompleted > prevWeekCompleted ? 'up' : recentCompleted < prevWeekCompleted ? 'down' : 'stable';

      // Bottleneck Detection (Tasks in 'review' status)
      const inReview = tasks.filter(t => t.status === 'review').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const hasBottleneck = inReview > 5 || inProgress > tasks.length * 0.4;

      // Use the trend calculated from tasks consistently

      // Health Score (0-100)
      const onTimeProjects = projects.filter(p => {
        if (!p.deadline || p.status === 'completed') return true;
        return differenceInDays(new Date(p.deadline), now) >= 0;
      }).length;

      // Unified health completion rate using Story Points
      const totalGlobalPoints = stories.reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
      const doneGlobalPoints = stories
        .filter(s => s.status === 'done')
        .reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
      const completionRate = totalGlobalPoints > 0 ? (doneGlobalPoints / totalGlobalPoints) * 100 : 0;
      const healthScore = Math.round(
        (onTimeProjects / Math.max(projects.length, 1)) * 40 +
        (completionRate * 0.4) +
        (hasBottleneck ? 0 : 20)
      );

      // Top Priority Recommendation
      let recommendation = "";
      let recommendationType = "success";

      if (atRiskProjects.length > 0) {
        recommendation = `${atRiskProjects.length} project(s) need immediate attention - approaching deadline with low progress`;
        recommendationType = "warning";
      } else if (hasBottleneck) {
        recommendation = `${inReview} tasks in review - consider accelerating approval process`;
        recommendationType = "info";
      } else if (weeklyVelocity < 5) {
        recommendation = "Low team velocity detected - consider redistributing workload or addressing blockers";
        recommendationType = "info";
      } else {
        recommendation = "All systems running smoothly! Team is on track with current goals";
        recommendationType = "success";
      }

      return {
        healthScore,
        atRiskProjects: atRiskProjects.length,
        criticalRisks,
        highRisks,
        mediumRisks,
        weeklyVelocity,
        velocityTrend,
        hasBottleneck,
        bottleneckCount: inReview + inProgress,
        recommendation,
        recommendationType,
      };
    };

    setInsights(calculateInsights());
  }, [projects, tasks, activities, loading]);

  if (loading || !insights) return null;

  return (
    <div className="w-full bg-blue-50 border border-blue-200 rounded-[24px] overflow-hidden p-6 sm:p-8 flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-row items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Sparkles className="h-[18px] w-[18px] text-purple-600 fill-purple-100" />
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight m-0">
            AI Insights & Recommendations
          </h2>
        </div>
        <Link to={createPageUrl("ProjectInsights")}>
          <Button variant="outline" size="sm" className="h-[34px] text-[13px] font-medium text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-900 px-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            View Details <ArrowRight className="h-3.5 w-3.5 ml-1.5 opacity-60" />
          </Button>
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Health Score */}
        <Link to={`${createPageUrl("ProjectInsights")}?tab=overview`} className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-blue-300 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${insights.healthScore >= 80 ? 'bg-green-50 text-green-500' : insights.healthScore >= 60 ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>
              <Target className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5 group-hover:text-blue-600 transition-colors">Health Score</span>
              <span className={`text-[26px] font-bold tracking-tight leading-none ${insights.healthScore >= 80 ? 'text-green-500' : insights.healthScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{insights.healthScore}</span>
            </div>
          </div>
        </Link>

        {/* At Risk Projects */}
        <Link to={`${createPageUrl("ProjectInsights")}?tab=risk`} className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-rose-300 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              <AlertTriangle className="h-5 w-5 text-rose-500" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5 group-hover:text-rose-600 transition-colors">At Risk</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">{insights.atRiskProjects}</span>
                {insights.criticalRisks > 0 && <span className="text-[12px] font-bold text-rose-500">({insights.criticalRisks} crit)</span>}
              </div>
            </div>
          </div>
        </Link>

        {/* Weekly Velocity */}
        <Link to={`${createPageUrl("ProjectInsights")}?tab=timeline`} className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-blue-300 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              {insights.velocityTrend === 'up' ? (
                <TrendingUp className="h-5 w-5 text-blue-500" strokeWidth={2.5} />
              ) : (
                <TrendingDown className="h-5 w-5 text-blue-500" strokeWidth={2.5} />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5 group-hover:text-blue-600 transition-colors">Velocity</span>
              <div className="flex items-center gap-2 leading-none">
                <span className="text-[26px] font-bold text-slate-900 tracking-tight">{insights.weeklyVelocity}</span>
                <div className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-medium">
                  {insights.velocityTrend === 'up' ? '↑' : insights.velocityTrend === 'down' ? '↓' : '→'}
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Bottlenecks */}
        <Link to={`${createPageUrl("ProjectInsights")}?tab=overview`} className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-amber-300 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${insights.hasBottleneck ? 'bg-amber-50 text-amber-500' : 'bg-green-50 text-green-500'}`}>
              <AlertCircle className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5 group-hover:text-amber-600 transition-colors">Bottlenecks</span>
              <span className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">
                {insights.hasBottleneck ? insights.bottleneckCount : 0}
              </span>
            </div>
          </div>
        </Link>

      </div>

      {/* AI Recommendation Banner */}
      <div className={`mt-2 flex flex-col w-full p-5 rounded-[20px] border transition-all duration-300 ${insights.recommendationType === 'warning'
        ? 'bg-[#FEFCE8] border-[#FEF08A]'
        : insights.recommendationType === 'info'
          ? 'bg-[#F0FDF4] border-[#BBF7D0]'
          : 'bg-[#FEFCE8] border-[#FEF08A]'
        }`}>
        <div className="flex items-start justify-between gap-3 min-w-0 w-full">
          <div className="flex items-start gap-3.5 min-w-0">
            <Sparkles className={`h-[18px] w-[18px] mt-0.5 flex-shrink-0 ${insights.recommendationType === 'warning'
              ? 'text-orange-500 fill-orange-200'
              : insights.recommendationType === 'info'
                ? 'text-green-500 fill-green-200'
                : 'text-orange-500 fill-orange-200'
              }`} />
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-bold text-slate-900 tracking-tight leading-tight">AI Recommendation</span>
              <span className="text-[13px] font-medium text-slate-600 mt-1">{insights.recommendation}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 ml-4 h-[34px] text-[13px] font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 px-5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            onClick={() => {
              setIsAnalyzing(true);
              // Simulate AI Analysis
              setTimeout(() => {
                const analysis = `### Analysis Result
Based on current data, here are the key action items:
1. **Critical Focus**: Address the **${insights.criticalRisks} critical risks** immediately. They are primarily driven by deadline breaches.
2. **Velocity**: Current velocity is **${insights.weeklyVelocity} tasks/day**. ${insights.velocityTrend === 'down' ? '**Downward trend detected.**' : 'Velocity is stable.'}
3. **Bottlenecks**: ${insights.hasBottleneck ? '**Identify blockers in Review stage.**' : 'No major bottlenecks currently.'}

*Recommendation: **Re-prioritize resources** to Critical projects to avoid further slippage.*`;
                setDetailedAnalysis(analysis);
                setIsAnalyzing(false);
              }, 1500);
            }}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </div>
            ) : 'Analyze'}
          </Button>
        </div>

        {detailedAnalysis && (
          <div className="mt-4 pt-4 border-t border-amber-200/50 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 text-[13px] text-slate-700 w-full">
              {detailedAnalysis.split('\n').map((line, i) => {
                if (!line.trim()) return null;

                // Helper to render bold text segments
                const renderFormattedLine = (text) => {
                  const segments = text.split(/(\*\*.*?\*\*)/g);
                  return segments.map((seg, si) => {
                    if (seg.startsWith('**') && seg.endsWith('**')) {
                      return <strong key={si} className="text-slate-900 font-bold">{seg.slice(2, -2)}</strong>;
                    }
                    return seg;
                  });
                };

                if (line.startsWith('###')) return <h3 key={i} className="font-bold text-slate-900 mb-2">{line.replace('###', '')}</h3>;
                if (line.startsWith('*')) return <p key={i} className="italic mt-3 border-l-2 border-orange-200 pl-3">{renderFormattedLine(line.replace('*', ''))}</p>;
                if (line.match(/^\d\./)) return <div key={i} className="ml-1 mb-1"><strong className="font-bold">{line.split('. ')[0]}.</strong> {renderFormattedLine(line.split('. ')[1])}</div>;
                return <p key={i} className="mb-1">{renderFormattedLine(line)}</p>;
              })}
              <div className="mt-3 flex justify-end">
                <Link to={createPageUrl("ProjectInsights")}>
                  <Button variant="ghost" size="sm" className="text-[12px] text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-3 font-bold h-8 rounded-lg">
                    View Complete Report <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
