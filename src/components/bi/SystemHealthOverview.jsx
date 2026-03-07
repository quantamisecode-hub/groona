import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Database,
  Users,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Custom label component that only shows non-zero values
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  // Only render label if percentage is greater than 0
  if (percent === 0) return null;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#334155"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-sm font-medium"
    >
      {`${name}: ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function SystemHealthOverview({ projects, tasks, users, tenant, activities, timesheets, sprints = [] }) {
  const effectiveTenantId = tenant?.id || tenant?._id;

  // Fetch all files for the tenant to calculate storage
  const { data: files = [] } = useQuery({
    queryKey: ['all-project-files', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.ProjectFile.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!effectiveTenantId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  // Fetch all documents for storage calculation
  const { data: documents = [] } = useQuery({
    queryKey: ['all-documents', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Document.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!effectiveTenantId,
    staleTime: 60 * 1000,
  });

  // Fetch chat messages for storage calculation (if entity exists)
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['all-chat-messages', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      try {
        // Check if ChatMessage entity exists
        if (groonabackend.entities.ChatMessage) {
          return groonabackend.entities.ChatMessage.filter({ tenant_id: effectiveTenantId });
        }
        return [];
      } catch (error) {
        // Chat messages entity might not exist, return empty array
        console.debug('[SystemHealthOverview] ChatMessage entity not available:', error);
        return [];
      }
    },
    enabled: !!effectiveTenantId && !!groonabackend.entities.ChatMessage,
    staleTime: 60 * 1000,
    retry: false, // Don't retry if entity doesn't exist
  });
  // Calculate project status distribution
  const projectStatusData = [
    { name: 'Planning', value: projects.filter(p => p.status === 'planning').length, color: '#94a3b8' },
    { name: 'Active', value: projects.filter(p => p.status === 'active').length, color: '#3b82f6' },
    { name: 'On Hold', value: projects.filter(p => p.status === 'on_hold').length, color: '#f59e0b' },
    { name: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#10b981' },
  ];

  // Calculate task status distribution
  const taskStatusData = [
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: '#64748b' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Review', value: tasks.filter(t => t.status === 'review').length, color: '#f59e0b' },
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: '#10b981' },
  ];

  // Calculate activity trends (last 7 days)
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const activityTrends = last7Days.map(date => {
    const dayActivities = activities.filter(a =>
      a.created_date && a.created_date.split('T')[0] === date
    );
    return {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      activities: dayActivities.length,
      tasks: dayActivities.filter(a => a.entity_type === 'task').length,
      projects: dayActivities.filter(a => a.entity_type === 'project').length,
    };
  });

  // Calculate completion rates
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const projectCompletionRate = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

  // === CORRECTED DATA CALCULATIONS ===

  // 1. Storage Usage: Calculate from all tenant data sources
  const maxStorage = tenant?.max_storage_gb || 5;

  // Calculate actual storage usage
  // Default baseline: 100MB (0.1 GB)
  const DEFAULT_BASELINE_GB = 0.1;

  // Calculate file storage (in bytes, convert to GB)
  const filesStorageBytes = files.reduce((sum, file) => sum + (Number(file.file_size) || 0), 0);
  const filesStorageGB = filesStorageBytes / (1024 * 1024 * 1024); // Convert bytes to GB

  // Estimate storage for other entities
  // Documents: Estimate 50KB per document (content + metadata)
  const documentsStorageBytes = documents.length * 50 * 1024;
  const documentsStorageGB = documentsStorageBytes / (1024 * 1024 * 1024);

  // Projects: Estimate 10KB per project (metadata, logo URL, etc.)
  const projectsStorageBytes = projects.length * 10 * 1024;
  const projectsStorageGB = projectsStorageBytes / (1024 * 1024 * 1024);

  // Tasks: Estimate 5KB per task (description, metadata, attachments refs)
  const tasksStorageBytes = tasks.length * 5 * 1024;
  const tasksStorageGB = tasksStorageBytes / (1024 * 1024 * 1024);

  // Sprints: Estimate 2KB per sprint (metadata)
  const sprintsStorageBytes = sprints.length * 2 * 1024;
  const sprintsStorageGB = sprintsStorageBytes / (1024 * 1024 * 1024);

  // Chat messages: Estimate 1KB per message (message content + metadata)
  const chatStorageBytes = chatMessages.length * 1024;
  const chatStorageGB = chatStorageBytes / (1024 * 1024 * 1024);

  // Activities: Estimate 0.5KB per activity (metadata)
  const activitiesStorageBytes = activities.length * 512;
  const activitiesStorageGB = activitiesStorageBytes / (1024 * 1024 * 1024);

  // Timesheets: Estimate 0.5KB per timesheet (metadata)
  const timesheetsStorageBytes = timesheets.length * 512;
  const timesheetsStorageGB = timesheetsStorageBytes / (1024 * 1024 * 1024);

  // Users: Estimate 2KB per user (profile data, metadata)
  const usersStorageBytes = users.length * 2 * 1024;
  const usersStorageGB = usersStorageBytes / (1024 * 1024 * 1024);

  // Total calculated storage
  const calculatedStorageGB =
    DEFAULT_BASELINE_GB +
    filesStorageGB +
    documentsStorageGB +
    projectsStorageGB +
    tasksStorageGB +
    sprintsStorageGB +
    chatStorageGB +
    activitiesStorageGB +
    timesheetsStorageGB +
    usersStorageGB;

  // Use calculated storage or fall back to tenant's stored value
  const currentStorage = calculatedStorageGB > 0 ? calculatedStorageGB : (tenant?.current_storage_gb || DEFAULT_BASELINE_GB);

  const storageUsagePercent = maxStorage > 0
    ? Math.min(Math.round((currentStorage / maxStorage) * 100), 100)
    : 0;

  // 2. Active Sprints: Ensure case insensitivity and handle potential undefined status
  const activeSprints = sprints.filter(s => s.status?.toLowerCase() === 'active').length;

  // 3. Team Capacity: Correctly categorize roles (Owner/Admin vs Others)
  const adminCount = users.filter(u =>
    ['owner', 'admin'].includes(u.role) || u.is_super_admin
  ).length;
  // Everyone else is considered a team member (members, managers, viewers, etc.)
  const memberCount = Math.max(0, users.length - adminCount);

  // Calculate overdue tasks
  const overdueTasks = tasks.filter(t =>
    t.due_date &&
    new Date(t.due_date) < new Date() &&
    t.status !== 'completed'
  ).length;

  // Calculate high priority items
  const highPriorityTasks = tasks.filter(t =>
    (t.priority === 'high' || t.priority === 'urgent') &&
    t.status !== 'completed'
  ).length;

  return (
    <div className="space-y-8">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Task Completion */}
        <Card className="bg-white border text-slate-900 border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Task Completion</p>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black text-slate-900 leading-none">{taskCompletionRate}%</p>
                <Progress value={taskCompletionRate} className="h-2 bg-blue-50 [&>div]:bg-blue-600 rounded-full" />
                <p className="text-xs font-bold text-slate-400">{completedTasks} of {totalTasks} tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Completion */}
        <Card className="bg-white border text-slate-900 border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Project Completion</p>
                <TrendingDown className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black text-slate-900 leading-none">{projectCompletionRate}%</p>
                <Progress value={projectCompletionRate} className="h-2 bg-blue-50 [&>div]:bg-blue-600 rounded-full" />
                <p className="text-xs font-bold text-slate-400">{completedProjects} of {totalProjects} projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Items */}
        <Card className="bg-white border text-slate-900 border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Overdue Items</p>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="space-y-3">
                <p className="text-3xl font-black text-slate-900 leading-none">{overdueTasks}</p>
                <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/15 border-none font-black text-[10px] uppercase tracking-wider py-1 rounded-lg">
                  Needs Attention
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* High Priority */}
        <Card className="bg-white border text-slate-900 border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[2rem] transition-all hover:shadow-lg hover:-translate-y-1 duration-300">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">High Priority</p>
                <Target className="h-4 w-4 text-slate-300" />
              </div>
              <div className="space-y-3">
                <p className="text-3xl font-black text-slate-900 leading-none">{highPriorityTasks}</p>
                <Badge variant="outline" className="text-slate-500 border-slate-200 font-black text-[10px] uppercase tracking-wider py-1 rounded-lg">
                  Active items
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
          <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
            <FolderKanban className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Project Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={renderCustomLabel}
                    labelLine={true}
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Task Status Distribution */}
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
          <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trends */}
      <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center gap-2 space-y-0">
          <Activity className="h-4 w-4 text-purple-600" />
          <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-tight">Activity Trends (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityTrends} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="activities"
                  name="Total Activities"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="tasks"
                  name="Task Activities"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="projects"
                  name="Project Activities"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Resource & Team Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem]">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Storage Usage</p>
                <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Database className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-black text-slate-900 leading-none">{storageUsagePercent}%</p>
                  <p className="text-xs font-bold text-slate-400">
                    {currentStorage.toFixed(1)}GB / {maxStorage}GB
                  </p>
                </div>
                <Progress
                  value={storageUsagePercent}
                  className={`h-2 rounded-full ${storageUsagePercent > 80 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-600'}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem]">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Sprints</p>
                <div className="h-8 w-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-none">{activeSprints}</p>
                <p className="text-xs font-bold text-slate-400 mt-2">{sprints.length} Total Sprints</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem]">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Team Stats</p>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-none">{users.length}</p>
                <p className="text-xs font-bold text-slate-400 mt-2">
                  {adminCount} Admins · {memberCount} Members
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

