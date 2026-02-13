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
    <div className="space-y-6">
      {/* System Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Task Completion</p>
                {taskCompletionRate >= 70 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{taskCompletionRate}%</p>
              <Progress value={taskCompletionRate} className="h-2" />
              <p className="text-xs text-slate-500">{completedTasks} of {totalTasks} tasks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Project Completion</p>
                {projectCompletionRate >= 50 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{projectCompletionRate}%</p>
              <Progress value={projectCompletionRate} className="h-2" />
              <p className="text-xs text-slate-500">{completedProjects} of {totalProjects} projects</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Overdue Items</p>
                <AlertTriangle className={`h-4 w-4 ${overdueTasks > 5 ? 'text-red-600' : 'text-amber-600'}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{overdueTasks}</p>
              <Badge variant={overdueTasks > 5 ? "destructive" : "outline"} className="text-xs">
                {overdueTasks > 5 ? 'Needs Attention' : 'Under Control'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">High Priority</p>
                <Target className={`h-4 w-4 ${highPriorityTasks > 10 ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{highPriorityTasks}</p>
              <Badge variant="outline" className="text-xs">
                Active items
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-600" />
              Project Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Status Distribution */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={taskStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trends */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Activity Trends (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="activities" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                name="Total Activities"
              />
              <Line 
                type="monotone" 
                dataKey="tasks" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Task Activities"
              />
              <Line 
                type="monotone" 
                dataKey="projects" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Project Activities"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resource Status Cards - UPDATED SECTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tenant && (
          <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Storage Usage</p>
                  <Database className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{storageUsagePercent}%</p>
                  <Progress 
                    value={storageUsagePercent} 
                    className={`h-2 mt-2 ${storageUsagePercent > 80 ? '[&>div]:bg-red-500' : storageUsagePercent > 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`} 
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {currentStorage.toFixed(3)} GB of {maxStorage} GB used
                  </p>
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                      Storage Breakdown
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Baseline:</span>
                        <span>{DEFAULT_BASELINE_GB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Files ({files.length}):</span>
                        <span>{filesStorageGB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Documents ({documents.length}):</span>
                        <span>{documentsStorageGB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Projects ({projects.length}):</span>
                        <span>{projectsStorageGB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tasks ({tasks.length}):</span>
                        <span>{tasksStorageGB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sprints ({sprints.length}):</span>
                        <span>{sprintsStorageGB.toFixed(3)} GB</span>
                      </div>
                      {chatMessages.length > 0 && (
                        <div className="flex justify-between">
                          <span>Chat Messages ({chatMessages.length}):</span>
                          <span>{chatStorageGB.toFixed(3)} GB</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Activities ({activities.length}):</span>
                        <span>{activitiesStorageGB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Timesheets ({timesheets.length}):</span>
                        <span>{timesheetsStorageGB.toFixed(3)} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Users ({users.length}):</span>
                        <span>{usersStorageGB.toFixed(3)} GB</span>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Active Sprints</p>
                <Target className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{activeSprints}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {sprints.length} total sprints
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Team Capacity</p>
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{users.length}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {adminCount} admins, {memberCount} members
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

