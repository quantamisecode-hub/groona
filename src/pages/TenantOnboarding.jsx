import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import WelcomeStep from "../components/onboarding/WelcomeStep";
import CompanyTypeStep from "../components/onboarding/CompanyTypeStep";
import ProjectSetupStep from "../components/onboarding/ProjectSetupStep";
import TeamInviteStep from "../components/onboarding/TeamInviteStep";
import BrandingStep from "../components/onboarding/BrandingStep";
import NotificationStep from "../components/onboarding/NotificationStep";
import CompletionStep from "../components/onboarding/CompletionStep";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function TenantOnboarding() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProgressing, setIsProgressing] = useState(false);
  const hasInitialized = useRef(false);
  const [onboardingData, setOnboardingData] = useState({
    projects: [],
    invites: [],
    branding: {},
    notifications: {},
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await groonabackend.auth.me();
        if (user.is_super_admin) {
          navigate(createPageUrl("Dashboard"));
          return;
        }
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
        toast.error('Please sign in to continue');
        navigate(createPageUrl("SignIn"));
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate]);

  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useQuery({
    queryKey: ['tenant', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return null;
      const tenants = await groonabackend.entities.Tenant.filter({ _id: currentUser.tenant_id });
      return tenants[0] || null;
    },
    enabled: !!currentUser?.tenant_id && !loading,
    placeholderData: (previousData) => previousData,
    retry: 2,
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data) => {
      return await groonabackend.entities.Tenant.update(tenant.id, data);
    },
    onSuccess: (updatedTenant) => {
      queryClient.setQueryData(['tenant', currentUser?.tenant_id], (oldData) => {
        if (!oldData) return updatedTenant;
        return { ...oldData, ...updatedTenant };
      });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });

  const steps = [
    { id: 0, title: "Welcome", component: WelcomeStep },
    { id: 1, title: "Organization", component: CompanyTypeStep },
    { id: 2, title: "Projects", component: ProjectSetupStep },
    { id: 3, title: "Team", component: TeamInviteStep },
    { id: 4, title: "Branding", component: BrandingStep },
    { id: 5, title: "Communications", component: NotificationStep },
    { id: 6, title: "Launch", component: CompletionStep },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    if (tenant && !hasInitialized.current && !isProgressing) {
      hasInitialized.current = true;
      if (tenant.onboarding_step !== undefined && !tenant.onboarding_completed) {
        const savedStep = Math.min(tenant.onboarding_step || 0, steps.length - 1);
        if (savedStep > 0) setCurrentStep(savedStep);
      }
      if (tenant.onboarding_data) {
        setOnboardingData(prev => ({ ...prev, ...tenant.onboarding_data }));
      }
    }
  }, [tenant, isProgressing, steps.length]);

  const handleNext = async (stepData) => {
    setIsProgressing(true);
    try {
      const updatedData = { ...onboardingData, ...stepData };
      setOnboardingData(updatedData);

      const updates = {
        onboarding_step: currentStep + 1,
        onboarding_data: {
          ...tenant.onboarding_data,
          completed_steps: [...(tenant.onboarding_data?.completed_steps || []), steps[currentStep].title],
        }
      };

      if (currentStep === 1 && stepData.company_type) {
        // ... (Logic remains identical to original for safety)
        const defaultConfig = stepData.company_type === "MARKETING" ? {
          enable_sprints: false,
          default_workflow: "CAMPAIGN",
          require_task_approval: true,
          terminology_map: {
            SPRINT: "Campaign", TASK: "Content", MILESTONE: "Phase",
            BACKLOG: "Content Pipeline", PROJECT: "Campaign", TEAM: "Agency Team"
          }
        } : {
          enable_sprints: true,
          default_workflow: "AGILE",
          require_task_approval: false,
          terminology_map: {
            SPRINT: "Sprint", TASK: "Task", MILESTONE: "Milestone",
            BACKLOG: "Backlog", PROJECT: "Project", TEAM: "Team"
          }
        };

        updates.name = stepData.company_name || tenant.name;
        updates.company_name = stepData.company_name;
        updates.company_type = stepData.company_type;
        updates.industry = stepData.company_type === "MARKETING" ? "Marketing Agency" : "Software Development";
        updates.tenant_config = defaultConfig;
        updates.workspace_name = stepData.workspace_name;
        updates.owner_email = currentUser.email;
        updates.owner_name = currentUser.full_name || currentUser.email;
        updates.owner_user_id = currentUser.id;

        await groonabackend.auth.updateMe({
          role: 'admin',
          custom_role: 'owner',
          tenant_id: tenant.id || tenant._id
        });

        if (stepData.workspace_name) {
          const existingWorkspaces = await groonabackend.entities.Workspace.filter({
            tenant_id: tenant.id,
            name: stepData.workspace_name
          });

          if (existingWorkspaces.length === 0) {
            await groonabackend.entities.Workspace.create({
              tenant_id: tenant.id,
              name: stepData.workspace_name,
              description: `Main workspace for ${stepData.company_name || tenant.name}`,
              is_default: true,
              owner_id: currentUser.id,
              owner_email: currentUser.email,
              owner_name: currentUser.full_name,
              members: [{ user_id: currentUser.id, user_email: currentUser.email, user_name: currentUser.full_name || currentUser.email, role: 'admin' }],
              created_by: currentUser.email
            });
          }
        }
      }

      if (currentStep === 3 && stepData.invites?.length > 0) {
        for (const invite of stepData.invites) {
          if (invite.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) {
            const invitationLink = `${window.location.origin}/accept-invitation?email=${encodeURIComponent(invite.email)}&tenant_id=${tenant.id}&role=${invite.role || 'user'}&custom_role=member&full_name=${encodeURIComponent(invite.email.split('@')[0])}`;
            await groonabackend.integrations.Core.SendEmail({
              to: invite.email,
              subject: `You've been invited to join ${tenant.name} on GROONA`,
              body: `<h2>Welcome to GROONA!</h2><p>You've been invited by ${currentUser.full_name} to join ${tenant.name}.</p><p><a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>`
            });
          }
        }
      }

      await updateTenantMutation.mutateAsync(updates);
      if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Error in handleNext:', error);
      toast.error('Failed to save progress');
    } finally {
      setIsProgressing(false);
    }
  };

  const handleComplete = async () => {
    try {
      await groonabackend.auth.updateMe({ role: 'admin', custom_role: 'owner', tenant_id: tenant.id || tenant._id });
      await updateTenantMutation.mutateAsync({
        onboarding_completed: true,
        onboarding_step: steps.length,
        owner_email: currentUser.email,
        owner_name: currentUser.full_name || currentUser.email,
        owner_user_id: currentUser.id,
      });

      const newTenantState = { ...tenant, onboarding_completed: true, onboarding_step: steps.length };
      queryClient.setQueryData(['tenant', currentUser?.tenant_id], newTenantState);
      queryClient.setQueryData(['current-tenant-status', currentUser?.tenant_id], newTenantState);

      toast.success("Welcome aboard! Your workspace is ready. 🎉");
      setTimeout(() => navigate(createPageUrl("Dashboard")), 100);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error("Failed to complete onboarding");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (tenantError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Connection Issue</h1>
          <p className="text-slate-500">We couldn't load your setup session. Please give it another try.</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">Retry Connection</Button>
        </div>
      </div>
    );
  }

  const isInitialLoad = loading || (tenantLoading && !tenant);
  const hasData = currentUser && tenant;

  if (isInitialLoad && !hasData && !isProgressing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-12 h-12 border-4 border-slate-100 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
          </div>
          <p className="text-slate-500 font-medium tracking-tight">Initializing Workspace...</p>
        </motion.div>
      </div>
    );
  }

  if (!hasData) return null;

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* Left Panel: Branding & Progress Indicator */}
      <div className="hidden md:flex md:w-[35%] lg:w-[30%] bg-slate-950 relative flex-col justify-between p-12 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Groona</span>
          </div>

          <div className="space-y-12">
            <div>
              <h1 className="text-3xl font-bold leading-tight mb-4">
                Let's build your <span className="text-blue-500">ideal workspace.</span>
              </h1>
              <p className="text-slate-400 leading-relaxed">
                Our AI-driven platform will help you manage projects and teams with unprecedented clarity.
              </p>
            </div>

            <nav className="space-y-6">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-4 group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${i === currentStep
                    ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : i < currentStep
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : "border-white/10 text-white/30"
                    }`}>
                    {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <span className={`text-sm font-bold transition-colors ${i === currentStep ? "text-white" : i < currentStep ? "text-slate-300" : "text-white/20"
                    }`}>
                    {s.title}
                  </span>
                </div>
              ))}
            </nav>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">
              {currentUser?.full_name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{currentUser?.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate">{currentUser?.email}</p>
            </div>
          </div>
        </div>

        {/* Decorative Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] aspect-square rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
      </div>

      {/* Right Panel: Content */}
      <main className="flex-1 flex flex-col relative h-full bg-white">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-600" />
            <span className="font-bold">Groona</span>
          </div>
          <div className="text-xs font-bold text-slate-400">Step {currentStep + 1} / {steps.length}</div>
        </div>

        {/* Top Header with Back Button */}
        <header className="h-20 flex items-center justify-between px-8 md:px-12 border-b border-slate-50 shrink-0">
          {currentStep > 0 ? (
            <button
              onClick={handleBack}
              className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
            >
              <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-slate-50 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              Go Previous
            </button>
          ) : <div />}

          <div className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            End-to-end Encrypted Setup
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-16 md:py-24">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <CurrentStepComponent
                  tenant={tenant}
                  user={currentUser}
                  data={onboardingData}
                  onNext={handleNext}
                  onBack={handleBack}
                  onComplete={handleComplete}
                  isFirstStep={currentStep === 0}
                  isLastStep={currentStep === steps.length - 1}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Persistent Bottom Bar for some steps if needed, or Footer */}
        <footer className="px-8 md:px-12 py-6 border-t border-slate-50 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Groona AI Intelligence
          </p>
          <div className="flex items-center gap-1">
            {[...Array(steps.length)].map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === currentStep ? "w-4 bg-blue-600" : "w-1.5 bg-slate-100"}`} />
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}

