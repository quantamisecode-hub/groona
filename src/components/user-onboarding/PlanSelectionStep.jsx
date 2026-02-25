import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Users, FolderKanban, HardDrive, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PlanSelectionStep({ data, onNext, onBack }) {
  const [selectedPlanId, setSelectedPlanId] = useState(data.plan_selection?.plan_id || null);

  const { data: subscriptionPlans = [], isLoading } = useQuery({
    queryKey: ['subscription-plans-onboarding'],
    queryFn: () => groonabackend.entities.SubscriptionPlan.filter({ is_active: true }, 'sort_order'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedPlan = subscriptionPlans.find(p => p.id === selectedPlanId);
    if (selectedPlan) {
      onNext({
        plan_id: selectedPlanId,
        plan_name: selectedPlan.name,
        plan_features: selectedPlan.features,
        validity_days: selectedPlan.validity_days,
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading plans...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Choose your plan
        </h2>
        <p className="text-slate-600">
          Select the plan that best fits your team's needs
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 text-sm">
          You can upgrade or downgrade your plan at any time from settings.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscriptionPlans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isTrial = plan.name.toLowerCase().includes('trial');

          return (
            <Card
              key={plan.id}
              className={`cursor-pointer transition-all p-6 ${
                isSelected
                  ? 'ring-2 ring-blue-500 bg-blue-50 shadow-lg'
                  : 'hover:shadow-md hover:border-blue-200'
              }`}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="space-y-4">
                {/* Plan Header */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{plan.description}</p>
                </div>

                {/* Pricing */}
                <div className="border-t border-b py-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">
                      ${plan.monthly_price}
                    </span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  {isTrial && (
                    <Badge className="mt-2 bg-amber-100 text-amber-800">
                      {plan.validity_days || 14} days free trial
                    </Badge>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span>{plan.features?.max_users || 1} Users</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FolderKanban className="h-4 w-4 text-purple-500" />
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
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          disabled={!selectedPlanId}
        >
          Continue
        </Button>
      </div>
    </form>
  );
}

