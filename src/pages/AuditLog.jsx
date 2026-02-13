import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, FileText, Download, Filter, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuditLogTable from "../components/audit/AuditLogTable";
import AuditLogFilters from "../components/audit/AuditLogFilters";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AuditLog() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({
    tenant_id: 'all',
    action: 'all',
    entity_type: 'all',
    user_email: 'all',
    severity: 'all',
    success: 'all',
    dateFrom: null,
    dateTo: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: auditLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      let logs = await groonabackend.entities.AuditLog.list('-created_date', 1000);
      
      // Apply filters
      if (filters.tenant_id !== 'all') {
        logs = logs.filter(log => log.tenant_id === filters.tenant_id);
      }
      if (filters.action !== 'all') {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.entity_type !== 'all') {
        logs = logs.filter(log => log.entity_type === filters.entity_type);
      }
      if (filters.user_email !== 'all') {
        logs = logs.filter(log => log.user_email === filters.user_email);
      }
      if (filters.severity !== 'all') {
        logs = logs.filter(log => log.severity === filters.severity);
      }
      if (filters.success !== 'all') {
        const successValue = filters.success === 'true';
        logs = logs.filter(log => log.success === successValue);
      }
      if (filters.dateFrom) {
        logs = logs.filter(log => new Date(log.created_date) >= new Date(filters.dateFrom));
      }
      if (filters.dateTo) {
        logs = logs.filter(log => new Date(log.created_date) <= new Date(filters.dateTo));
      }

      return logs;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-audit'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants-for-audit'],
    queryFn: () => groonabackend.entities.Tenant.list(),
    enabled: currentUser?.is_super_admin,
  });

  const handleExportLogs = () => {
    try {
      // Convert logs to CSV
      const headers = ['Timestamp', 'Tenant', 'User', 'Action', 'Entity Type', 'Entity Name', 'Severity', 'Success', 'Description'];
      const csvContent = [
        headers.join(','),
        ...auditLogs.map(log => {
          const tenant = tenants.find(t => t.id === log.tenant_id);
          return [
            format(new Date(log.created_date), 'yyyy-MM-dd HH:mm:ss'),
            `"${tenant?.name || log.tenant_id || 'N/A'}"`,
            `"${log.user_name || log.user_email}"`,
            log.action,
            log.entity_type,
            `"${log.entity_name || 'N/A'}"`,
            log.severity,
            log.success,
            `"${log.description || ''}"`
          ].join(',');
        })
      ].join('\n');

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Audit log exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export audit log');
    }
  };

  // Check if user has permission to view audit logs
  const canViewAuditLog = currentUser && (currentUser.is_super_admin || currentUser.role === 'admin');

  if (!canViewAuditLog) {
    return (
      <div className="p-6 md:p-8">
        <Card className="p-12 text-center bg-white/60 backdrop-blur-xl border-slate-200/60">
          <Shield className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to access audit logs.</p>
        </Card>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    total: auditLogs.length,
    failed: auditLogs.filter(log => !log.success).length,
    critical: auditLogs.filter(log => log.severity === 'critical').length,
    today: auditLogs.filter(log => {
      const logDate = new Date(log.created_date);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Audit Log</h1>
              <p className="text-slate-600">Track and monitor all user actions and system events</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="border-slate-300"
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button
            onClick={handleExportLogs}
            disabled={auditLogs.length === 0}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Events</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <FileText className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Today's Events</p>
                <p className="text-3xl font-bold text-blue-600">{stats.today}</p>
              </div>
              <FileText className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-red-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Failed Actions</p>
                <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-amber-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Critical Events</p>
                <p className="text-3xl font-bold text-amber-600">{stats.critical}</p>
              </div>
              <Shield className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <AuditLogFilters
          filters={filters}
          onFiltersChange={setFilters}
          users={users}
          tenants={tenants}
          auditLogs={auditLogs}
          isSuperAdmin={currentUser?.is_super_admin}
        />
      )}

      {/* Audit Log Table */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Audit Events ({auditLogs.length})</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Detailed log of all significant actions performed in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable logs={auditLogs} loading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

