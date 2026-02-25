import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Shield, 
  AlertTriangle,
  Clock,
  User,
  FileText,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { groonabackend } from "@/api/groonabackend";
import { useEffect } from "react";

export default function AuditLogTable({ logs, loading }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [tenantNames, setTenantNames] = useState({});

  useEffect(() => {
    const loadTenantNames = async () => {
      const uniqueTenantIds = [...new Set(logs.map(log => log.tenant_id).filter(Boolean))];
      const names = {};
      
      try {
        const tenants = await groonabackend.entities.Tenant.list();
        tenants.forEach(tenant => {
          names[tenant.id] = tenant.name;
        });
        setTenantNames(names);
      } catch (error) {
        console.error('Failed to load tenant names:', error);
      }
    };

    if (logs.length > 0) {
      loadTenantNames();
    }
  }, [logs]);

  const getActionIcon = (action) => {
    const icons = {
      create: '➕',
      update: '✏️',
      delete: '🗑️',
      login: '🔐',
      logout: '🚪',
      invite: '📧',
      permission_change: '🔑',
      role_change: '👑',
      status_change: '🔄',
      export: '📤',
      import: '📥',
      restore: '♻️',
      archive: '📦',
    };
    return icons[action] || '📝';
  };

  const getSeverityBadge = (severity) => {
    const variants = {
      low: { class: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Low' },
      medium: { class: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Medium' },
      high: { class: 'bg-amber-100 text-amber-700 border-amber-200', label: 'High' },
      critical: { class: 'bg-red-100 text-red-700 border-red-200', label: 'Critical' },
    };
    const variant = variants[severity] || variants.low;
    return (
      <Badge className={`${variant.class} border text-xs`}>
        {variant.label}
      </Badge>
    );
  };

  const getEntityBadge = (entityType) => {
    const variants = {
      user: 'bg-purple-100 text-purple-700 border-purple-200',
      project: 'bg-blue-100 text-blue-700 border-blue-200',
      task: 'bg-green-100 text-green-700 border-green-200',
      sprint: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      document: 'bg-amber-100 text-amber-700 border-amber-200',
      template: 'bg-pink-100 text-pink-700 border-pink-200',
      group: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      tenant: 'bg-orange-100 text-orange-700 border-orange-200',
      settings: 'bg-slate-100 text-slate-700 border-slate-200',
      file: 'bg-teal-100 text-teal-700 border-teal-200',
      comment: 'bg-lime-100 text-lime-700 border-lime-200',
    };
    return (
      <Badge className={`${variants[entityType] || variants.settings} border text-xs`}>
        {entityType}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-600 mb-2">No audit logs found</p>
        <p className="text-sm text-slate-500">Actions will appear here as users interact with the system</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[150px]">Tenant</TableHead>
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead className="w-[120px]">Action</TableHead>
              <TableHead className="w-[140px]">Entity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} className="hover:bg-slate-50">
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {format(new Date(log.created_date), 'MMM d, yyyy HH:mm:ss')}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {tenantNames[log.tenant_id] || log.tenant_id || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {log.user_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{log.user_email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getActionIcon(log.action)} {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {getEntityBadge(log.entity_type)}
                    {log.entity_name && (
                      <p className="text-xs text-slate-600 truncate max-w-[120px]">
                        {log.entity_name}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-slate-700 truncate max-w-[300px]">
                    {log.description || `${log.action} ${log.entity_type}`}
                  </p>
                </TableCell>
                <TableCell>
                  {getSeverityBadge(log.severity)}
                </TableCell>
                <TableCell>
                  {log.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLog(log)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Audit Log Details
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Timestamp</p>
                  <p className="font-mono text-sm">
                    {format(new Date(selectedLog.created_date), 'PPpp')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Log ID</p>
                  <p className="font-mono text-sm text-slate-700">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tenant</p>
                  <Badge variant="outline" className="text-xs">
                    {tenantNames[selectedLog.tenant_id] || selectedLog.tenant_id || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tenant ID</p>
                  <p className="font-mono text-xs text-slate-700">{selectedLog.tenant_id || 'N/A'}</p>
                </div>
              </div>

              {/* User Info */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  User Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Name</p>
                    <p className="text-sm font-medium">{selectedLog.user_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Email</p>
                    <p className="text-sm">{selectedLog.user_email}</p>
                  </div>
                  {selectedLog.user_role && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Role</p>
                      <Badge className="text-xs">{selectedLog.user_role}</Badge>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">IP Address</p>
                      <p className="font-mono text-sm">{selectedLog.ip_address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Info */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Action Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Action</p>
                    <Badge variant="outline" className="text-sm">
                      {getActionIcon(selectedLog.action)} {selectedLog.action}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Entity Type</p>
                    {getEntityBadge(selectedLog.entity_type)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Entity Name</p>
                    <p className="text-sm">{selectedLog.entity_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Entity ID</p>
                    <p className="font-mono text-xs text-slate-700">{selectedLog.entity_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Severity</p>
                    {getSeverityBadge(selectedLog.severity)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    {selectedLog.success ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 border">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-200 border">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                </div>
                {selectedLog.description && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-1">Description</p>
                    <p className="text-sm text-slate-700">{selectedLog.description}</p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {!selectedLog.success && selectedLog.error_message && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Error Message
                  </h4>
                  <p className="text-sm text-red-700 font-mono">{selectedLog.error_message}</p>
                </div>
              )}

              {/* Changes */}
              {selectedLog.changes && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Changes</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLog.changes.before && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Before</p>
                        <pre className="bg-white p-3 rounded border border-slate-200 text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.changes.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.changes.after && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">After</p>
                        <pre className="bg-white p-3 rounded border border-slate-200 text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.changes.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Additional Metadata</h4>
                  <pre className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">User Agent</p>
                  <p className="text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-200">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

