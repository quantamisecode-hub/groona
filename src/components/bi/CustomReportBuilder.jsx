import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  Download,
  Filter,
  Table as TableIcon,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Plus,
  X
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function CustomReportBuilder({ projects, tasks, users, timesheets, activities }) {
  const [reportConfig, setReportConfig] = useState({
    dataSource: 'projects',
    visualizationType: 'table',
    selectedFields: [],
    groupBy: null,
    filters: [],
  });

  const [generatedReport, setGeneratedReport] = useState(null);

  const dataSourceOptions = [
    { value: 'projects', label: 'Projects', fields: ['name', 'status', 'priority', 'progress', 'deadline', 'budget', 'actual_cost'] },
    { value: 'tasks', label: 'Tasks', fields: ['title', 'status', 'priority', 'task_type', 'estimated_hours', 'assigned_to', 'due_date'] },
    { value: 'users', label: 'Team Members', fields: ['full_name', 'email', 'role'] },
    { value: 'timesheets', label: 'Timesheets', fields: ['user_email', 'date', 'hours', 'minutes', 'status', 'is_billable'] },
    { value: 'activities', label: 'Activities', fields: ['action', 'entity_type', 'user_email', 'created_date'] },
  ];

  const visualizationOptions = [
    { value: 'table', label: 'Table', icon: TableIcon },
    { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
    { value: 'line', label: 'Line Chart', icon: LineChartIcon },
    { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  ];

  const getCurrentDataSource = () => dataSourceOptions.find(ds => ds.value === reportConfig.dataSource);
  const getDataBySource = () => {
    switch (reportConfig.dataSource) {
      case 'projects': return projects;
      case 'tasks': return tasks;
      case 'users': return users;
      case 'timesheets': return timesheets;
      case 'activities': return activities;
      default: return [];
    }
  };

  const handleFieldToggle = (field) => {
    setReportConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.includes(field)
        ? prev.selectedFields.filter(f => f !== field)
        : [...prev.selectedFields, field]
    }));
  };

  const generateReport = () => {
    if (reportConfig.selectedFields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    const data = getDataBySource();

    // Apply filters if any
    let filteredData = [...data];

    // Generate report based on visualization type
    let reportData = null;

    if (reportConfig.visualizationType === 'table') {
      reportData = filteredData.map(item => {
        const row = {};
        reportConfig.selectedFields.forEach(field => {
          row[field] = item[field] || 'N/A';
        });
        return row;
      });
    } else if (reportConfig.visualizationType === 'bar' || reportConfig.visualizationType === 'line') {
      // For charts, we need to aggregate data
      if (reportConfig.groupBy) {
        const grouped = filteredData.reduce((acc, item) => {
          const key = item[reportConfig.groupBy] || 'Unknown';
          if (!acc[key]) acc[key] = 0;
          acc[key]++;
          return acc;
        }, {});

        reportData = Object.entries(grouped).map(([name, value]) => ({ name, value }));
      } else {
        toast.error('Please select a field to group by for chart visualization');
        return;
      }
    } else if (reportConfig.visualizationType === 'pie') {
      if (reportConfig.groupBy) {
        const grouped = filteredData.reduce((acc, item) => {
          const key = item[reportConfig.groupBy] || 'Unknown';
          if (!acc[key]) acc[key] = 0;
          acc[key]++;
          return acc;
        }, {});

        reportData = Object.entries(grouped).map(([name, value], idx) => ({
          name,
          value,
          color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]
        }));
      } else {
        toast.error('Please select a field to group by for pie chart');
        return;
      }
    }

    setGeneratedReport(reportData);
    toast.success('Report generated successfully!');
  };

  const exportReport = () => {
    if (!generatedReport) {
      toast.error('Please generate a report first');
      return;
    }

    const csvContent = convertToCSV(generatedReport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Report exported successfully!');
  };

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(field => JSON.stringify(row[field] || '')).join(','))
    ];

    return csvRows.join('\n');
  };

  const currentSource = getCurrentDataSource();

  return (
    <div className="space-y-8">
      {/* Report Configuration */}
      <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30 py-6 px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Filter className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-900">Report Configuration</CardTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Build custom reports from your data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* Data Source Selection */}
          <div className="space-y-3">
            <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Data Source</Label>
            <Select
              value={reportConfig.dataSource}
              onValueChange={(value) => setReportConfig(prev => ({ ...prev, dataSource: value, selectedFields: [], groupBy: null }))}
            >
              <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-bold text-slate-700 focus:ring-blue-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                {dataSourceOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="font-bold">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visualization Type */}
          <div className="space-y-3">
            <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Visualization Type</Label>
            <div className="flex flex-wrap gap-3">
              {visualizationOptions.map(option => {
                const Icon = option.icon;
                const isSelected = reportConfig.visualizationType === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setReportConfig(prev => ({ ...prev, visualizationType: option.value }))}
                    className={`w-28 py-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${isSelected
                      ? 'border-blue-500 bg-blue-50/80 shadow-lg shadow-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <p className={`text-[11px] font-black uppercase tracking-wide ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                      {option.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Fields</Label>
              <span className="text-xs font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
                {reportConfig.selectedFields.length} selected
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
              {currentSource?.fields.map(field => (
                <div
                  key={field}
                  onClick={() => handleFieldToggle(field)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${reportConfig.selectedFields.includes(field)
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                >
                  <Checkbox
                    id={field}
                    checked={reportConfig.selectedFields.includes(field)}
                    onCheckedChange={() => handleFieldToggle(field)}
                    className="pointer-events-none"
                  />
                  <label
                    htmlFor={field}
                    className={`text-sm font-bold cursor-pointer ${reportConfig.selectedFields.includes(field) ? 'text-blue-700' : 'text-slate-600'
                      }`}
                  >
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Group By (for charts) */}
          {(reportConfig.visualizationType !== 'table') && (
            <div className="space-y-3">
              <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Group By <span className="text-red-500">*</span>
              </Label>
              <Select
                value={reportConfig.groupBy || ''}
                onValueChange={(value) => setReportConfig(prev => ({ ...prev, groupBy: value }))}
              >
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-bold text-slate-700 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select field to group by..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  {currentSource?.fields.map(field => (
                    <SelectItem key={field} value={field} className="font-bold">
                      {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={generateReport}
              className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            {generatedReport && (
              <Button
                onClick={exportReport}
                variant="outline"
                className="h-12 px-6 rounded-xl border-slate-200 font-bold hover:bg-slate-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Report Display */}
      {generatedReport && (
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30 py-5 px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </div>
                <CardTitle className="text-base font-black text-slate-900">Generated Report</CardTitle>
              </div>
              <Badge className="bg-blue-500/10 text-blue-600 border-none font-black px-3 py-1 rounded-lg">
                {generatedReport.length} records
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {reportConfig.visualizationType === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent">
                      {reportConfig.selectedFields.map(field => (
                        <TableHead key={field} className="font-black text-slate-500 text-xs uppercase tracking-wider py-4">
                          {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedReport.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 border-b border-slate-50">
                        {reportConfig.selectedFields.map(field => (
                          <TableCell key={field} className="font-medium text-slate-700 py-4">{row[field]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {generatedReport.length > 100 && (
                  <p className="text-xs font-bold text-slate-400 mt-4 text-center pb-4 uppercase tracking-widest">
                    Showing first 100 of {generatedReport.length} records · Export to CSV for full data
                  </p>
                )}
              </div>
            )}

            {reportConfig.visualizationType === 'bar' && (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={generatedReport} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportConfig.visualizationType === 'line' && (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generatedReport} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportConfig.visualizationType === 'pie' && (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={generatedReport}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={150}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {generatedReport.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generatedReport && (
        <Card className="bg-white border border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.03)] rounded-[1.5rem] overflow-hidden">
          <CardContent className="py-24">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">No Report Generated Yet</h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto">
                Configure your report above and click "Generate Report" to visualize your data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
