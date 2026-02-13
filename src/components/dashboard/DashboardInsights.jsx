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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Health Score */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${healthBg} shadow-lg flex-shrink-0`}>
                <Target className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-600 mb-1">Health Score</p>
                <p className={`text-2xl font-bold ${healthColor}`}>{insights.healthScore}</p>
              </div>
            </div>
          </div>

          {/* At Risk Projects */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-600 mb-1">At Risk</p>
                <p className="text-2xl font-bold text-slate-900">{insights.atRiskProjects}</p>
              </div>
            </div>
          </div>

          {/* Weekly Velocity */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                {insights.velocityTrend === 'up' ? (
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-600 mb-1">Weekly Velocity</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-slate-900">{insights.weeklyVelocity}</p>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {insights.velocityTrend === 'up' ? '↑' : insights.velocityTrend === 'down' ? '↓' : '→'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Bottlenecks */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg flex-shrink-0 ${insights.hasBottleneck ? 'bg-amber-100' : 'bg-green-100'}`}>
                <Target className={`h-5 w-5 ${insights.hasBottleneck ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-600 mb-1">Bottlenecks</p>
                <p className="text-2xl font-bold text-slate-900">
                  {insights.hasBottleneck ? insights.bottleneckCount : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className={`p-3 sm:p-4 rounded-xl border-2 ${
          insights.recommendationType === 'warning' 
            ? 'bg-amber-50 border-amber-200' 
            : insights.recommendationType === 'info'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Sparkles className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              insights.recommendationType === 'warning' 
                ? 'text-amber-600' 
                : insights.recommendationType === 'info'
                ? 'text-blue-600'
                : 'text-green-600'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 mb-1 text-sm sm:text-base">AI Recommendation</p>
              <p className="text-xs sm:text-sm text-slate-700 break-words">{insights.recommendation}</p>
            </div>
            <Link to={createPageUrl("ProjectInsights")} className="w-full sm:w-auto">
              <Button size="sm" variant="outline" className="border-slate-300 w-full sm:w-auto">
                Analyze
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
