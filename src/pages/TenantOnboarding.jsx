import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Rocket } from "lucide-react";
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

export default function TenantOnboarding() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProgressing, setIsProgressing] = useState(false); // Flag to prevent step reset during progression
  const hasInitialized = useRef(false); // Track if we've initialized from saved step
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
        // If auth fails, redirect to sign in
        toast.error('Please sign in to continue');
        navigate(createPageUrl("SignIn"));
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, [navigate]);

  // Fetch tenant - use isFetching instead of isLoading to avoid showing loading during refetches
  const { data: tenant, isLoading: tenantLoading, isFetching: tenantFetching, error: tenantError } = useQuery({
    queryKey: ['tenant', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) {
        console.log('[TenantOnboarding] No tenant_id in user');
        return null;
      }
      try {
        console.log('[TenantOnboarding] Fetching tenant with _id:', currentUser.tenant_id);
        // Use _id instead of id for MongoDB compatibility
        const tenants = await groonabackend.entities.Tenant.filter({ _id: currentUser.tenant_id });
        const foundTenant = tenants[0] || null;
        console.log('[TenantOnboarding] Tenant found:', foundTenant ? foundTenant.name : 'null');
        return foundTenant;
      } catch (error) {
        console.error('[TenantOnboarding] Failed to fetch tenant:', error);
        toast.error('Failed to load tenant data. Please refresh the page.');
        return null;
      }
    },
    enabled: !!currentUser?.tenant_id && !loading,
    // Keep previous data during refetch to prevent loading screen
    placeholderData: (previousData) => previousData,
    retry: 2,
    retryDelay: 1000,
  });


  // Update tenant mutation
  const updateTenantMutation = useMutation({
    mutationFn: async (data) => {
      return await groonabackend.entities.Tenant.update(tenant.id, data);
    },
    onSuccess: (updatedTenant) => {
      // FIX: Immediate cache update to prevent stale data and loading screens
      queryClient.setQueryData(['tenant', currentUser?.tenant_id], (oldData) => {
        if (!oldData) return updatedTenant;
        return { ...oldData, ...updatedTenant };
      });
      
      // Also update all tenant queries
      queryClient.setQueriesData({ queryKey: ['tenant'] }, (oldData) => {
        // Handle if cache is a list or single object
        if (Array.isArray(oldData)) {
            return oldData.map(t => t.id === tenant.id ? { ...t, ...updatedTenant } : t);
        }
        if (oldData && oldData.id === tenant.id) {
          return { ...oldData, ...updatedTenant };
        }
        return oldData;
      });
      
      // Invalidate in background (don't wait for it) - this will refetch but we have cached data
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });

  const steps = [
    { id: 0, title: "Welcome", component: WelcomeStep },
    { id: 1, title: "Company Type", component: CompanyTypeStep },
    { id: 2, title: "Create Project", component: ProjectSetupStep },
    { id: 3, title: "Invite Team", component: TeamInviteStep },
    { id: 4, title: "Branding", component: BrandingStep },
    { id: 5, title: "Notifications", component: NotificationStep },
    { id: 6, title: "Complete", component: CompletionStep },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Resume from saved step when tenant is loaded (only once on initial load)
  useEffect(() => {
    if (tenant && !hasInitialized.current && !isProgressing) {
      hasInitialized.current = true;
      
      if (tenant.onboarding_step !== undefined && !tenant.onboarding_completed) {
        // Resume from saved step, but don't go beyond the last step
        const savedStep = Math.min(tenant.onboarding_step || 0, steps.length - 1);
        if (savedStep > 0) {
          setCurrentStep(savedStep);
        }
      }
      
      // Load saved onboarding data
      if (tenant.onboarding_data) {
        setOnboardingData(prev => ({
          ...prev,
          ...tenant.onboarding_data
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, isProgressing]);

  const handleNext = async (stepData) => {
    setIsProgressing(true); // Set flag to prevent step reset
    
    try {
      // Save step data
      const updatedData = { ...onboardingData, ...stepData };
      setOnboardingData(updatedData);

      const updates = {
        onboarding_step: currentStep + 1,
        onboarding_data: {
          ...tenant.onboarding_data,
          completed_steps: [...(tenant.onboarding_data?.completed_steps || []), steps[currentStep].title],
        }
      };

      // Handle company type selection (step 1)
      if (currentStep === 1 && stepData.company_type) {
        const defaultConfig = stepData.company_type === "MARKETING" ? {
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

        // Update tenant with company name and workspace name
        updates.name = stepData.company_name || tenant.name; // Company name becomes tenant name
        updates.company_name = stepData.company_name;
        updates.company_type = stepData.company_type;
        updates.industry = stepData.company_type === "MARKETING" ? "Marketing Agency" : "Software Development";
        updates.tenant_config = defaultConfig;
        updates.workspace_name = stepData.workspace_name;
        
        // Update tenant owner information
        updates.owner_email = currentUser.email;
        updates.owner_name = currentUser.full_name || currentUser.email;
        updates.owner_user_id = currentUser.id;

        // CRITICAL: Ensure user is set as admin with owner custom_role (organization head)
        try {
          await groonabackend.auth.updateMe({
            role: 'admin',
            custom_role: 'owner',
            tenant_id: tenant.id || tenant._id
          });
          console.log('[TenantOnboarding] ✅ Updated user role to admin with custom_role owner');
        } catch (error) {
          console.error('[TenantOnboarding] Failed to update user role:', error);
          toast.error('Failed to update user role. Please try again.');
        }

        // Create workspace with the provided workspace name
        if (stepData.workspace_name) {
          try {
            // Check if workspace already exists
            const existingWorkspaces = await groonabackend.entities.Workspace.filter({ 
              tenant_id: tenant.id,
              name: stepData.workspace_name 
            });

            if (existingWorkspaces.length === 0) {
              // Create new workspace
              const newWorkspace = await groonabackend.entities.Workspace.create({
                tenant_id: tenant.id,
                name: stepData.workspace_name,
                description: `Main workspace for ${stepData.company_name || tenant.name}`,
                is_default: true,
                owner_id: currentUser.id,
                owner_email: currentUser.email,
                owner_name: currentUser.full_name,
                members: [
                  {
                    user_id: currentUser.id,
                    user_email: currentUser.email,
                    user_name: currentUser.full_name || currentUser.email,
                    role: 'admin'
                  }
                ],
                created_by: currentUser.email
              });
              console.log('[TenantOnboarding] Created workspace:', newWorkspace.name);
            } else {
              console.log('[TenantOnboarding] Workspace already exists:', stepData.workspace_name);
            }
          } catch (error) {
            console.error('[TenantOnboarding] Failed to create workspace:', error);
            toast.error('Failed to create workspace. Please try again.');
          }
        }
      }

    // Handle team invites (step 3)
    if (currentStep === 3 && stepData.invites && stepData.invites.length > 0) {
      // Send invitation emails
      for (const invite of stepData.invites) {
        if (invite.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) {
          try {
            const invitationLink = `${window.location.origin}/accept-invitation?email=${encodeURIComponent(invite.email)}&tenant_id=${tenant.id}&role=${invite.role || 'user'}&custom_role=member&full_name=${encodeURIComponent(invite.email.split('@')[0])}`;
            
            await groonabackend.integrations.Core.SendEmail({
              to: invite.email,
              subject: `You've been invited to join ${tenant.name} on GROONA`,
              body: `
                <h2>Welcome to GROONA!</h2>
                <p>Hi there,</p>
                <p>You've been invited by ${currentUser.full_name} (${currentUser.email}) to join ${tenant.name} on GROONA.</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 10px 0;"><strong>Your Account Details:</strong></p>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Organization:</strong> ${tenant.name}</li>
                    <li><strong>Email:</strong> ${invite.email}</li>
                    <li><strong>Role:</strong> ${invite.role === 'admin' ? 'Administrator' : 'Member'}</li>
                  </ul>
                </div>

                <p>To accept this invitation and set up your password, please click the button below:</p>
                <p><a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a></p>
                
                <p>Or copy this link into your browser:</p>
                <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${invitationLink}</p>
                
                <p>Best regards,<br/>The GROONA AI Team</p>
              `
            });
          } catch (error) {
            console.error(`Failed to send invitation to ${invite.email}:`, error);
            toast.error(`Failed to send invitation to ${invite.email}`);
          }
        }
      }
      toast.success(`Invitation emails sent to ${stepData.invites.length} team member(s)!`);
    }

      // Update tenant with progress
      await updateTenantMutation.mutateAsync(updates);

      // Move to next step immediately (don't wait for query refetch)
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error('Error in handleNext:', error);
      toast.error('Failed to save progress. Please try again.');
    } finally {
      // Reset flag immediately after step change
      // The query will refetch in background but we don't need to wait for it
      setIsProgressing(false);
    }
  };


  const handleComplete = async () => {
    try {
      // 0. Ensure user role is set correctly before completing (safety check)
      try {
        await groonabackend.auth.updateMe({
          role: 'admin',
          custom_role: 'owner',
          tenant_id: tenant.id || tenant._id
        });
        console.log('[TenantOnboarding] ✅ Verified user role is admin with custom_role owner');
      } catch (error) {
        console.error('[TenantOnboarding] Failed to verify user role:', error);
        // Don't block completion if role update fails, but log it
      }

      // 1. Perform update in DB
      await updateTenantMutation.mutateAsync({
        onboarding_completed: true,
        onboarding_step: steps.length,
        owner_email: currentUser.email,
        owner_name: currentUser.full_name || currentUser.email,
        owner_user_id: currentUser.id,
      });

      // 2. CRITICAL FIX: Manually force the cache to 'true' immediately
      // This ensures Layout.jsx and UserProvider see the new status BEFORE we navigate
      const newTenantState = { ...tenant, onboarding_completed: true, onboarding_step: steps.length };
      
      // Update ALL possible query keys that might be used to check onboarding status
      // Key used by TenantOnboarding: ['tenant', tenant_id]
      queryClient.setQueryData(['tenant', currentUser?.tenant_id], newTenantState);
      queryClient.setQueryData(['tenant', tenant.id], newTenantState);
      queryClient.setQueryData(['tenant', tenant._id], newTenantState);
      
      // Key used by Layout.jsx: ['current-tenant-status', tenant_id]
      queryClient.setQueryData(['current-tenant-status', currentUser?.tenant_id], newTenantState);
      queryClient.setQueryData(['current-tenant-status', tenant.id], newTenantState);
      queryClient.setQueryData(['current-tenant-status', tenant._id], newTenantState);
      
      // Update all fuzzy tenant queries
      queryClient.setQueriesData({ queryKey: ['tenant'] }, (old) => {
         if (!old) return old;
         if (Array.isArray(old)) return old.map(t => 
           (t.id === tenant.id || t._id === tenant._id || t.id === tenant._id || t._id === tenant.id) 
             ? newTenantState 
             : t
         );
         if (old.id === tenant.id || old._id === tenant._id || old.id === tenant._id || old._id === tenant.id) {
           return newTenantState;
         }
         return old;
      });

      // Also update current-tenant-status queries
      queryClient.setQueriesData({ queryKey: ['current-tenant-status'] }, (old) => {
         if (!old) return old;
         if (Array.isArray(old)) return old.map(t => 
           (t.id === tenant.id || t._id === tenant._id || t.id === tenant._id || t._id === tenant.id) 
             ? newTenantState 
             : t
         );
         if (old.id === tenant.id || old._id === tenant._id || old.id === tenant._id || old._id === tenant.id) {
           return newTenantState;
         }
         return old;
      });

      // 3. Force invalidation to ensure sync (but we already have cached data)
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-status'] });

      console.log('[TenantOnboarding] ✅ Onboarding marked as complete. Cache updated for all query keys.');

      toast.success("Onboarding completed! Welcome to Groona AI! 🎉");
      
      // Small delay to ensure navigation happens after cache updates
      setTimeout(() => {
        navigate(createPageUrl("Dashboard"));
      }, 100);
    } catch (error) {
      console.error('[TenantOnboarding] Error completing onboarding:', error);
      toast.error("Failed to complete onboarding");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Show error if tenant query failed
  if (tenantError) {
    console.error('[TenantOnboarding] Tenant query error:', tenantError);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3">
            <Rocket className="h-8 w-8 text-red-600" />
            <p className="text-slate-600">Failed to load tenant data</p>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show loading only on initial load (when loading user or first tenant fetch)
  // Don't show loading if we have cached data or are progressing through steps
  const isInitialLoad = loading || (tenantLoading && !tenant);
  const hasData = currentUser && tenant;
  
  if (isInitialLoad && !hasData && !isProgressing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-blue-600 animate-pulse" />
            <p className="text-slate-600">Loading onboarding...</p>
          </div>
        </Card>
      </div>
    );
  }

  // If we still don't have data after loading completes, show error
  if (!loading && !tenantLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3">
            <Rocket className="h-8 w-8 text-red-600" />
            <p className="text-slate-600">Failed to load user data</p>
            <Button onClick={() => navigate(createPageUrl("SignIn"))}>Go to Sign In</Button>
          </div>
        </Card>
      </div>
    );
  }

  // If we have user but no tenant after query completes, show error
  if (!loading && !tenantLoading && currentUser && !tenant && currentUser.tenant_id) {
    console.error('[TenantOnboarding] User has tenant_id but tenant not found:', currentUser.tenant_id);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3">
            <Rocket className="h-8 w-8 text-red-600" />
            <p className="text-slate-600">Tenant not found</p>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </div>
        </Card>
      </div>
    );
  }

  // If we don't have data yet, show loading (this should only happen briefly on initial load)
  if (!hasData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-blue-600 animate-pulse" />
            <p className="text-slate-600">Loading onboarding...</p>
          </div>
        </Card>
      </div>
    );
  }

  // We have data, render the onboarding
  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Rocket className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Welcome to Groona
            </h1>
          </div>
          <p className="text-slate-600 text-lg">
            Let's get your workspace set up in just a few steps
          </p>
        </div>

        {/* Progress Bar - Merged with Step Circles */}
        <Card className="bg-white/80 backdrop-blur-xl">
          <CardContent className="pt-6 pb-8">
            <div className="space-y-4">
              {/* Step Indicators with Progress Bar */}
              <div className="relative py-8">
                {/* Step Circles - Evenly distributed */}
                <div className="relative flex justify-between items-center px-6">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex flex-col items-center gap-2 relative z-10"
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold transition-all shadow-lg relative ${
                          index < currentStep
                            ? 'bg-green-500 text-white'
                            : index === currentStep
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {index < currentStep ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span className={`text-xs font-medium text-center whitespace-nowrap ${
                        index <= currentStep ? 'text-slate-900' : 'text-slate-500'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Progress Bar Background - Centered through circles */}
                <div 
                  className="absolute h-2 bg-slate-200 rounded-full"
                  style={{ 
                    top: 'calc(2rem + 1.75rem)', // py-8 (2rem) + half of circle height (1.75rem = 28px)
                    left: 'calc(1.5rem + 1.75rem)', // px-6 (1.5rem) + half of circle width (1.75rem = 28px)
                    right: 'calc(1.5rem + 1.75rem)', // Same from right
                  }}
                />
                
                {/* Progress Bar Fill */}
                <div 
                  className="absolute h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                  style={{ 
                    top: 'calc(2rem + 1.75rem)', // Same as background
                    left: 'calc(1.5rem + 1.75rem)', // Start from first circle center
                    width: `calc((100% - 2 * (1.5rem + 1.75rem)) * ${progress} / 100)`, // Scale progress to fit between circles
                  }}
                />
                
                {/* Percentage Display - Bottom Right */}
                <div className="absolute bottom-0 right-6 text-xs text-slate-600 font-medium">
                  Completed {Math.round(progress)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Step Content */}
        <Card className="bg-white/80 backdrop-blur-xl">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

