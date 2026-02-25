import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function DiagnosticWorkspaces() {
  const [currentUser, setCurrentUser] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      if (!user.is_super_admin) {
        window.location.href = "/";
      }
      setCurrentUser(user);
    }).catch(() => {});
  }, []);

  const { data: allWorkspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['diagnostic-workspaces'],
    queryFn: () => groonabackend.entities.Workspace.list(),
    enabled: !!currentUser,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list(),
  });

  const fixWorkspaceMutation = useMutation({
    mutationFn: async ({ workspaceId, tenantId }) => {
      return groonabackend.entities.Workspace.update(workspaceId, { tenant_id: tenantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-workspaces'] });
      toast.success('Workspace tenant_id updated successfully!');
    },
    onError: (error) => {
      console.error('Failed to update workspace:', error);
      toast.error('Failed to update workspace');
    },
  });

  useEffect(() => {
    if (currentUser && allWorkspaces.length > 0 && tenants.length > 0) {
      const effectiveTenantId = currentUser.active_tenant_id || currentUser.tenant_id;
      
      const diagnosticData = {
        currentUser: {
          email: currentUser.email,
          is_super_admin: currentUser.is_super_admin,
          tenant_id: currentUser.tenant_id,
          active_tenant_id: currentUser.active_tenant_id,
          effectiveTenantId: effectiveTenantId,
        },
        workspaces: allWorkspaces.map(ws => ({
          id: ws.id,
          name: ws.name,
          tenant_id: ws.tenant_id,
          owner_email: ws.owner_email,
          status: ws.status,
          hasCorrectTenantId: ws.tenant_id === effectiveTenantId,
          tenantName: tenants.find(t => t.id === ws.tenant_id)?.name || 'Unknown',
        })),
        tenants: tenants.map(t => ({
          id: t.id,
          name: t.name,
          workspaceCount: allWorkspaces.filter(ws => ws.tenant_id === t.id).length,
        })),
        issues: [],
      };

      // Identify issues
      const workspacesWithoutTenantId = allWorkspaces.filter(ws => !ws.tenant_id);
      const workspacesWithWrongTenantId = effectiveTenantId 
        ? allWorkspaces.filter(ws => ws.tenant_id && ws.tenant_id !== effectiveTenantId)
        : [];

      if (workspacesWithoutTenantId.length > 0) {
        diagnosticData.issues.push({
          type: 'missing_tenant_id',
          severity: 'critical',
          message: `${workspacesWithoutTenantId.length} workspace(s) have NO tenant_id set`,
          workspaces: workspacesWithoutTenantId,
        });
      }

      if (effectiveTenantId && allWorkspaces.filter(ws => ws.tenant_id === effectiveTenantId).length === 0) {
        diagnosticData.issues.push({
          type: 'no_matching_workspaces',
          severity: 'warning',
          message: `No workspaces found for current tenant (${tenants.find(t => t.id === effectiveTenantId)?.name})`,
        });
      }

      setDiagnostics(diagnosticData);
      console.log('[Diagnostic] Data:', diagnosticData);
    }
  }, [currentUser, allWorkspaces, tenants]);

  const handleFixWorkspace = async (workspace, suggestedTenantId) => {
    if (confirm(`Update workspace "${workspace.name}" to tenant_id: ${suggestedTenantId}?`)) {
      fixWorkspaceMutation.mutate({ workspaceId: workspace.id, tenantId: suggestedTenantId });
    }
  };

  if (!currentUser?.is_super_admin) {
    return null;
  }

  if (workspacesLoading || !diagnostics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Workspace Diagnostics</h1>
        <p className="text-slate-600">Debug and fix workspace tenant assignments</p>
      </div>

      {/* Current User Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Current Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Email:</strong> {diagnostics.currentUser.email}
            </div>
            <div>
              <strong>Super Admin:</strong> {diagnostics.currentUser.is_super_admin ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Tenant ID:</strong> {diagnostics.currentUser.tenant_id || 'None'}
            </div>
            <div>
              <strong>Active Tenant ID:</strong> {diagnostics.currentUser.active_tenant_id || 'None'}
            </div>
            <div className="col-span-2">
              <strong>Effective Tenant ID:</strong> 
              <Badge className="ml-2 bg-blue-600 text-white">
                {diagnostics.currentUser.effectiveTenantId || 'None (Global View)'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      {diagnostics.issues.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Issues Found ({diagnostics.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnostics.issues.map((issue, index) => (
              <Alert key={index} className="border-red-300 bg-white">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  <strong className="text-red-700">{issue.severity.toUpperCase()}:</strong> {issue.message}
                  
                  {issue.workspaces && (
                    <div className="mt-4 space-y-2">
                      {issue.workspaces.map(ws => (
                        <div key={ws.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                          <div>
                            <strong>{ws.name}</strong>
                            <div className="text-xs text-slate-600">
                              Owner: {ws.owner_email} | tenant_id: {ws.tenant_id || 'MISSING'}
                            </div>
                          </div>
                          {diagnostics.currentUser.effectiveTenantId && (
                            <Button
                              size="sm"
                              onClick={() => handleFixWorkspace(ws, diagnostics.currentUser.effectiveTenantId)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Fix
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle>All Workspaces ({diagnostics.workspaces.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {diagnostics.workspaces.map(ws => (
              <div 
                key={ws.id} 
                className={`p-4 rounded-lg border ${
                  ws.hasCorrectTenantId 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {ws.hasCorrectTenantId ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                      <strong className="text-slate-900">{ws.name}</strong>
                      <Badge className={ws.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                        {ws.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 ml-6">
                      <div><strong>ID:</strong> {ws.id}</div>
                      <div><strong>Owner:</strong> {ws.owner_email}</div>
                      <div><strong>Tenant ID:</strong> {ws.tenant_id || 'MISSING'}</div>
                      <div><strong>Tenant Name:</strong> {ws.tenantName}</div>
                    </div>
                  </div>
                  {!ws.hasCorrectTenantId && diagnostics.currentUser.effectiveTenantId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFixWorkspace(ws, diagnostics.currentUser.effectiveTenantId)}
                    >
                      Set to Current Tenant
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tenants Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Tenants Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {diagnostics.tenants.map(tenant => (
              <div key={tenant.id} className="p-3 rounded border border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{tenant.name}</strong>
                    <div className="text-sm text-slate-600">ID: {tenant.id}</div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">
                    {tenant.workspaceCount} workspaces
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

