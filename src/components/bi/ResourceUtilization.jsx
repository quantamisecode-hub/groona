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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Team</p>
                <p className="text-3xl font-bold text-slate-900">{staffUsers.length}</p>
              </div>
              <Users className="h-10 w-10 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Overloaded</p>
                <p className="text-3xl font-bold text-red-600">{overloadedUsers}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Active Tasks</p>
                <p className="text-3xl font-bold text-emerald-600">{totalActiveTasks}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-emerald-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Hours Logged</p>
                <p className="text-3xl font-bold text-purple-600">{totalLoggedHours}</p>
              </div>
              <Clock className="h-10 w-10 text-purple-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Distribution */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Workload Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={workloadDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {workloadDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Top Performers (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topPerformers} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="name" type="category" stroke="#64748b" width={80} />
                <Tooltip />
                <Bar dataKey="hours" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Team Workload Overview
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:bg-slate-50/50 transition-colors">
                <Avatar className="h-12 w-12 border-2 border-slate-200">
                  <AvatarImage src={user.profile_image_url} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 truncate">{user.full_name}</p>
                    {user.role === 'admin' && (
                      <Badge variant="outline" className="text-xs">Admin</Badge>
                    )}
                    {getWorkloadBadge(user.workloadStatus)}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{user.email}</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{user.activeTasks}</p>
                    <p className="text-xs text-slate-500">Active Tasks</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{user.totalEstimatedHours}h</p>
                    <p className="text-xs text-slate-500">Estimated</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{user.recentLoggedHours}h</p>
                    <p className="text-xs text-slate-500">Logged (30d)</p>
                  </div>

                  <div className="w-32 hidden md:block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">Completion</span>
                      <span className="text-xs font-semibold text-slate-900">{user.taskCompletionRate}%</span>
                    </div>
                    <Progress value={user.taskCompletionRate} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No team members found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
