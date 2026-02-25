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

      if (criticalRisks > 0) {
        recommendation = `${criticalRisks} critical issues detected across active projects. Immediate intervention recommended.`;
        recommendationType = "warning";
      } else if (highRisks > 0) {
        recommendation = `${highRisks} high-priority risks identified. Review project timelines and resource allocation.`;
        recommendationType = "warning";
      } else if (hasBottleneck) {
        recommendation = `${inReview} tasks waiting for review. Accelerate approval process to maintain velocity.`;
        recommendationType = "info";
      } else {
        recommendation = "Project ecosystem is healthy. Team velocity is stable with no major blockers detected.";
        recommendationType = "success";
      }

      return {
        healthScore,
        criticalRisks,
        highRisks,
        mediumRisks,
        weeklyVelocity,
        velocityTrend,
        hasBottleneck,
        bottleneckCount: inReview,
        recommendation,
        recommendationType,
      };
    };

    setInsights(calculateInsights());
  }, [projects, tasks, activities, loading]);

  if (loading || !insights) return null;

  const healthColor = insights.healthScore >= 80 ? "text-green-600" : insights.healthScore >= 60 ? "text-amber-600" : "text-red-600";
  const healthBg = insights.healthScore >= 80 ? "from-green-500 to-emerald-500" : insights.healthScore >= 60 ? "from-amber-500 to-orange-500" : "from-red-500 to-rose-500";

  return (
    <Card className="bg-gradient-to-br from-purple-50/50 to-blue-50/50 border-purple-200/60 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/20 flex-shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="leading-tight">AI Insights & Recommendations</span>
          </CardTitle>
          <Link to={createPageUrl("ProjectInsights")} className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="border-purple-200 hover:bg-purple-50 w-full sm:w-auto">
              View Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Health Score */}
          <Link to={createPageUrl("ProjectInsights") + "?tab=overview"} className="block group">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group-hover:scale-[1.02] h-full">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${healthBg} shadow-lg flex-shrink-0`}>
                  <Target className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Health</p>
                  <p className={`text-xl font-bold ${healthColor}`}>{insights.healthScore}</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Risk Summary (Granular) */}
          <Link to={createPageUrl("ProjectInsights") + "?tab=risk"} className="block group lg:col-span-2">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-red-300 hover:shadow-md transition-all group-hover:scale-[1.01] h-full">
              <div className="flex items-center justify-between gap-2 h-full">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-100 flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Total Risks</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-600">{insights.criticalRisks}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Crit</p>
                  </div>
                  <div className="text-center border-l border-slate-100 pl-3">
                    <p className="text-lg font-bold text-orange-600">{insights.highRisks}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">High</p>
                  </div>
                  <div className="text-center border-l border-slate-100 pl-3">
                    <p className="text-lg font-bold text-amber-600">{insights.mediumRisks}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Med</p>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Weekly Velocity */}
          <Link to={createPageUrl("ProjectInsights") + "?tab=timeline"} className="block group">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group-hover:scale-[1.02] h-full">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                  {insights.velocityTrend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Velocity</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-bold text-slate-900">{insights.weeklyVelocity}</p>
                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">tasks/day</span>
                    <Badge variant="outline" className="ml-1 text-[8px] px-1 h-4 flex-shrink-0 border-slate-200">
                      {insights.velocityTrend === 'up' ? '↑' : insights.velocityTrend === 'down' ? '↓' : '→'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Bottlenecks */}
          <Link to={createPageUrl("ProjectInsights") + "?tab=timeline"} className="block group">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition-all group-hover:scale-[1.02] h-full">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg flex-shrink-0 ${insights.hasBottleneck ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <Target className={`h-4 w-4 ${insights.hasBottleneck ? 'text-amber-600' : 'text-green-600'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Bottlenecks</p>
                  <p className="text-xl font-bold text-slate-900">
                    {insights.bottleneckCount}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Recommendation */}
        <div className={`p-4 rounded-xl border-2 transition-all duration-500 ${insights.recommendationType === 'warning'
          ? 'bg-amber-50 border-amber-200'
          : insights.recommendationType === 'info'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-green-50 border-green-200'
          }`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles className={`h-5 w-5 flex-shrink-0 ${insights.recommendationType === 'warning'
                  ? 'text-amber-600'
                  : insights.recommendationType === 'info'
                    ? 'text-blue-600'
                    : 'text-green-600'
                  }`} />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">AI Recommendation segment</p>
                  <p className="text-xs text-slate-700 truncate">{insights.recommendation}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 bg-white/50 backdrop-blur-sm shrink-0 h-8 text-xs font-semibold"
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
              <div className="pt-3 border-t border-slate-200/50 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="bg-white/40 rounded-lg p-3 text-sm text-slate-700 max-w-none">
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

                    if (line.startsWith('###')) return <h3 key={i} className="font-bold text-slate-900 mb-1">{line.replace('###', '')}</h3>;
                    if (line.startsWith('*')) return <p key={i} className="italic mt-2 border-l-2 border-purple-200 pl-3 text-xs">{renderFormattedLine(line.replace('*', ''))}</p>;
                    if (line.match(/^\d\./)) return <div key={i} className="ml-1 mb-1 text-xs sm:text-sm"><strong className="font-bold">{line.split('. ')[0]}.</strong> {renderFormattedLine(line.split('. ')[1])}</div>;
                    return <p key={i} className="mb-1 text-xs sm:text-sm">{renderFormattedLine(line)}</p>;
                  })}
                  <div className="mt-2 flex justify-end">
                    <Link to={createPageUrl("ProjectInsights")}>
                      <Button variant="ghost" size="xs" className="text-[10px] text-purple-600 hover:text-purple-700 p-0 h-auto font-bold">
                        View Detailed Report <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
