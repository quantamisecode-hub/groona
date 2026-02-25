import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

export default function SubscriptionPlanDialog({ open, onClose, plan, onSubmit, loading }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    monthly_price: 0,
    annual_price: 0,
    currency: "USD",
    validity_days: 30,
    features: {
      max_users: 1,
      max_workspaces: 1,
      max_projects: 5,
      max_storage_gb: 1,
      ai_assistant_enabled: false,
      advanced_analytics_enabled: false,
    },
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || "",
        description: plan.description || "",
        monthly_price: plan.monthly_price || 0,
        annual_price: plan.annual_price || 0,
        currency: plan.currency || "USD",
        validity_days: plan.validity_days || 30,
        features: {
          max_users: plan.features?.max_users || 1,
          max_workspaces: plan.features?.max_workspaces || 1,
          max_projects: plan.features?.max_projects || 5,
          max_storage_gb: plan.features?.max_storage_gb || 1,
          ai_assistant_enabled: plan.features?.ai_assistant_enabled || false,
          advanced_analytics_enabled: plan.features?.advanced_analytics_enabled || false,
        },
        is_active: plan.is_active !== false,
        sort_order: plan.sort_order || 0,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        monthly_price: 0,
        annual_price: 0,
        currency: "USD",
        validity_days: 30,
        features: {
          max_users: 1,
          max_workspaces: 1,
          max_projects: 5,
          max_storage_gb: 1,
          ai_assistant_enabled: false,
          advanced_analytics_enabled: false,
        },
        is_active: true,
        sort_order: 0,
      });
    }
  }, [plan, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateFeature = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: value,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Subscription Plan" : "Create Subscription Plan"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Professional"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the plan"
                rows={2}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthly_price">Monthly Price ($) *</Label>
                <Input
                  id="monthly_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monthly_price}
                  onChange={(e) => setFormData({ ...formData, monthly_price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="annual_price">Annual Price ($) *</Label>
                <Input
                  id="annual_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.annual_price}
                  onChange={(e) => setFormData({ ...formData, annual_price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="validity_days">Plan Validity (Days) *</Label>
              <Input
                id="validity_days"
                type="number"
                min="1"
                value={formData.validity_days}
                onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) || 30 })}
                placeholder="e.g., 30 for monthly, 365 for annual"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Number of days the subscription is valid (e.g., 30 for monthly, 365 for annual)
              </p>
            </div>
          </div>

          {/* Limits */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Limits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_users">Max Users</Label>
                <Input
                  id="max_users"
                  type="number"
                  min="1"
                  value={formData.features.max_users}
                  onChange={(e) => updateFeature("max_users", parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="max_workspaces">Max Workspaces</Label>
                <Input
                  id="max_workspaces"
                  type="number"
                  min="1"
                  value={formData.features.max_workspaces}
                  onChange={(e) => updateFeature("max_workspaces", parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="max_projects">Max Projects</Label>
                <Input
                  id="max_projects"
                  type="number"
                  min="1"
                  value={formData.features.max_projects}
                  onChange={(e) => updateFeature("max_projects", parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="max_storage_gb">Storage (GB)</Label>
                <Input
                  id="max_storage_gb"
                  type="number"
                  min="1"
                  value={formData.features.max_storage_gb}
                  onChange={(e) => updateFeature("max_storage_gb", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Features</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai_assistant">AI Assistant</Label>
                <Switch
                  id="ai_assistant"
                  checked={formData.features.ai_assistant_enabled}
                  onCheckedChange={(checked) => updateFeature("ai_assistant_enabled", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="advanced_analytics">Advanced Analytics</Label>
                <Switch
                  id="advanced_analytics"
                  checked={formData.features.advanced_analytics_enabled}
                  onCheckedChange={(checked) => updateFeature("advanced_analytics_enabled", checked)}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Settings</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Plan Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                min="0"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : plan ? (
                "Update Plan"
              ) : (
                "Create Plan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}