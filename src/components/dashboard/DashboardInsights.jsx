import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, AlertTriangle, Target, ArrowRight, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInDays } from "date-fns";

export default function DashboardInsights({ projects, tasks, activities, loading }) {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    if (loading || !projects.length) return;

    const calculateInsights = () => {
      const now = new Date();

      // Risk Analysis
      const atRiskProjects = projects.filter(p => {
        if (p.status === 'completed' || !p.deadline) return false;
        const daysUntilDeadline = differenceInDays(new Date(p.deadline), now);
        return daysUntilDeadline < 7 && (p.progress || 0) < 70;
      });

      // Velocity Analysis (tasks completed in last 7 days)
      const last7Days = activities.filter(a => {
        const activityDate = new Date(a.created_date);
        const daysDiff = differenceInDays(now, activityDate);
        return daysDiff <= 7 && a.action === 'completed' && a.entity_type === 'task';
      });
      const weeklyVelocity = last7Days.length;

      // Bottleneck Detection
      const inReview = tasks.filter(t => t.status === 'review').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const hasBottleneck = inReview > 5 || inProgress > tasks.length * 0.4;

      // Performance Trend
      const last14Days = activities.filter(a => {
        const activityDate = new Date(a.created_date);
        const daysDiff = differenceInDays(now, activityDate);
        return daysDiff <= 14 && daysDiff > 7 && a.action === 'completed' && a.entity_type === 'task';
      });
      const prevWeekVelocity = last14Days.length;
      const velocityTrend = weeklyVelocity > prevWeekVelocity ? 'up' : weeklyVelocity < prevWeekVelocity ? 'down' : 'stable';

      // Health Score (0-100)
      const onTimeProjects = projects.filter(p => {
        if (!p.deadline || p.status === 'completed') return true;
        return differenceInDays(new Date(p.deadline), now) >= 0;
      }).length;

      const completionRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
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

  const healthColor = insights.healthScore >= 80 ? "text-green-600" : insights.healthScore >= 60 ? "text-amber-600" : "text-red-600";
  const healthBg = insights.healthScore >= 80 ? "from-green-500 to-emerald-500" : insights.healthScore >= 60 ? "from-amber-500 to-orange-500" : "from-red-500 to-rose-500";

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[24px] overflow-hidden p-6 sm:p-8 flex flex-col gap-6">

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
        <div className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-red-50/50 flex items-center justify-center flex-shrink-0">
              <Target className="h-5 w-5 text-red-500" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5">Health Score</span>
              <span className="text-[26px] font-bold text-red-500 tracking-tight leading-none">{insights.healthScore}</span>
            </div>
          </div>
        </div>

        {/* At Risk Projects */}
        <div className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50/50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-rose-500" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5">At Risk</span>
              <span className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">{insights.atRiskProjects}</span>
            </div>
          </div>
        </div>

        {/* Weekly Velocity */}
        <div className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50/50 flex items-center justify-center flex-shrink-0">
              {insights.velocityTrend === 'up' ? (
                <TrendingUp className="h-5 w-5 text-blue-500" strokeWidth={2.5} />
              ) : (
                <TrendingDown className="h-5 w-5 text-blue-500" strokeWidth={2.5} />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5">Velocity</span>
              <div className="flex items-center gap-2 leading-none">
                <span className="text-[26px] font-bold text-slate-900 tracking-tight">{insights.weeklyVelocity}</span>
                <div className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-medium">
                  {insights.velocityTrend === 'up' ? '↑' : insights.velocityTrend === 'down' ? '↓' : '→'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottlenecks */}
        <div className="flex flex-col justify-center p-5 rounded-[20px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-50/50 flex items-center justify-center flex-shrink-0">
              <Target className="h-5 w-5 text-orange-400" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-500 mb-0.5">Bottlenecks</span>
              <span className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">
                {insights.hasBottleneck ? insights.bottleneckCount : 0}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* AI Recommendation Banner */}
      <div className={`mt-2 flex w-full items-center justify-between p-5 rounded-[20px] border ${insights.recommendationType === 'warning'
        ? 'bg-[#FEFCE8] border-[#FEF08A]'
        : insights.recommendationType === 'info'
          ? 'bg-[#F0FDF4] border-[#BBF7D0]'
          : 'bg-[#FEFCE8] border-[#FEF08A]'
        }`}>
        <div className="flex items-start gap-3.5">
          <Sparkles className={`h-[18px] w-[18px] mt-0.5 flex-shrink-0 ${insights.recommendationType === 'warning'
            ? 'text-orange-500 fill-orange-200'
            : insights.recommendationType === 'info'
              ? 'text-green-500 fill-green-200'
              : 'text-orange-500 fill-orange-200'
            }`} />
          <div className="flex flex-col">
            <span className="text-[14px] font-bold text-slate-900 tracking-tight leading-tight">AI Recommendation</span>
            <span className="text-[13px] font-medium text-slate-600 mt-1">{insights.recommendation}</span>
          </div>
        </div>
        <Link to={createPageUrl("ProjectInsights")} className="flex-shrink-0 ml-4">
          <Button size="sm" variant="outline" className="h-[34px] text-[13px] font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 px-5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            Analyze
          </Button>
        </Link>
      </div>
    </div>
  );
}
