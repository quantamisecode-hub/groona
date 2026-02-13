import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Code, Megaphone, RefreshCw, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function TenantConfigManager() {
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetReason, setResetReason] = useState("");

  const { data: tenants = [] } = useQuery({
    queryKey: ['all-tenants-config'],
    queryFn: () => groonabackend.entities.Tenant.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-sa'],
    queryFn: () => groonabackend.auth.me(),
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ tenantId, updates }) => {
      return await groonabackend.entities.Tenant.update(tenantId, updates);
    },
    onSuccess: async (_, { tenantId, updates, reason }) => {
      await groonabackend.entities.SuperAdminAuditLog.create({
        admin_email: currentUser.email,
        admin_name: currentUser.full_name,
        action_type: 'TENANT_CONFIG_UPDATE',
        target_entity: tenantId,
        target_entity_name: selectedTenant?.name,
        previous_value: { config: selectedTenant?.tenant_config, company_type: selectedTenant?.company_type },
        new_value: updates,
        reason,
        severity: 'WARNING'
      });
      queryClient.invalidateQueries({ queryKey: ['all-tenants-config'] });
      toast.success('Tenant configuration updated');
      setShowConfigDialog(false);
      setShowResetDialog(false);
    },
    onError: (error) => {
      toast.error('Failed to update tenant', { description: error.message });
    }
  });

  const handleResetConfig = () => {
    const companyType = selectedTenant.company_type || 'SOFTWARE';
    const defaultConfig = companyType === 'MARKETING' ? {
      enable_sprints: false,
      default_workflow: "CAMPAIGN",
      require_task_approval: true,
      terminology_map: {
        SPRINT: "Campaign",
        TASK: "Content",
        MILESTONE: "Phase",
        BACKLOG: "Content Pipeline",
        PROJECT: "Campaign",
        TEAM: "Agency Team"
      }
    } : {
      enable_sprints: true,
      default_workflow: "AGILE",
      require_task_approval: false,
      terminology_map: {
        SPRINT: "Sprint",
        TASK: "Task",
        MILESTONE: "Milestone",
        BACKLOG: "Backlog",
        PROJECT: "Project",
        TEAM: "Team"
      }
    };

    updateTenantMutation.mutate({
      tenantId: selectedTenant.id,
      updates: { tenant_config: defaultConfig },
      reason: resetReason
    });
  };

  const handleUpdateCompanyType = (newType) => {
    const defaultConfig = newType === 'MARKETING' ? {
      enable_sprints: false,
      default_workflow: "CAMPAIGN",
      require_task_approval: true,
      terminology_map: {
        SPRINT: "Campaign",
        TASK: "Content",
        MILESTONE: "Phase",
        BACKLOG: "Content Pipeline",
        PROJECT: "Campaign",
        TEAM: "Agency Team"
      }
    } : {
      enable_sprints: true,
      default_workflow: "AGILE",
      require_task_approval: false,
      terminology_map: {
        SPRINT: "Sprint",
        TASK: "Task",
        MILESTONE: "Milestone",
        BACKLOG: "Backlog",
        PROJECT: "Project",
        TEAM: "Team"
      }
    };

    updateTenantMutation.mutate({
      tenantId: selectedTenant.id,
      updates: { 
        company_type: newType,
        tenant_config: defaultConfig
      },
      reason: `Company type changed to ${newType}`
    });
  };

  const getStatusColor = (tenant) => {
    if (!tenant.onboarding_completed) return 'bg-amber-100 text-amber-700';
    if (tenant.status === 'suspended') return 'bg-red-100 text-red-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusLabel = (tenant) => {
    if (!tenant.onboarding_completed) return 'ONBOARDING';
    if (tenant.status === 'suspended') return 'SUSPENDED';
    return 'ACTIVE';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant Industry & Configuration Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tenants.map(tenant => (
              <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${tenant.company_type === 'MARKETING' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        {tenant.company_type === 'MARKETING' ? (
                          <Megaphone className="h-5 w-5 text-purple-600" />
                        ) : (
                          <Code className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{tenant.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">
                            {tenant.company_type || 'SOFTWARE'}
                          </Badge>
                          <Badge className={getStatusColor(tenant)}>
                            {getStatusLabel(tenant)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setShowConfigDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Config
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setShowResetDialog(true);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View/Edit Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tenant Configuration: {selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Company Type</label>
              <Select
                value={selectedTenant?.company_type || 'SOFTWARE'}
                onValueChange={handleUpdateCompanyType}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOFTWARE">Software Development</SelectItem>
                  <SelectItem value="MARKETING">Marketing Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Effective Configuration (Read-Only)</label>
              <pre className="mt-1 p-4 bg-slate-50 rounded-lg text-xs overflow-auto max-h-96 border">
                {JSON.stringify(selectedTenant?.tenant_config || {}, null, 2)}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Config Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Reset Configuration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This will reset <strong>{selectedTenant?.name}</strong> to default {selectedTenant?.company_type || 'SOFTWARE'} configuration.
            </p>
            <div>
              <label className="text-sm font-medium text-slate-700">Reason (Required)</label>
              <Textarea
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="Explain why you're resetting this configuration..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResetConfig}
              disabled={!resetReason.trim() || updateTenantMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Reset Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

