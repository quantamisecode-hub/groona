import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  BarChart3
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ResourceUtilization({ users, tasks, timesheets, projects }) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter out clients based strictly on custom_role as requested
  // Using toLowerCase() to ensure case-insensitive matching (e.g., "Client", "client")
  const staffUsers = users.filter(u => u.custom_role?.toLowerCase() !== 'client');

  // Calculate user workload metrics
  const calculateUserMetrics = (user) => {
    // FIX: Correctly handle assigned_to as an array of emails
    const userTasks = tasks.filter(t => {
      if (!t.assigned_to) return false;
      if (Array.isArray(t.assigned_to)) {
        return t.assigned_to.includes(user.email);
      }
      // Fallback for legacy data where it might be a string
      return t.assigned_to === user.email;
    });

    const activeTasks = userTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const completedTasks = userTasks.filter(t => t.status === 'completed');

    // FIX: Split estimated hours among assignees to avoid inflating workload
    // If a 10h task is assigned to 2 people, they get 5h each, not 10h each.
    const totalEstimatedHours = activeTasks.reduce((sum, t) => {
      const assigneeCount = Array.isArray(t.assigned_to) ? t.assigned_to.length : 1;
      const count = assigneeCount > 0 ? assigneeCount : 1;
      return sum + ((t.estimated_hours || 0) / count);
    }, 0);

    // Calculate timesheet metrics
    const userTimesheets = timesheets.filter(ts => ts.user_email === user.email);
    const totalLoggedMinutes = userTimesheets.reduce((sum, ts) => sum + (ts.total_minutes || 0), 0);
    const totalLoggedHours = Math.round(totalLoggedMinutes / 60);

    // Calculate last 30 days activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTimesheets = userTimesheets.filter(ts =>
      ts.date && new Date(ts.date) >= thirtyDaysAgo
    );
    const recentLoggedMinutes = recentTimesheets.reduce((sum, ts) => sum + (ts.total_minutes || 0), 0);
    const recentLoggedHours = Math.round(recentLoggedMinutes / 60);

    // Workload status
    let workloadStatus = 'optimal';
    if (totalEstimatedHours > 80) workloadStatus = 'overloaded';
    else if (totalEstimatedHours > 50) workloadStatus = 'high';
    else if (totalEstimatedHours < 20) workloadStatus = 'underutilized';

    return {
      ...user,
      totalTasks: userTasks.length,
      activeTasks: activeTasks.length,
      activeTaskIds: activeTasks.map(t => t.id), // Store IDs for unique counting
      completedTasks: completedTasks.length,
      totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10, // Round to 1 decimal
      totalLoggedHours,
      recentLoggedHours,
      workloadStatus,
      taskCompletionRate: userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0,
    };
  };

  const userMetrics = staffUsers.map(calculateUserMetrics);

  // Filter users based on search
  const filteredUsers = userMetrics.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary statistics
  const overloadedUsers = userMetrics.filter(u => u.workloadStatus === 'overloaded').length;
  const underutilizedUsers = userMetrics.filter(u => u.workloadStatus === 'underutilized').length;

  // FIX: Calculate "Active Tasks" as unique tasks, not sum of assignments
  const allActiveTaskIds = new Set();
  userMetrics.forEach(u => {
    u.activeTaskIds.forEach(id => allActiveTaskIds.add(id));
  });
  const totalActiveTasks = allActiveTaskIds.size;

  // FIX: Calculate "Hours Logged" by summing minutes first to avoid rounding errors
  // Only include hours from staff members
  const staffEmails = new Set(staffUsers.map(u => u.email));
  const relevantTimesheets = timesheets.filter(ts => staffEmails.has(ts.user_email));
  const grandTotalMinutes = relevantTimesheets.reduce((sum, ts) => sum + (ts.total_minutes || 0), 0);
  const totalLoggedHours = Math.round(grandTotalMinutes / 60);

  // Workload distribution data
  const workloadDistribution = [
    { name: 'Overloaded', value: overloadedUsers, color: '#ef4444' },
    { name: 'High Load', value: userMetrics.filter(u => u.workloadStatus === 'high').length, color: '#f59e0b' },
    { name: 'Optimal', value: userMetrics.filter(u => u.workloadStatus === 'optimal').length, color: '#10b981' },
    { name: 'Underutilized', value: underutilizedUsers, color: '#3b82f6' },
  ];

  // Top performers by hours logged (last 30 days)
  const topPerformers = [...userMetrics]
    .sort((a, b) => b.recentLoggedHours - a.recentLoggedHours)
    .slice(0, 5)
    .map(u => ({
      name: u.full_name ? u.full_name.split(' ')[0] : u.email.split('@')[0],
      hours: u.recentLoggedHours,
    }));

  const getWorkloadBadge = (status) => {
    switch (status) {
      case 'overloaded':
        return <Badge className="bg-red-500">Overloaded</Badge>;
      case 'high':
        return <Badge className="bg-amber-500">High Load</Badge>;
      case 'optimal':
        return <Badge className="bg-emerald-500">Optimal</Badge>;
      case 'underutilized':
        return <Badge className="bg-blue-500">Underutilized</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Team</p>
                <p className="text-4xl font-black text-slate-900 leading-tight">{staffUsers.length}</p>
              </div>
              <Users className="h-12 w-12 text-blue-500/10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Overloaded</p>
                <p className="text-4xl font-black text-red-500 leading-tight">{overloadedUsers}</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-500/10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Tasks</p>
                <p className="text-4xl font-black text-emerald-500 leading-tight">{totalActiveTasks}</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-emerald-500/10" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Hours Logged</p>
                <p className="text-4xl font-black text-purple-500 leading-tight">{totalLoggedHours}</p>
              </div>
              <Clock className="h-12 w-12 text-purple-500/10" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Distribution */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem]">
          <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Workload Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pb-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 30, right: 50, bottom: 30, left: 50 }}>
                  <Pie
                    data={workloadDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 30;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      const pct = (percent * 100).toFixed(0);
                      const entry = workloadDistribution.find(d => d.name === name);
                      const color = entry?.color || '#6366f1';
                      return (
                        <text
                          x={x}
                          y={y}
                          fill={color}
                          fontSize={12}
                          fontWeight={700}
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                        >
                          {`${name}: ${pct}%`}
                        </text>
                      );
                    }}
                    labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  >
                    {workloadDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                    formatter={(value, name) => [`${value} tasks`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
          <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Top Performers (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPerformers} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar dataKey="hours" fill="#10b981" radius={[0, 10, 10, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload Overview */}
      <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30 py-6 px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                Team Workload Overview
              </CardTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-10">Capacity monitoring and resource allocation</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search team members by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm font-medium focus:ring-blue-500/20"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/10">
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="group bg-white border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-6 transition-all hover:shadow-md hover:border-slate-200">
                <div className="flex items-center gap-4 flex-1 w-full">
                  <Avatar className="h-14 w-14 border-4 border-slate-50 shadow-sm transition-transform group-hover:scale-105">
                    <AvatarImage src={user.profile_image_url} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <p className="font-black text-slate-900 text-base">{user.full_name}</p>
                      {getWorkloadBadge(user.workloadStatus)}
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 w-full md:w-auto px-4">
                  <div className="text-center min-w-[70px]">
                    <p className="text-2xl font-black text-slate-900 leading-none mb-1">{user.activeTasks}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Tasks</p>
                  </div>

                  <div className="text-center min-w-[70px]">
                    <p className="text-2xl font-black text-blue-600 leading-none mb-1">{user.totalEstimatedHours}<span className="text-xs ml-0.5">h</span></p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated</p>
                  </div>

                  <div className="text-center min-w-[70px]">
                    <p className="text-2xl font-black text-emerald-600 leading-none mb-1">{user.recentLoggedHours}<span className="text-xs ml-0.5">h</span></p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logged (30d)</p>
                  </div>

                  <div className="w-40 hidden lg:block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion</span>
                      <span className="text-xs font-black text-slate-900">{user.taskCompletionRate}%</span>
                    </div>
                    <Progress
                      value={user.taskCompletionRate}
                      className="h-2 rounded-full bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-indigo-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
              <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-800">No team members found</h3>
              <p className="text-slate-500 font-medium">Try searching for another name or email address.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
