import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag, Plus } from "lucide-react";
import { toast } from "sonner";

export default function FeatureFlagManager() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFlag, setNewFlag] = useState({
    config_key: '',
    description: '',
    applies_to: 'ALL',
    rollout_strategy: 'immediate',
    is_active: true
  });

  const { data: featureFlags = [] } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      return await groonabackend.entities.SystemConfig.filter({ config_type: 'FEATURE_FLAG' });
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-ff'],
    queryFn: () => groonabackend.auth.me(),
  });

  const createFlagMutation = useMutation({
    mutationFn: async (flagData) => {
      return await groonabackend.entities.SystemConfig.create(flagData);
    },
    onSuccess: async () => {
      await groonabackend.entities.SuperAdminAuditLog.create({
        admin_email: currentUser.email,
        admin_name: currentUser.full_name,
        action_type: 'FEATURE_FLAG_CHANGE',
        target_entity: newFlag.config_key,
        target_entity_name: newFlag.config_key,
        new_value: newFlag,
        severity: 'INFO'
      });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Feature flag created');
      setShowCreateDialog(false);
      setNewFlag({ config_key: '', description: '', applies_to: 'ALL', rollout_strategy: 'immediate', is_active: true });
    }
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ flag, newValue }) => {
      return await groonabackend.entities.SystemConfig.update(flag.id, { is_active: newValue });
    },
    onSuccess: async (_, { flag, newValue }) => {
      await groonabackend.entities.SuperAdminAuditLog.create({
        admin_email: currentUser.email,
        admin_name: currentUser.full_name,
        action_type: 'FEATURE_FLAG_CHANGE',
        target_entity: flag.id,
        target_entity_name: flag.config_key,
        previous_value: { is_active: flag.is_active },
        new_value: { is_active: newValue },
        severity: 'WARNING'
      });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success(`Feature flag ${newValue ? 'enabled' : 'disabled'}`);
    }
  });

  const defaultFlags = [
    { key: 'enable_sprints', label: 'Sprints', description: 'Enable sprint planning and tracking' },
    { key: 'enable_timesheets', label: 'Timesheets', description: 'Enable time tracking features' },
    { key: 'enable_location_tracking', label: 'Location Tracking', description: 'Allow location capture for timesheets' },
    { key: 'enable_approvals', label: 'Approval Workflows', description: 'Enable approval processes' },
    { key: 'enable_ticketing', label: 'Mini Ticketing', description: 'Enable support ticket system' }
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Global Feature Flags
            </CardTitle>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {defaultFlags.map(flag => {
              const existingFlag = featureFlags.find(f => f.config_key === flag.key);
              const isActive = existingFlag?.is_active ?? true;
              
              return (
                <div key={flag.key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-slate-900">{flag.label}</h4>
                    <p className="text-sm text-slate-600">{flag.description}</p>
                    {existingFlag && (
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs text-slate-500">
                          Applies to: {existingFlag.applies_to}
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-500">
                          Rollout: {existingFlag.rollout_strategy}
                        </span>
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      if (existingFlag) {
                        toggleFlagMutation.mutate({ flag: existingFlag, newValue: checked });
                      } else {
                        createFlagMutation.mutate({
                          config_key: flag.key,
                          config_type: 'FEATURE_FLAG',
                          config_value: { enabled: checked },
                          description: flag.description,
                          is_active: checked,
                          applies_to: 'ALL',
                          rollout_strategy: 'immediate'
                        });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Flag Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Flag Key</Label>
              <Input
                value={newFlag.config_key}
                onChange={(e) => setNewFlag({ ...newFlag, config_key: e.target.value })}
                placeholder="enable_feature_name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newFlag.description}
                onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                placeholder="What does this flag control?"
              />
            </div>
            <div>
              <Label>Applies To</Label>
              <Select value={newFlag.applies_to} onValueChange={(v) => setNewFlag({ ...newFlag, applies_to: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Tenants</SelectItem>
                  <SelectItem value="SOFTWARE">Software Only</SelectItem>
                  <SelectItem value="MARKETING">Marketing Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rollout Strategy</Label>
              <Select value={newFlag.rollout_strategy} onValueChange={(v) => setNewFlag({ ...newFlag, rollout_strategy: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">All Tenants Immediately</SelectItem>
                  <SelectItem value="new_tenants_only">New Tenants Only</SelectItem>
                  <SelectItem value="selected_tenants">Selected Tenants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createFlagMutation.mutate({
                ...newFlag,
                config_type: 'FEATURE_FLAG',
                config_value: { enabled: newFlag.is_active }
              })}
              disabled={!newFlag.config_key || createFlagMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

