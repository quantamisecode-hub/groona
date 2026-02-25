import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, CheckCircle2, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f97316'];

export default function ReportVisualization({ timesheets, visualization, onVisualizationChange, projects, users, isLoading }) {
  const updateVisualization = (key, value) => {
    onVisualizationChange({ ...visualization, [key]: value });
  };

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalHours = timesheets.reduce((sum, t) => sum + ((t.total_minutes || 0) / 60), 0);
    const billableHours = timesheets.filter(t => t.is_billable).reduce((sum, t) => sum + ((t.total_minutes || 0) / 60), 0);
    const totalAmount = timesheets.reduce((sum, t) => {
      if (t.is_billable && t.hourly_rate) {
        return sum + ((t.total_minutes || 0) / 60 * t.hourly_rate);
      }
      return sum;
    }, 0);
    const approvedCount = timesheets.filter(t => t.status === 'approved').length;

    return {
      totalHours: totalHours.toFixed(1),
      billableHours: billableHours.toFixed(1),
      totalAmount: totalAmount.toFixed(2),
      approvedCount,
      totalEntries: timesheets.length,
    };
  }, [timesheets]);

  // Process data based on grouping
  const chartData = useMemo(() => {
    if (timesheets.length === 0) return [];

    const grouped = {};

    timesheets.forEach(timesheet => {
      let key;
      let label;

      switch (visualization.group_by) {
        case 'project':
          key = timesheet.project_id || 'unassigned';
          label = timesheet.project_name || 'Unassigned';
          break;
        case 'user':
          key = timesheet.user_email || 'unknown';
          label = timesheet.user_name || timesheet.user_email || 'Unknown';
          break;
        case 'date':
          key = timesheet.date;
          label = format(new Date(timesheet.date), 'MMM d');
          break;
        case 'task_type':
          key = timesheet.work_type || 'other';
          label = (timesheet.work_type || 'other').charAt(0).toUpperCase() + (timesheet.work_type || 'other').slice(1);
          break;
        default:
          key = 'total';
          label = 'Total';
      }

      if (!grouped[key]) {
        grouped[key] = {
          name: label,
          hours: 0,
          billableHours: 0,
          amount: 0,
          entries: 0,
        };
      }

      const hours = (timesheet.total_minutes || 0) / 60;
      grouped[key].hours += hours;
      grouped[key].entries += 1;
      
      if (timesheet.is_billable) {
        grouped[key].billableHours += hours;
        if (timesheet.hourly_rate) {
          grouped[key].amount += hours * timesheet.hourly_rate;
        }
      }
    });

    return Object.values(grouped).map(item => ({
      ...item,
      hours: parseFloat(item.hours.toFixed(2)),
      billableHours: parseFloat(item.billableHours.toFixed(2)),
      amount: parseFloat(item.amount.toFixed(2)),
    })).sort((a, b) => b.hours - a.hours);
  }, [timesheets, visualization.group_by]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[400px] flex items-center justify-center text-slate-500">
          Loading data...
        </div>
      );
    }

    if (chartData.length === 0) {
      return (
        <div className="h-[400px] flex items-center justify-center text-slate-500">
          No data available for the selected filters
        </div>
      );
    }

    switch (visualization.chart_type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#3b82f6" name="Total Hours" />
              <Bar dataKey="billableHours" fill="#10b981" name="Billable Hours" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="hours" stroke="#3b82f6" name="Total Hours" strokeWidth={2} />
              <Line type="monotone" dataKey="billableHours" stroke="#10b981" name="Billable Hours" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="hours"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(entry) => `${entry.name}: ${entry.hours}h`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="hours" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Total Hours" />
              <Area type="monotone" dataKey="billableHours" stackId="2" stroke="#10b981" fill="#10b981" name="Billable Hours" />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Hours</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalHours}h</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Billable Hours</p>
                <p className="text-2xl font-bold text-green-900">{stats.billableHours}h</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-purple-900">${stats.totalAmount}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Approved Entries</p>
                <p className="text-2xl font-bold text-amber-900">{stats.approvedCount}/{stats.totalEntries}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visualization Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Chart Type</Label>
          <Select value={visualization.chart_type} onValueChange={(val) => updateVisualization('chart_type', val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar Chart</SelectItem>
              <SelectItem value="line">Line Chart</SelectItem>
              <SelectItem value="pie">Pie Chart</SelectItem>
              <SelectItem value="area">Area Chart</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Group By</Label>
          <Select value={visualization.group_by} onValueChange={(val) => updateVisualization('group_by', val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="user">Team Member</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="task_type">Work Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        {renderChart()}
      </div>
    </div>
  );
}