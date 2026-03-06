import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, Calendar, Activity, Target, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";

export default function TimelinePrediction({ project, tasks, stories = [], activities = [], compact = false }) {
  const predictTimeline = () => {
    const now = startOfDay(new Date());

    // Calculate progress using Story Points for consistency
    const totalPoints = stories.reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
    const completedPoints = stories
      .filter(s => s.status === 'done')
      .reduce((sum, s) => sum + (parseInt(s.story_points) || 0), 0);
    const progress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;
    const completedTasks = completedPoints; // Using points as the "completed" metric for velocity
    const totalTasks = totalPoints;

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
      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-6 relative overflow-hidden transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-4 mb-6">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${statusStyle.bg} ${statusStyle.text} shadow-sm border ${statusStyle.border}`}>
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 tracking-normal text-lg leading-tight">Timeline Prediction</h3>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${statusStyle.text}`}>{prediction.estimatedDays} days from now</p>
          </div>
        </div>

        <div className="mb-6 flex flex-col justify-center">
          <p className="text-3xl font-black text-slate-900 tracking-normal">
            {format(prediction.predictedDate, 'MMM d, yyyy')}
          </p>
        </div>

        <div className="space-y-2 w-full">
          <div className="flex justify-between items-center w-full">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progress</span>
            <span className="text-sm font-black text-blue-600">{prediction.completionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prediction.completionRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-blue-600 rounded-full"
            />
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
            <h2 className="text-2xl font-black text-slate-900 tracking-normal">Advanced Timeline Prediction</h2>
            <p className="text-sm font-medium text-slate-500">Telemetry for <span className="text-blue-600 font-bold">{project.name}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Banner */}
        <div className={`rounded-[32px] ${statusStyle.bg} border border-2 ${statusStyle.border} p-8 flex flex-col relative overflow-hidden shadow-sm`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 w-full">
            <div className="flex items-center gap-6">
              <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/60 flex items-center justify-center border border-white backdrop-blur-sm shadow-sm flex-shrink-0 ${statusStyle.text}`}>
                <Calendar className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <div>
                <p className={`text-[11px] font-black uppercase tracking-widest ${statusStyle.text} opacity-80 mb-1`}>Predicted Completion Date</p>
                <p className={`text-4xl sm:text-5xl font-black tracking-normal ${statusStyle.text}`}>
                  {format(prediction.predictedDate, 'MMM d, yyyy')}
                </p>
                <p className="text-sm font-bold opacity-60 text-slate-700 mt-1">
                  {prediction.estimatedDays} days from now
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <Badge className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border shadow-none bg-white/60 backdrop-blur-sm ${statusStyle.text} ${statusStyle.border}`}>
                {prediction.status.replace('-', ' ')}
              </Badge>
              <div className="w-full md:w-48 space-y-1">
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${statusStyle.text} opacity-80`}>Confidence:</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${statusStyle.text} opacity-80`}>{prediction.confidence}</span>
                </div>
                <div className="w-full bg-white/40 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.confidenceScore}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className={`h-full ${statusStyle.text.replace('text', 'bg')} rounded-full`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 relative z-10 w-full">
            <div className={`w-full p-4 rounded-2xl bg-white/70 border backdrop-blur-md shadow-sm ${statusStyle.border}`}>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-current opacity-60"></span>
                {prediction.message}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Current Velocity</p>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-5xl font-black tracking-normal text-blue-600">{prediction.velocity}</p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">tasks per day (weighted avg)</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trend:</p>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${prediction.velocityTrend === 'accelerating' ? 'bg-green-50 text-green-600' :
                prediction.velocityTrend === 'decelerating' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}>
                {prediction.velocityTrend}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Activity className="h-5 w-5 text-purple-600" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Completion Rate</p>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-5xl font-black tracking-normal text-purple-600">{prediction.completionRate}<span className="text-2xl">%</span></p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">of tasks completed</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Velocity:</p>
              <span className="text-xs font-bold text-slate-700">{prediction.recentWeekVelocity} tasks/week</span>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Target className="h-5 w-5 text-green-600" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Confidence</p>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-5xl font-black tracking-normal text-green-600 capitalize">{prediction.confidence}</p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{prediction.confidenceScore}% accurate</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <Progress value={prediction.confidenceScore} className="h-2 bg-slate-100 [&>div]:bg-green-500" />
            </div>
          </div>
        </div>

        {/* Detailed Velocity Analysis */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-sm">
          <h4 className="font-black text-slate-900 text-sm mb-6 uppercase tracking-widest">Velocity Analysis</h4>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Recent Velocity (Last 30 days)</p>
              <div className="flex items-center gap-4">
                <p className="text-3xl font-black tracking-normal text-slate-900">{prediction.recentVelocity} <span className="text-base font-bold text-slate-500 tracking-normal">tasks/day</span></p>
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 font-bold">
                  {prediction.velocityTrend === 'accelerating' ? '↑' : prediction.velocityTrend === 'decelerating' ? '↓' : '→'}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Overall Project Velocity</p>
              <p className="text-3xl font-black tracking-normal text-slate-900">{prediction.overallVelocity} <span className="text-base font-bold text-slate-500 tracking-normal">tasks/day</span></p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Current Progress</span>
              <span className="text-sm font-black text-slate-900">{prediction.completionRate}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${prediction.completionRate}%` }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                className="h-full bg-blue-200 rounded-full"
              />
            </div>
          </div>
        </div>

        {project.deadline && (
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Original Deadline</p>
                <p className="text-2xl font-black tracking-normal text-slate-900">
                  {format(new Date(project.deadline), 'MMM d, yyyy')}
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {differenceInDays(new Date(project.deadline), new Date())} days remaining
                </p>
              </div>
              <div className="space-y-2 pt-6 md:pt-0 md:border-l md:border-slate-100 md:pl-8">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Schedule Buffer</p>
                <p className={`text-2xl font-black tracking-normal ${prediction.daysBuffer < 0 ? 'text-red-500' :
                  prediction.daysBuffer < 7 ? 'text-amber-500' : 'text-green-500'
                  }`}>
                  {prediction.daysBuffer >= 0 ? '+' : ''}{prediction.daysBuffer} <span className="text-base font-bold tracking-normal opacity-80">days</span>
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {prediction.daysBuffer < 0 ? 'Behind schedule' : 'Ahead of schedule'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50/50 rounded-[32px] p-6 sm:p-8 border border-blue-100 flex flex-col sm:flex-row gap-6 items-start">
          <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center border border-blue-200 shadow-sm flex-shrink-0">
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 space-y-4">
            <p className="font-black text-slate-900 text-base uppercase tracking-widest text-sm">Prediction Method</p>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              This prediction uses a heavily weighted algorithmic ensemble combining:
            </p>
            <ul className="text-sm font-medium text-slate-600 space-y-2">
              <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-400" /> <span className="font-bold text-slate-800">Recent velocity (50%)</span> - output logged in last 30 days</li>
              <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-300" /> <span className="font-bold text-slate-800">Overall velocity (30%)</span> - lifetime project completion rate</li>
              <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-200" /> <span className="font-bold text-slate-800">Progress rate (20%)</span> - standard % completion per day</li>
            </ul>
            <div className="mt-4 p-4 rounded-2xl bg-white border border-blue-100 shadow-sm">
              <p className="text-xs font-bold text-slate-500">
                {prediction.confidence === 'high'
                  ? 'Engine Status: High confidence due to robust recent activity and sufficient historical data points.'
                  : prediction.confidence === 'medium'
                    ? 'Engine Status: Medium confidence - moderate recent activity with limited historical data context.'
                    : 'Engine Status: Low confidence - sparse activity data. Increase workflow telemetry for higher accuracy.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}