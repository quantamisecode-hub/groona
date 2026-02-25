import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, Calendar, Activity, Target, Zap } from "lucide-react";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";

export default function TimelinePrediction({ project, tasks, activities = [], compact = false }) {
  const predictTimeline = () => {
    const now = startOfDay(new Date());
    const progress = project.progress || 0;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    
    // Calculate completion velocity using multiple methods
    
    // Method 1: Recent velocity (last 30 days)
    const last30Days = activities.filter(a => {
      const activityDate = new Date(a.created_date);
      const daysDiff = differenceInDays(now, activityDate);
      return daysDiff <= 30 && a.action === 'completed' && a.entity_type === 'task';
    });
    const recentVelocity = last30Days.length / 30; // tasks per day

    // Method 2: Overall project velocity
    const projectStartDate = project.created_date ? new Date(project.created_date) : addDays(now, -30);
    const daysInProject = Math.max(1, differenceInDays(now, projectStartDate));
    const overallVelocity = completedTasks / daysInProject;

    // Method 3: Progress-based velocity
    const progressRate = progress / daysInProject; // % per day
    
    // Weighted average velocity (favor recent performance)
    const velocity = (recentVelocity * 0.5) + (overallVelocity * 0.3) + (progressRate * 0.2);
    
    // Calculate remaining work
    const remainingTasks = totalTasks - completedTasks;
    const remainingProgress = 100 - progress;

    // Predictions using different methods
    const taskBasedDays = velocity > 0 ? Math.ceil(remainingTasks / velocity) : remainingTasks * 2;
    const progressBasedDays = progressRate > 0 ? Math.ceil(remainingProgress / progressRate) : 60;
    
    // Smart weighted prediction (consider both task count and progress)
    let estimatedDays;
    if (remainingTasks === 0 && progress >= 100) {
      estimatedDays = 0;
    } else if (velocity > 0 && progressRate > 0) {
      // Weighted average favoring the method with more recent data
      estimatedDays = Math.ceil((taskBasedDays * 0.6 + progressBasedDays * 0.4));
    } else if (velocity > 0) {
      estimatedDays = taskBasedDays;
    } else if (progressRate > 0) {
      estimatedDays = progressBasedDays;
    } else {
      // Fallback: estimate based on remaining tasks
      estimatedDays = remainingTasks * 2;
    }

    const predictedDate = addDays(now, estimatedDays);
    
    // Calculate confidence level
    let confidence = 'low';
    let confidenceScore = 0;
    
    if (last30Days.length >= 10) {
      confidence = 'high';
      confidenceScore = 90;
    } else if (last30Days.length >= 5) {
      confidence = 'medium';
      confidenceScore = 65;
    } else {
      confidence = 'low';
      confidenceScore = 40;
    }

    // Compare with deadline if exists
    let status = 'on-track';
    let message = 'Project is progressing well';
    let daysBuffer = 0;
    
    if (project.deadline) {
      const deadline = new Date(project.deadline);
      const daysUntilDeadline = differenceInDays(deadline, now);
      daysBuffer = daysUntilDeadline - estimatedDays;
      
      if (daysBuffer < -7) {
        status = 'critical';
        message = `Predicted to finish ${Math.abs(daysBuffer)} days after deadline - immediate action required`;
      } else if (daysBuffer < 0) {
        status = 'at-risk';
        message = `Predicted to finish ${Math.abs(daysBuffer)} days after deadline`;
      } else if (daysBuffer < 3) {
        status = 'tight';
        message = `Very tight timeline with only ${daysBuffer} days buffer`;
      } else if (daysBuffer < 7) {
        status = 'moderate';
        message = `Moderate buffer of ${daysBuffer} days before deadline`;
      } else {
        status = 'on-track';
        message = `Comfortable ${daysBuffer} days buffer before deadline`;
      }
    }

    // Velocity trend analysis
    const last7Days = activities.filter(a => {
      const activityDate = new Date(a.created_date);
      const daysDiff = differenceInDays(now, activityDate);
      return daysDiff <= 7 && a.action === 'completed' && a.entity_type === 'task';
    });
    
    const last14To7Days = activities.filter(a => {
      const activityDate = new Date(a.created_date);
      const daysDiff = differenceInDays(now, activityDate);
      return daysDiff > 7 && daysDiff <= 14 && a.action === 'completed' && a.entity_type === 'task';
    });

    const recentWeekVelocity = last7Days.length;
    const previousWeekVelocity = last14To7Days.length;
    let velocityTrend = 'stable';
    
    if (recentWeekVelocity > previousWeekVelocity * 1.2) {
      velocityTrend = 'accelerating';
    } else if (recentWeekVelocity < previousWeekVelocity * 0.8) {
      velocityTrend = 'decelerating';
    }

    return {
      predictedDate,
      estimatedDays,
      velocity: velocity.toFixed(2),
      recentVelocity: recentVelocity.toFixed(2),
      overallVelocity: overallVelocity.toFixed(2),
      status,
      message,
      confidence,
      confidenceScore,
      daysBuffer,
      completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : 0,
      velocityTrend,
      recentWeekVelocity,
      previousWeekVelocity,
    };
  };

  const prediction = predictTimeline();

  const statusColors = {
    'critical': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    'at-risk': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    'tight': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'moderate': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'on-track': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  };

  const statusStyle = statusColors[prediction.status];

  if (compact) {
    return (
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Timeline Prediction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`p-4 rounded-xl ${statusStyle.bg} border ${statusStyle.border}`}>
            <div className="flex items-center gap-3">
              <Calendar className={`h-8 w-8 ${statusStyle.text}`} />
              <div>
                <p className="text-sm text-slate-600 mb-1">Estimated Completion</p>
                <p className="text-lg font-bold text-slate-900">
                  {format(prediction.predictedDate, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {prediction.estimatedDays} days from now
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-semibold">{prediction.completionRate}%</span>
            </div>
            <Progress value={parseInt(prediction.completionRate)} className="h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Advanced Timeline Prediction: {project.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={`p-6 rounded-xl ${statusStyle.bg} border-2 ${statusStyle.border}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Calendar className={`h-12 w-12 ${statusStyle.text}`} />
              <div>
                <p className="text-sm font-medium text-slate-600">Predicted Completion Date</p>
                <p className="text-3xl font-bold text-slate-900">
                  {format(prediction.predictedDate, 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {prediction.estimatedDays} days from now
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border text-sm px-3 py-1 mb-2`}>
                {prediction.status.replace('-', ' ').toUpperCase()}
              </Badge>
              <p className="text-xs text-slate-600">Confidence: {prediction.confidence}</p>
              <Progress value={prediction.confidenceScore} className="w-24 h-2 mt-1" />
            </div>
          </div>

          <div className={`p-4 rounded-lg bg-white/70 border ${statusStyle.border}`}>
            <p className="text-sm font-medium text-slate-900">{prediction.message}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <p className="font-semibold text-slate-900">Current Velocity</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{prediction.velocity}</p>
            <p className="text-xs text-slate-600">tasks per day (weighted avg)</p>
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-xs text-slate-600">Trend: 
                <span className={`font-semibold ml-1 ${
                  prediction.velocityTrend === 'accelerating' ? 'text-green-600' : 
                  prediction.velocityTrend === 'decelerating' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {prediction.velocityTrend}
                </span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-purple-600" />
              <p className="font-semibold text-slate-900">Completion Rate</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{prediction.completionRate}%</p>
            <p className="text-xs text-slate-600">of tasks completed</p>
            <div className="mt-2 pt-2 border-t border-purple-200">
              <p className="text-xs text-slate-600">
                Recent: {prediction.recentWeekVelocity} tasks/week
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-5 w-5 text-green-600" />
              <p className="font-semibold text-slate-900">Confidence</p>
            </div>
            <p className="text-2xl font-bold text-green-600 capitalize">{prediction.confidence}</p>
            <p className="text-xs text-slate-600">{prediction.confidenceScore}% accurate</p>
            <div className="mt-2 pt-2 border-t border-green-200">
              <Progress value={prediction.confidenceScore} className="h-2" />
            </div>
          </div>
        </div>

        {/* Detailed Velocity Analysis */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-3">Velocity Analysis</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Recent Velocity (Last 30 days)</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-slate-900">{prediction.recentVelocity} tasks/day</p>
                <Badge variant="outline" className="text-xs">
                  {prediction.velocityTrend === 'accelerating' ? '↑' : prediction.velocityTrend === 'decelerating' ? '↓' : '→'}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-2">Overall Project Velocity</p>
              <p className="text-lg font-bold text-slate-900">{prediction.overallVelocity} tasks/day</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700">Current Progress</span>
            <span className="text-sm font-bold text-slate-900">{project.progress || 0}%</span>
          </div>
          <Progress value={project.progress || 0} className="h-3" />
        </div>

        {project.deadline && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Original Deadline</p>
                <p className="font-semibold text-slate-900 text-lg">
                  {format(new Date(project.deadline), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {differenceInDays(new Date(project.deadline), new Date())} days remaining
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Schedule Buffer</p>
                <p className={`font-semibold text-lg ${
                  prediction.daysBuffer < 0 ? 'text-red-600' : 
                  prediction.daysBuffer < 7 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {prediction.daysBuffer >= 0 ? '+' : ''}{prediction.daysBuffer} days
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {prediction.daysBuffer < 0 ? 'Behind schedule' : 'Ahead of schedule'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 mb-2">Prediction Method</p>
              <p className="text-sm text-slate-700 mb-2">
                This prediction uses a weighted algorithm combining:
              </p>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• Recent velocity (50%) - tasks completed in last 30 days</li>
                <li>• Overall velocity (30%) - project-wide completion rate</li>
                <li>• Progress rate (20%) - percentage completion per day</li>
              </ul>
              <p className="text-xs text-slate-600 mt-3">
                {prediction.confidence === 'high' 
                  ? 'High confidence due to consistent recent activity and sufficient data points.' 
                  : prediction.confidence === 'medium'
                  ? 'Medium confidence - some recent activity but limited historical data.'
                  : 'Low confidence - limited activity data. Increase team activity for more accurate predictions.'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}