import React, { useState, useMemo, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/shared/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, Loader2, Save, Download, Star, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ReportFilters from "../components/reports/ReportFilters";
import ReportVisualization from "../components/reports/ReportVisualization";
import SavedReports from "../components/reports/SavedReports";
import SaveReportDialog from "../components/reports/SaveReportDialog";
import { startOfMonth, endOfMonth, format } from "date-fns";
// UPDATED IMPORT
import { generateTimesheetReportPDF } from "../components/insights/PDFReportGenerator";

export default function Reports() {
  const { user: currentUser, tenant } = useUser();
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  
  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  const [activeTab, setActiveTab] = useState("custom");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filters, setFilters] = useState({
    date_range_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    date_range_end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    project_ids: [],
    user_emails: [],
    task_types: [],
    billable_status: 'all',
    approval_status: ['approved'],
  });
  const [visualization, setVisualization] = useState({
    chart_type: 'bar',
    group_by: 'project',
  });

  // Fetch data for reports
  const { data: timesheets = [], isLoading: timesheetsLoading, refetch: refetchTimesheets } = useQuery({
    queryKey: ['report-timesheets', effectiveTenantId, filters],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allTimesheets = await groonabackend.entities.Timesheet.filter({ tenant_id: effectiveTenantId });
      
      // Apply filters
      return allTimesheets.filter(t => {
        const tDate = new Date(t.date);
        const startDate = new Date(filters.date_range_start);
        const endDate = new Date(filters.date_range_end);
        
        if (tDate < startDate || tDate > endDate) return false;
        if (filters.project_ids.length > 0 && !filters.project_ids.includes(t.project_id)) return false;
        if (filters.user_emails.length > 0 && !filters.user_emails.includes(t.user_email)) return false;
        if (filters.task_types.length > 0 && t.task_id) {
          // Would need to fetch task to check type - simplified for now
        }
        if (filters.billable_status === 'billable' && !t.is_billable) return false;
        if (filters.billable_status === 'non_billable' && t.is_billable) return false;
        if (filters.approval_status.length > 0 && !filters.approval_status.includes(t.status)) return false;
        
        return true;
      });
    },
    enabled: !!currentUser && !!effectiveTenantId,
    staleTime: 30 * 1000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: () => groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }),
    enabled: !!effectiveTenantId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!effectiveTenantId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: savedReports = [] } = useQuery({
    queryKey: ['saved-reports', effectiveTenantId, currentUser?.email],
    queryFn: () => groonabackend.entities.ReportConfig.filter({ 
      tenant_id: effectiveTenantId,
      user_email: currentUser?.email 
    }),
    enabled: !!currentUser && !!effectiveTenantId,
    staleTime: 2 * 60 * 1000,
  });

  // Save report configuration
  const saveReportMutation = useMutation({
    mutationFn: async (reportData) => {
      return await groonabackend.entities.ReportConfig.create({
        tenant_id: effectiveTenantId,
        user_email: currentUser?.email,
        ...reportData,
        filters,
        visualization,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Report configuration saved');
      setShowSaveDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to save report: ${error.message}`);
    }
  });

  // Load saved report
  const loadReport = (report) => {
    setFilters(report.filters || filters);
    setVisualization(report.visualization || visualization);
    setActiveTab('custom');
    toast.success(`Loaded report: ${report.name}`);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Project', 'User', 'Task', 'Hours', 'Billable', 'Rate', 'Amount', 'Status'];
    const rows = timesheets.map(t => [
      t.date,
      t.project_name || '',
      t.user_name || t.user_email,
      t.task_title || '',
      ((t.total_minutes || 0) / 60).toFixed(2),
      t.is_billable ? 'Yes' : 'No',
      t.hourly_rate || '',
      t.hourly_rate ? ((t.total_minutes || 0) / 60 * t.hourly_rate).toFixed(2) : '',
      t.status || '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Report exported to CSV');
  };

  // UPDATED: Export to PDF using text-based generator
  const exportToPDF = () => {
    if (timesheets.length === 0) {
        toast.error("No data to export");
        return;
    }
    try {
      toast.info('Generating PDF report...');
      // Use new generator function
      const pdfBlob = generateTimesheetReportPDF(timesheets, filters);

      if (pdfBlob) {
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Report exported to PDF');
      }
    } catch (error) {
      console.error('[Reports] PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8" ref={printRef}>
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Reports & Analytics</h1>
            <p className="text-slate-600">Generate custom reports and analyze your data</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTimesheets()}
              disabled={timesheetsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${timesheetsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={timesheets.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={timesheets.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Report
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/80 backdrop-blur-xl">
            <TabsTrigger value="custom">Custom Report</TabsTrigger>
            <TabsTrigger value="saved">Saved Reports ({savedReports.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="mt-6 space-y-6">
            {/* Filters */}
            <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileBarChart className="h-5 w-5 text-blue-600" />
                  Report Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReportFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  projects={projects}
                  users={users}
                />
              </CardContent>
            </Card>

            {/* Visualization */}
            <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Data Visualization</CardTitle>
                  <div className="text-sm text-slate-600">
                    {timesheetsLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading data...
                      </span>
                    ) : (
                      <span>{timesheets.length} records found</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ReportVisualization
                  timesheets={timesheets}
                  visualization={visualization}
                  onVisualizationChange={setVisualization}
                  projects={projects}
                  users={users}
                  isLoading={timesheetsLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="mt-6">
            <SavedReports
              reports={savedReports}
              onLoadReport={loadReport}
            />
          </TabsContent>
        </Tabs>

        {/* Save Report Dialog */}
        <SaveReportDialog
          open={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          onSave={(data) => saveReportMutation.mutate(data)}
          loading={saveReportMutation.isPending}
        />
      </div>
    </div>
  );
}

