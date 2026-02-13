import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";

export default function SuperAdminAuditViewer() {
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['super-admin-audit-logs'],
    queryFn: async () => {
      const logs = await groonabackend.entities.SuperAdminAuditLog.list('-created_date', 50);
      return logs;
    },
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
      case 'WARNING': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL': return AlertTriangle;
      case 'WARNING': return AlertTriangle;
      default: return Info;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Super Admin Audit Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No audit logs yet
              </p>
            ) : (
              auditLogs.map((log) => {
                const SeverityIcon = getSeverityIcon(log.severity);
                
                return (
                  <Card key={log.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <SeverityIcon className="h-4 w-4 text-slate-600" />
                          <span className="font-semibold text-slate-900">
                            {log.admin_name}
                          </span>
                          <Badge variant="outline" className={getSeverityColor(log.severity)}>
                            {log.severity}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-500">
                          {format(new Date(log.created_date), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm text-slate-700">
                          <strong>{log.action_type.replace(/_/g, ' ')}</strong>
                          {' '}on{' '}
                          <strong>{log.target_entity_name || log.target_entity}</strong>
                        </p>
                        
                        {log.reason && (
                          <p className="text-xs text-slate-600 mt-1">
                            Reason: {log.reason}
                          </p>
                        )}
                        
                        {log.new_value && (
                          <details className="text-xs text-slate-500 mt-2">
                            <summary className="cursor-pointer hover:text-slate-700">
                              View changes
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-50 rounded overflow-auto">
                              {JSON.stringify(log.new_value, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-slate-500">
            🔒 Audit logs are immutable and read-only. All Super Admin actions are tracked.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

