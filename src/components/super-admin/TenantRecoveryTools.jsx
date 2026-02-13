import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy, Power, PowerOff, Clock, Calendar, FolderKanban, Users, Shield, Search, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVAILABLE_FEATURES = [
  { key: 'timesheets', label: 'Timesheets', icon: Clock, color: 'blue' },
  { key: 'sprints', label: 'Sprints', icon: Calendar, color: 'purple' },
  { key: 'projects', label: 'Projects', icon: FolderKanban, color: 'green' },
  { key: 'team_management', label: 'Team Management', icon: Users, color: 'amber' },
  { key: 'ai_assistant', label: 'AI Assistant', icon: Shield, color: 'pink' },
];

export default function TenantRecoveryTools() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableConfig, setDisableConfig] = useState({
    features: [],
    reason: '',
    duration: 'temporary',
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser);
  }, []);

  // Fetch all tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list('-created_date'),
  });

  // Filter tenants based on search
  const filteredTenants = tenants.filter(tenant => {
    if (!searchQuery) return true;
    return tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           tenant.owner_email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Toggle feature for tenant(s)
  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ tenantIds, features, enable, reason }) => {
      const results = [];
      
      for (const tenantId of tenantIds) {
        const tenant = tenants.find(t => t.id === tenantId);
        const currentFeatures = tenant.features_enabled || {};
        
        const updatedFeatures = { ...currentFeatures };
        features.forEach(feature => {
          updatedFeatures[feature] = enable;
        });

        const updated = await groonabackend.entities.Tenant.update(tenantId, {
          features_enabled: updatedFeatures,
        });

        // Log the action
        await groonabackend.entities.SuperAdminAuditLog.create({
          admin_email: currentUser.email,
          admin_name: currentUser.full_name,
          action_type: enable ? 'TENANT_REACTIVATED' : 'TENANT_SUSPENDED',
          target_entity: tenantId,
          target_entity_name: tenant.name,
          previous_value: { features_enabled: currentFeatures },
          new_value: { features_enabled: updatedFeatures },
          reason: reason || `${enable ? 'Enabled' : 'Disabled'} features: ${features.join(', ')}`,
          severity: enable ? 'INFO' : 'WARNING',
        });

        results.push(updated);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowDisableDialog(false);
      setSelectedTenants([]);
      setDisableConfig({ features: [], reason: '', duration: 'temporary' });
      toast.success('Feature access updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update features: ' + error.message);
    },
  });

  const handleDisableFeatures = () => {
    if (selectedTenants.length === 0) {
      toast.error('Please select at least one tenant');
      return;
    }
    if (disableConfig.features.length === 0) {
      toast.error('Please select at least one feature to disable');
      return;
    }
    if (!disableConfig.reason.trim()) {
      toast.error('Please provide a reason for disabling features');
      return;
    }

    toggleFeatureMutation.mutate({
      tenantIds: selectedTenants,
      features: disableConfig.features,
      enable: false,
      reason: disableConfig.reason,
    });
  };

  const handleEnableFeatures = (tenantId, features) => {
    toggleFeatureMutation.mutate({
      tenantIds: [tenantId],
      features: features,
      enable: true,
      reason: 'Features re-enabled by Super Admin',
    });
  };

  const toggleTenantSelection = (tenantId) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedTenants(filteredTenants.map(t => t.id));
  };

  const clearSelection = () => {
    setSelectedTenants([]);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-blue-600" />
                Tenant Safety & Recovery Tools
              </CardTitle>
              <CardDescription className="mt-2">
                Temporarily disable features for tenants with clear audit logging
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-blue-600">
              {selectedTenants.length} Selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tenants by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {selectedTenants.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={clearSelection}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear ({selectedTenants.length})
                  </Button>
                  <Button
                    onClick={() => setShowDisableDialog(true)}
                    variant="destructive"
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    Disable Features
                  </Button>
                </>
              )}
              {selectedTenants.length === 0 && filteredTenants.length > 0 && (
                <Button
                  variant="outline"
                  onClick={selectAllFiltered}
                >
                  Select All ({filteredTenants.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenants List */}
      <Card>
        <CardHeader>
          <CardTitle>Tenants & Feature Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-400" />
              <p className="text-slate-600">Loading tenants...</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <LifeBuoy className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No tenants found matching your search</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTenants.map(tenant => {
                const features = tenant.features_enabled || {};
                const disabledFeatures = AVAILABLE_FEATURES.filter(f => features[f.key] === false);
                const isSelected = selectedTenants.includes(tenant.id);

                return (
                  <div
                    key={tenant.id}
                    className={`p-4 border rounded-lg transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTenantSelection(tenant.id)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-900 truncate">{tenant.name}</h3>
                            <p className="text-sm text-slate-600 truncate">{tenant.owner_email}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Badge
                              variant={tenant.status === 'active' ? 'default' : 'secondary'}
                              className={tenant.status === 'active' ? 'bg-green-600' : ''}
                            >
                              {tenant.status}
                            </Badge>
                            <Badge variant="outline">
                              {tenant.subscription_plan}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_FEATURES.map(feature => {
                            const isEnabled = features[feature.key] !== false;
                            const FeatureIcon = feature.icon;
                            
                            return (
                              <div
                                key={feature.key}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
                                  isEnabled
                                    ? `bg-${feature.color}-100 text-${feature.color}-800`
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                <FeatureIcon className="h-3 w-3" />
                                <span>{feature.label}</span>
                                {!isEnabled && (
                                  <PowerOff className="h-3 w-3 ml-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {disabledFeatures.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEnableFeatures(
                                tenant.id,
                                disabledFeatures.map(f => f.key)
                              )}
                              disabled={toggleFeatureMutation.isPending}
                            >
                              <Power className="h-3 w-3 mr-2" />
                              Re-enable {disabledFeatures.length} Feature{disabledFeatures.length > 1 ? 's' : ''}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable Features Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Disable Features for {selectedTenants.length} Tenant{selectedTenants.length > 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              This action will temporarily disable selected features. All changes are logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Feature Selection */}
            <div className="space-y-3">
              <Label>Select Features to Disable</Label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_FEATURES.map(feature => {
                  const FeatureIcon = feature.icon;
                  const isSelected = disableConfig.features.includes(feature.key);
                  
                  return (
                    <div
                      key={feature.key}
                      onClick={() => {
                        setDisableConfig(prev => ({
                          ...prev,
                          features: isSelected
                            ? prev.features.filter(f => f !== feature.key)
                            : [...prev.features, feature.key]
                        }));
                      }}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Checkbox checked={isSelected} />
                      <FeatureIcon className={`h-4 w-4 text-${feature.color}-600`} />
                      <span className="font-medium text-sm">{feature.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <Label>Disable Duration</Label>
              <Select
                value={disableConfig.duration}
                onValueChange={(value) => setDisableConfig({...disableConfig, duration: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporary (Manual Re-enable)</SelectItem>
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for Disabling (Required)</Label>
              <Textarea
                placeholder="Explain why these features are being disabled..."
                value={disableConfig.reason}
                onChange={(e) => setDisableConfig({...disableConfig, reason: e.target.value})}
                rows={4}
              />
            </div>

            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-red-900">Warning</h4>
                  <p className="text-sm text-red-800">
                    Disabling features will immediately affect tenant users. This action is logged and can be audited.
                    Selected tenants: <strong>{tenants.filter(t => selectedTenants.includes(t.id)).map(t => t.name).join(', ')}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisableDialog(false)}
              disabled={toggleFeatureMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableFeatures}
              disabled={toggleFeatureMutation.isPending}
            >
              {toggleFeatureMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Disable Features
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

