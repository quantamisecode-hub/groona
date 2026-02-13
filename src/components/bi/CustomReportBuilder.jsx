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
    <div className="space-y-6">
      {/* Report Configuration */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Source Selection */}
          <div className="space-y-2">
            <Label>Data Source</Label>
            <Select 
              value={reportConfig.dataSource} 
              onValueChange={(value) => setReportConfig(prev => ({ ...prev, dataSource: value, selectedFields: [], groupBy: null }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dataSourceOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visualization Type */}
          <div className="space-y-2">
            <Label>Visualization Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {visualizationOptions.map(option => {
                const Icon = option.icon;
                const isSelected = reportConfig.visualizationType === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setReportConfig(prev => ({ ...prev, visualizationType: option.value }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <p className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-slate-600'}`}>
                      {option.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field Selection */}
          <div className="space-y-2">
            <Label>Select Fields</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              {currentSource?.fields.map(field => (
                <div key={field} className="flex items-center space-x-2">
                  <Checkbox
                    id={field}
                    checked={reportConfig.selectedFields.includes(field)}
                    onCheckedChange={() => handleFieldToggle(field)}
                  />
                  <label
                    htmlFor={field}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {reportConfig.selectedFields.length} field(s) selected
            </p>
          </div>

          {/* Group By (for charts) */}
          {(reportConfig.visualizationType !== 'table') && (
            <div className="space-y-2">
              <Label>Group By <span className="text-red-500">*</span></Label>
              <Select 
                value={reportConfig.groupBy || ''} 
                onValueChange={(value) => setReportConfig(prev => ({ ...prev, groupBy: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field to group by..." />
                </SelectTrigger>
                <SelectContent>
                  {currentSource?.fields.map(field => (
                    <SelectItem key={field} value={field}>
                      {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex gap-3">
            <Button onClick={generateReport} className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            {generatedReport && (
              <Button onClick={exportReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Report Display */}
      {generatedReport && (
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Generated Report
              </CardTitle>
              <Badge>{generatedReport.length} records</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {reportConfig.visualizationType === 'table' && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {reportConfig.selectedFields.map(field => (
                        <TableHead key={field}>
                          {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedReport.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx}>
                        {reportConfig.selectedFields.map(field => (
                          <TableCell key={field}>{row[field]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {generatedReport.length > 100 && (
                  <p className="text-sm text-slate-500 mt-4 text-center">
                    Showing first 100 of {generatedReport.length} records. Export to CSV to view all.
                  </p>
                )}
              </div>
            )}

            {reportConfig.visualizationType === 'bar' && (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={generatedReport}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {reportConfig.visualizationType === 'line' && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={generatedReport}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {reportConfig.visualizationType === 'pie' && (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={generatedReport}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {generatedReport.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generatedReport && (
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="py-16">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Report Generated Yet</h3>
              <p className="text-slate-600">
                Configure your report above and click "Generate Report" to visualize your data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
