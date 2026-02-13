import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Rocket, ChevronLeft, Sprout, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Step Components
import CompanySetupStep from "../components/user-onboarding/CompanySetupStep";
import EnhancedWorkSetupStep from "../components/user-onboarding/EnhancedWorkSetupStep";
import TeamSetupStep from "../components/user-onboarding/TeamSetupStep";
import FirstProjectStep from "../components/user-onboarding/FirstProjectStep";

export default function UserOnboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [initError, setInitError] = useState(null); // Added for error handling
  const [onboardingData, setOnboardingData] = useState({
    company: {},
    work: {},
    team: {},
    project: {}
  });

  const steps = [
    { id: 1, title: "Company Setup", component: CompanySetupStep, required: true },
    { id: 2, title: "Work Setup", component: EnhancedWorkSetupStep, required: true },
    { id: 3, title: "Team Setup", component: TeamSetupStep, required: false },
    { id: 4, title: "First Project", component: FirstProjectStep, required: true },
  ];

  const initOnboarding = async () => {
    setInitError(null);
    try {
      console.log('[UserOnboarding] Starting initialization...');
      const user = await groonabackend.auth.me();
      setCurrentUser(user);

      // Super Admins bypass onboarding
      if (user.is_super_admin) {
        navigate(createPageUrl("SuperAdminDashboard"));
        return;
      }

      let userTenant = null;
      let shouldCreateTenant = false;

      // Check if user has a tenant
      if (!user.tenant_id) {
        shouldCreateTenant = true;
      } else {
        // FIXED: Use _id for reliable lookup with Mongoose
        const tenants = await groonabackend.entities.Tenant.filter({ _id: user.tenant_id });
        userTenant = tenants[0];

        // If tenant not found OR it's a placeholder, create a new one
        // REMOVED: userTenant.owner_email !== user.email check. 
        // We shouldn't force new tenants on members just because they aren't the owner.
        if (!userTenant || userTenant.name === 'Quantamise Code') {
          shouldCreateTenant = true;
        }
      }

      // If user is a member of an existing valid tenant (and we aren't creating a new one)
      // They should not be in the onboarding flow for creating a workspace.
      if (!shouldCreateTenant && userTenant && userTenant.owner_email !== user.email) {
          queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] });
          navigate(createPageUrl("Dashboard"));
          return;
      }

      // Create new tenant for this user (Only if they truly have no tenant or own a placeholder)
      if (shouldCreateTenant) {
        console.log('[UserOnboarding] Creating new tenant for user:', user.email);
        
        const now = new Date();
        const trialEndDate = new Date(now);
        trialEndDate.setDate(now.getDate() + 14);

        const newTenant = await groonabackend.entities.Tenant.create({
          name: `${user.full_name}'s Workspace`,
          owner_email: user.email,
          owner_name: user.full_name,
          owner_user_id: user.id,
          status: 'trial',
          subscription_plan: 'starter',
          subscription_type: 'trial',
          subscription_status: 'trialing',
          trial_ends_at: trialEndDate.toISOString(),
          subscription_start_date: now.toISOString(),
          company_type: 'SOFTWARE',
          onboarding_completed: false,
          onboarding_step: 0,
          max_users: 10,
          max_projects: 20,
          max_storage_gb: 5,
          features_enabled: {
            ai_assistant: true,
            code_review: false,
            advanced_analytics: false,
            custom_branding: false,
            api_access: false,
          },
        });

        // Update user's tenant_id - owner should have admin role and owner custom_role
        await groonabackend.auth.updateMe({
          tenant_id: newTenant.id,
          role: 'admin',
          custom_role: 'owner'
        });

        userTenant = newTenant;
        toast.success('Welcome! Let\'s set up your workspace.');
        
        // Redirect to TenantOnboarding instead of continuing with UserOnboarding
        queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] });
        navigate(createPageUrl("TenantOnboarding"));
        return;
      } else {
        // Assign 14-day trial to existing tenants if needed (only for owners)
        if ((!userTenant.trial_ends_at || userTenant.status === 'pending') && userTenant.owner_email === user.email) {
          const now = new Date();
          const trialEndDate = new Date(now);
          trialEndDate.setDate(now.getDate() + 14);

          await groonabackend.entities.Tenant.update(userTenant.id, {
            subscription_plan: 'starter',
            subscription_type: 'trial',
            subscription_status: 'trialing',
            trial_ends_at: trialEndDate.toISOString(),
            subscription_start_date: now.toISOString(),
            status: 'trial',
          });

          // Re-fetch to ensure we have updated data
          const updatedTenants = await groonabackend.entities.Tenant.filter({ _id: userTenant.id });
          userTenant = updatedTenants[0];
        }
      }

      // If onboarding already completed, go to dashboard
      if (userTenant.onboarding_completed) {
        queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] });
        navigate(createPageUrl("Dashboard"));
        return;
      }

      setTenant(userTenant);
      
      // Auto-select free plan (starter plan)
      if (!userTenant.subscription_plan_id) {
        try {
          const subscriptionPlans = await groonabackend.entities.SubscriptionPlan.filter({ is_active: true }, 'sort_order');
          const freePlan = subscriptionPlans.find(p => 
            p.name.toLowerCase().includes('free') || 
            p.name.toLowerCase().includes('starter') || 
            p.name.toLowerCase().includes('trial') ||
            p.monthly_price === 0
          ) || subscriptionPlans[0]; // Fallback to first plan if no free plan found
          
          if (freePlan) {
            const now = new Date();
            const endDate = new Date(now);
            endDate.setDate(now.getDate() + (freePlan.validity_days || 14));
            
            const rawPlanName = freePlan.name?.toLowerCase() || 'starter';
            const validPlanEnum = rawPlanName.split(' ')[0];
            
            await groonabackend.entities.Tenant.update(userTenant.id, {
              subscription_plan_id: freePlan.id,
              subscription_plan: validPlanEnum,
              subscription_type: 'trial',
              subscription_status: 'trialing',
              subscription_start_date: now.toISOString(),
              trial_ends_at: endDate.toISOString(),
              max_users: freePlan.features?.max_users || 5,
              max_projects: freePlan.features?.max_projects || 10,
              max_workspaces: freePlan.features?.max_workspaces || 1,
              max_storage_gb: freePlan.features?.max_storage_gb || 5,
              features_enabled: {
                ai_assistant: freePlan.features?.ai_assistant_enabled || false,
                advanced_analytics: freePlan.features?.advanced_analytics_enabled || false,
                code_review: false,
                custom_branding: false,
                api_access: false,
              },
            });
            
            // Update onboarding data with plan selection
            setOnboardingData(prev => ({
              ...prev,
              plan_selection: {
                plan_id: freePlan.id,
                plan_name: freePlan.name,
                plan_features: freePlan.features,
                validity_days: freePlan.validity_days,
              }
            }));
          }
        } catch (error) {
          console.error('Failed to auto-select free plan:', error);
          // Continue with onboarding even if plan selection fails
        }
      }
      
      // Resume from saved step (adjust for removed step 1)
      if (userTenant.onboarding_step && userTenant.onboarding_step > 0) {
        // If saved step was 1 (plan selection), start at 1 (company setup)
        // If saved step was 2 (company setup), start at 1
        // If saved step was 3 (work setup), start at 2
        // etc.
        const adjustedStep = userTenant.onboarding_step === 1 ? 1 : userTenant.onboarding_step - 1;
        setCurrentStep(Math.min(adjustedStep, steps.length));
      } else {
        setCurrentStep(1); // Start at company setup
      }

      // Load saved data
      if (userTenant.onboarding_data) {
        setOnboardingData(prev => ({
          ...prev,
          ...userTenant.onboarding_data
        }));
      }
    } catch (error) {
      console.error('Failed to initialize onboarding:', error);
      setInitError(error.message || "Failed to initialize workspace.");
      toast.error('Initialization failed. Please try again.');
    }
  };

  useEffect(() => {
    initOnboarding();
  }, [navigate, queryClient]);

  const handleNext = async (stepData) => {
    const stepKey = steps[currentStep - 1].title.toLowerCase().replace(/\s+/g, '_');
    const updatedData = { ...onboardingData, [stepKey]: stepData };
    setOnboardingData(updatedData);

    try {
      await groonabackend.entities.Tenant.update(tenant.id, {
        onboarding_step: currentStep,
        onboarding_data: updatedData
      });

      // Step 1: Company Setup (Updates Software vs Marketing)
      if (currentStep === 1 && stepData.company_type) {
        const defaultConfig = stepData.company_type === 'MARKETING' ? {
          enable_sprints: false,
          enable_timesheets: true,
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
          enable_timesheets: true,
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

        // Ensure user is set as admin with owner custom_role (organization head)
        await groonabackend.auth.updateMe({
          role: 'admin',
          custom_role: 'owner',
          tenant_id: tenant.id
        });

        await groonabackend.entities.Tenant.update(tenant.id, {
          name: stepData.workspace_name,
          company_name: stepData.company_name,
          company_type: stepData.company_type,
          tenant_config: defaultConfig,
          owner_email: currentUser.email,
          owner_name: currentUser.full_name,
          owner_user_id: currentUser.id,
          industry: stepData.company_type === 'MARKETING' ? 'Marketing Agency' : 'Software Development',
        });
      }

      // Step 2: Work Setup
      if (currentStep === 2) {
        const currentConfig = tenant.tenant_config || {};
        await groonabackend.entities.Tenant.update(tenant.id, {
          tenant_config: {
            ...currentConfig,
            enable_sprints: stepData.enable_sprints,
            enable_timesheets: stepData.enable_timesheets,
            use_cases: stepData.use_cases
          }
        });
      }

      // Step 4: Completion
      if (currentStep === 4) {
        // Ensure user is set as admin with owner custom_role after completing onboarding
        await groonabackend.auth.updateMe({
          role: 'admin',
          custom_role: 'owner',
          tenant_id: tenant.id
        });

        await groonabackend.entities.Tenant.update(tenant.id, {
          onboarding_completed: true,
          status: 'active',
          onboarding_step: 6,
          onboarding_data: {
            ...updatedData,
            completed_steps: ['plan_selected', 'profile_completed', 'project_created'],
          }
        });

        toast.success('🎉 Welcome to Groona! Your workspace is ready.');
        queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] });
        queryClient.invalidateQueries({ queryKey: ['current-user'] });
        navigate(createPageUrl("Dashboard"));
        return;
      }

      setCurrentStep(currentStep + 1);
      
      const updatedTenants = await groonabackend.entities.Tenant.filter({ _id: tenant.id });
      setTenant(updatedTenants[0]);
      
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
      toast.error('Failed to save progress. Please try again.');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    if (steps[currentStep - 1].required) {
      toast.error('This step is required');
      return;
    }

    try {
      await groonabackend.entities.Tenant.update(tenant.id, {
        onboarding_step: currentStep,
        onboarding_data: {
          ...onboardingData,
          skipped_steps: [...(onboardingData.skipped_steps || []), steps[currentStep - 1].title]
        }
      });

      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Failed to skip step:', error);
      toast.error('Failed to skip step');
    }
  };

  // LOADING STATE
  if (!currentUser || (!tenant && !initError)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8 w-96 text-center shadow-xl border-slate-200/60 bg-white/80 backdrop-blur-xl">
          <div className="py-4">
            <Rocket className="h-12 w-12 text-blue-600 animate-bounce mx-auto mb-6" />
            <h3 className="text-xl font-bold text-slate-900">Preparing Workspace</h3>
            <p className="text-slate-500 text-sm mt-2">Setting up your environment...</p>
          </div>
        </Card>
      </div>
    );
  }

  // ERROR STATE
  if (initError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8 w-96 text-center shadow-xl border-red-100 bg-white/80 backdrop-blur-xl">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Setup Failed</h3>
              <p className="text-sm text-slate-500 mt-2">{initError}</p>
            </div>
            <Button onClick={() => initOnboarding()} className="w-full bg-slate-900 text-white hover:bg-slate-800">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Setup
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const CurrentStepComponent = steps[currentStep - 1].component;
  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* UPDATED: Changed from Green to Blue Gradient */}
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sprout className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">Groona</span>
          </div>
          <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            Step {currentStep} of {steps.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/60 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Progress value={progress} className="h-2 mb-4 bg-slate-100" />
          <div className="flex justify-between relative">
            {steps.map((step, idx) => (
              <span
                key={step.id}
                className={`text-xs font-medium transition-colors duration-200 ${
                  idx + 1 === currentStep
                    ? 'text-blue-600'
                    : idx + 1 < currentStep
                    ? 'text-green-600'
                    : 'text-slate-400'
                }`}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-xl shadow-slate-200/40">
          <CardContent className="pt-8 pb-8 px-8">
            <CurrentStepComponent
              data={onboardingData}
              tenant={tenant}
              user={currentUser}
              onNext={handleNext}
              onBack={handleBack}
              onSkip={handleSkip}
            />
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between mt-8 px-2">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          {!steps[currentStep - 1].required && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-slate-500 hover:text-slate-700"
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

