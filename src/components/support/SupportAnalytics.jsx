import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { AlertCircle, CheckCircle2, Clock, TrendingUp } from "lucide-react";

export default function SupportAnalytics({ tickets }) {
  // Status distribution
  const statusData = [
    { name: 'Open', value: tickets.filter(t => t.status === 'open').length, color: '#3b82f6' },
    { name: 'In Progress', value: tickets.filter(t => t.status === 'in_progress').length, color: '#8b5cf6' },
    { name: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, color: '#10b981' },
    { name: 'Closed', value: tickets.filter(t => t.status === 'closed').length, color: '#64748b' },
  ].filter(d => d.value > 0);

  // Priority distribution
  const priorityData = [
    { name: 'Critical', value: tickets.filter(t => t.priority === 'critical').length },
    { name: 'High', value: tickets.filter(t => t.priority === 'high').length },
    { name: 'Medium', value: tickets.filter(t => t.priority === 'medium').length },
    { name: 'Low', value: tickets.filter(t => t.priority === 'low').length },
  ];

  // Category distribution
  const categoryData = tickets.reduce((acc, ticket) => {
    const cat = ticket.category || 'other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }));

  // Calculate metrics
  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => ['open', 'in_progress', 'reopened'].includes(t.status)).length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolutionTime = tickets
    .filter(t => t.resolution_time_minutes)
    .reduce((sum, t) => sum + t.resolution_time_minutes, 0) / 
    (tickets.filter(t => t.resolution_time_minutes).length || 1);

  // Trend data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const trendData = last7Days.map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    created: tickets.filter(t => t.created_date?.startsWith(date)).length,
    resolved: tickets.filter(t => t.resolved_at?.startsWith(date)).length,
  }));

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Tickets</p>
                <p className="text-3xl font-bold text-slate-900">{totalTickets}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Open Tickets</p>
                <p className="text-3xl font-bold text-orange-600">{openTickets}</p>
              </div>
              <Clock className="h-10 w-10 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Resolved</p>
                <p className="text-3xl font-bold text-green-600">{resolvedTickets}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Avg Resolution</p>
                <p className="text-3xl font-bold text-purple-600">
                  {Math.round(avgResolutionTime / 60)}h
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryChartData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trend (Last 7 Days) */}
        <Card>
          <CardHeader>
            <CardTitle>7-Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="created" stroke="#3b82f6" name="Created" />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}