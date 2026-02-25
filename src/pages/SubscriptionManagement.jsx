import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Users, Folder, HardDrive, FolderKanban, Sparkles, BarChart3, Loader2, Check, ShieldAlert, Zap, Crown, Building2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import SubscriptionPlanDialog from "../components/subscriptions/SubscriptionPlanDialog";
import { useUser } from "@/components/shared/UserContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function SubscriptionManagement() {
  const { user, tenant, subscription: currentSubscription, isLoading: isUserLoading } = useUser();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: plans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => groonabackend.entities.SubscriptionPlan.list('sort_order'),
    enabled: !!user,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list(),
    enabled: !!user?.is_super_admin,
  });

  // ... inside SubscriptionManagement component

  const createMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.SubscriptionPlan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowCreateDialog(false);
      toast.success('Subscription plan created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create plan', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.SubscriptionPlan.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setEditingPlan(null);
      toast.success('Subscription plan updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update plan', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.SubscriptionPlan.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setDeletingPlan(null);
      toast.success('Subscription plan deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete plan', { description: error.message });
    },
  });

  const getTenantsUsingPlan = (plan) => {
    return tenants.filter(t =>
      t.subscription_plan_id === plan.id ||
      t.subscription_plan === plan.name.toLowerCase()
    ).length;
  };

  const isCurrentPlan = (plan) => {
    if (!tenant) return false;
    // Check against tenant's plan ID or name
    return tenant.subscription_plan_id === plan.id ||
      tenant.subscription_plan?.toLowerCase() === plan.name.toLowerCase();
  };

  const upgradeMutation = useMutation({
    mutationFn: async (plan) => {
      if (!tenant?.id) throw new Error("Tenant ID not found");

      // 1. Update Tenant
      await groonabackend.entities.Tenant.update(tenant.id, {
        subscription_plan_id: plan.id,
        subscription_plan: plan.name,
        subscription_status: 'active',
        // Sync features to tenant root for easy access if needed, though mostly stored in subscription now
        max_users: plan.features?.max_users,
        max_projects: plan.features?.max_projects,
        max_workspaces: plan.features?.max_workspaces,
        max_storage_gb: plan.features?.max_storage_gb
      });

      // 2. Update/Create Subscription Record (Mocking payment success)
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + 1);

      const subData = {
        tenant_id: tenant.id,
        subscription_plan_id: plan.id,
        plan_name: plan.name,
        subscription_type: 'monthly',
        payment_status: 'active',
        start_date: now.toISOString(),
        end_date: nextMonth.toISOString(),
        trial_ends_at: null, // Clear trial if upgrading
        ...plan.features
      };

      // Check if sub exists
      if (currentSubscription) {
        await groonabackend.entities.TenantSubscription.update(currentSubscription.id, subData);
      } else {
        await groonabackend.entities.TenantSubscription.create(subData);
      }

      return plan;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] }); // Make sure to match the key in UserContext

      toast.success(`Successfully upgraded to ${plan.name}!`, {
        description: "Your workspace features have been updated."
      });

      // Reload page after short delay to refresh all contexts adequately
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (err) => {
      console.error(err);
      toast.error("Upgrade failed", { description: err.message });
    }
  });

  const handleUpgrade = (plan) => {
    // For now, directly call mock upgrade. In future, replace with Stripe Checkout.
    if (confirm(`Confirm upgrade to ${plan.name} for $${plan.monthly_price}/month?`)) {
      upgradeMutation.mutate(plan);
    }
  };

  if (isUserLoading || isPlansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Helper for icons (Plan Types)
  const getPlanIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('free')) return Sparkles;
    if (lower.includes('starter')) return Zap;
    if (lower.includes('pro')) return Crown;
    if (lower.includes('enterprise')) return Building2;
    return Folder;
  };

  // Helper for feature styling (Feature Types)
  const getFeatureConfig = (key) => {
    switch (key) {
      case 'max_users': return { icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'max_workspaces': return { icon: Folder, color: 'text-purple-600', bg: 'bg-purple-100' };
      case 'max_projects': return { icon: FolderKanban, color: 'text-green-600', bg: 'bg-green-100' };
      case 'max_storage_gb': return { icon: HardDrive, color: 'text-orange-600', bg: 'bg-orange-100' };
      case 'ai_assistant_enabled': return { icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-100' };
      case 'advanced_analytics_enabled': return { icon: BarChart3, color: 'text-cyan-600', bg: 'bg-cyan-100' };
      default: return { icon: Check, color: 'text-indigo-600', bg: 'bg-indigo-100' };
    }
  };

  // --- TENANT VIEW ---
  if (!user?.is_super_admin) {
    // Strict check: Only Admin role with 'owner' custom role can upgrade
    const isOwner = user?.role === 'admin' && user?.custom_role === 'owner';

    if (!isOwner) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="bg-slate-100 p-4 rounded-full mb-4">
            <ShieldAlert className="w-12 h-12 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-slate-600 max-w-md mb-8">
            Only workspace owners can view and manage subscription plans. Please contact your administrator if you need to upgrade.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Go Back to Dashboard
          </Button>
        </div>
      );
    }

    return (
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/Dashboard')}
          className="absolute left-4 top-4 md:left-8 md:top-8 text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Upgrade Your Workspace</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose the plan that fits your team's needs. All plans include a 14-day free trial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan);
            const Icon = getPlanIcon(plan.name);

            // Subscription Details Calculation
            let subDetails = null;
            if (isCurrent) {
              const subSource = currentSubscription || tenant;
              // Check for trial status - be robust with fields
              const isTrial =
                subSource.subscription_type === 'trial' ||
                subSource.status === 'trialing' ||
                subSource.subscription_status === 'trialing'; // Handle tenant object fallback

              const trialEndsAt = subSource.trial_ends_at; // Both models use this field

              if (isTrial && trialEndsAt) {
                const endDate = new Date(trialEndsAt);
                const isExpired = new Date() > endDate;
                const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

                subDetails = (
                  <div className={cn("mt-4 p-3 border rounded-lg text-sm", isExpired ? "bg-red-50 border-red-100 text-red-800" : "bg-amber-50 border-amber-100 text-amber-800")}>
                    <p className="font-semibold flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full animate-pulse", isExpired ? "bg-red-500" : "bg-amber-500")} />
                      {isExpired ? "Trial Expired" : "Trial Active"}
                    </p>
                    <div className="mt-1 flex justify-between text-xs opacity-90">
                      <span>Ends: {endDate.toLocaleDateString()}</span>
                      {!isExpired && <span>({daysLeft} days left)</span>}
                    </div>
                  </div>
                );
              } else if (subSource.subscription_type === 'monthly' || subSource.subscription_type === 'annual') {
                const startDate = subSource.start_date || subSource.subscription_start_date; // Handle different field names
                const renewDate = subSource.end_date || subSource.next_billing_date;

                subDetails = (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-800">
                    <p className="font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Active Subscription
                    </p>
                    <div className="mt-1 text-xs opacity-90 space-y-0.5">
                      {startDate && <div className="flex justify-between"><span>Started:</span> <span>{new Date(startDate).toLocaleDateString()}</span></div>}
                      {renewDate && <div className="flex justify-between"><span>Renews:</span> <span>{new Date(renewDate).toLocaleDateString()}</span></div>}
                    </div>
                  </div>
                );
              }
            }

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col transition-all duration-300",
                  isCurrent ? "border-indigo-600 ring-1 ring-indigo-600/20 shadow-xl scale-[1.02] z-10" : "border-slate-200 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1",
                  "bg-white"
                )}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 shadow-sm uppercase tracking-wide text-[10px]">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className={cn("pb-2", isCurrent ? "pt-8" : "")}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn("p-2 rounded-lg", isCurrent ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600")}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-900">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-500 line-clamp-2 min-h-[40px] leading-relaxed">
                    {plan.description}
                  </CardDescription>

                  {/* Subscription Status Block */}
                  {subDetails}
                </CardHeader>

                <CardContent className="flex-1 space-y-6 pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900">${plan.monthly_price}</span>
                    <span className="text-slate-500 font-medium">/month</span>
                  </div>

                  <div className="space-y-4">
                    {plan.features && Object.entries(plan.features).map(([key, value]) => {
                      if (typeof value === 'boolean' && !value) return null;

                      // Feature Configuration
                      const config = getFeatureConfig(key);
                      const FeatureIcon = config.icon;

                      // Label Formatting
                      let label = key.replace(/_/g, ' ');
                      if (key === 'max_users') label = `Up to ${value} Users`;
                      else if (key === 'max_workspaces') label = `${value} Workspaces`;
                      else if (key === 'max_projects') label = `${value} Projects`;
                      else if (key === 'max_storage_gb') label = `${value}GB Storage`;
                      else if (typeof value === 'boolean') label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                      return (
                        <div key={key} className="flex items-center gap-3 text-sm text-slate-700">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors", config.bg)}>
                            <FeatureIcon className={cn("h-4 w-4", config.color)} />
                          </div>
                          <span className="font-medium">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="pt-6 border-t border-slate-100">
                  {isCurrent ? (
                    <Button disabled className="w-full bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed font-medium">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full transition-all font-semibold",
                        isOwner
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 hover:bg-slate-100"
                      )}
                      onClick={() => handleUpgrade(plan)}
                      disabled={!isOwner || upgradeMutation.isPending}
                      title={!isOwner ? "Only the workspace owner can upgrade" : ""}
                    >
                      {upgradeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}

                      {!isOwner && !upgradeMutation.isPending && <ShieldAlert className="w-4 h-4 mr-2" />}

                      {isOwner
                        ? (upgradeMutation.isPending ? "Upgrading..." : "Upgrade to " + plan.name)
                        : "Upgrade (Owner Only)"
                      }
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // --- ADMIN VIEW (Existing) ---
  return (
    <div className="p-6 md:p-8 space-y-6 relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/Dashboard')}
        className="absolute left-4 top-4 md:left-8 md:top-8 text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Subscription Plans</h1>
          <p className="text-slate-600">Manage subscription plans for tenants</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {isPlansLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
          <CardContent className="py-20 text-center">
            <p className="text-slate-600 mb-4">No subscription plans created yet.</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="bg-white/60 backdrop-blur-xl border-slate-200/60 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                  </div>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pricing */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    ${plan.monthly_price}
                  </span>
                  <span className="text-slate-500">/month</span>
                </div>
                <div className="text-sm text-slate-600">
                  ${plan.annual_price}/year (annual billing)
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Valid for {plan.validity_days || 30} days
                </div>

                {/* Features */}
                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span>{plan.features?.max_users || 1} Users</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Folder className="h-4 w-4 text-purple-500" />
                    <span>{plan.features?.max_workspaces || 1} Workspaces</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FolderKanban className="h-4 w-4 text-green-500" />
                    <span>{plan.features?.max_projects || 5} Projects</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <HardDrive className="h-4 w-4 text-orange-500" />
                    <span>{plan.features?.max_storage_gb || 1} GB Storage</span>
                  </div>
                  {plan.features?.ai_assistant_enabled && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span>AI Assistant</span>
                    </div>
                  )}
                  {plan.features?.advanced_analytics_enabled && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <BarChart3 className="h-4 w-4 text-cyan-500" />
                      <span>Advanced Analytics</span>
                    </div>
                  )}
                </div>

                {/* Tenants using this plan */}
                <div className="text-xs text-slate-500 pt-2">
                  {getTenantsUsingPlan(plan)} tenant(s) using this plan
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditingPlan(plan)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeletingPlan(plan)}
                    disabled={getTenantsUsingPlan(plan) > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      {/* Create/Edit Dialog */}
      <SubscriptionPlanDialog
        open={showCreateDialog || !!editingPlan}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingPlan(null);
        }}
        plan={editingPlan}
        onSubmit={(data) => {
          if (editingPlan) {
            updateMutation.mutate({ id: editingPlan.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPlan?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deletingPlan.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

