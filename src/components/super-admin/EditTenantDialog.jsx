import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, Info, Upload, X, Building2, User, CreditCard, Settings, FileText, Shield } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function EditTenantDialog({ open, onClose, tenant, onSubmit }) {
  const [currentTab, setCurrentTab] = useState("tenant");
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch subscription plans from database
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => groonabackend.entities.SubscriptionPlan.filter({ is_active: true }, 'sort_order'),
    enabled: open,
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        // Tenant Information
        name: tenant.name || "",
        slug: tenant.slug || "",
        domain: tenant.domain || "",
        custom_domain: tenant.custom_domain || "",
        industry: tenant.industry || "",
        company_type: tenant.company_type || "SOFTWARE",
        max_users: tenant.max_users || 5,
        status: tenant.status || "active",

        // Primary Contact
        owner_name: tenant.owner_name || "",
        owner_email: tenant.owner_email || "",
        owner_phone: tenant.owner_phone || "",
        owner_job_title: tenant.owner_job_title || "",
        admin_username: tenant.admin_username || "",
        sso_type: tenant.sso_type || "local",

        // Tenant Config
        tenant_config: tenant.tenant_config || {
          enable_sprints: true,
          default_workflow: 'AGILE',
          require_task_approval: false,
          terminology_map: {}
        },

        // Subscription
        subscription_plan: tenant.subscription_plan || "free",
        subscription_plan_id: tenant.subscription_plan_id || "",
        subscription_type: tenant.subscription_type || "trial",
        subscription_start_date: tenant.subscription_start_date?.split('T')[0] || "",
        trial_ends_at: tenant.trial_ends_at?.split('T')[0] || "",
        subscription_ends_at: tenant.subscription_ends_at?.split('T')[0] || "",
        subscription_status: tenant.subscription_status || "active",
        max_projects: tenant.max_projects || 10,
        max_workspaces: tenant.max_workspaces || 1,
        max_storage_gb: tenant.max_storage_gb || 5,

        // Billing
        billing_contact_name: tenant.billing_contact_name || "",
        billing_email: tenant.billing_email || "",
        company_address: tenant.company_address || "",
        company_city: tenant.company_city || "",
        company_state: tenant.company_state || "",
        company_country: tenant.company_country || "",
        company_postal_code: tenant.company_postal_code || "",
        tax_id: tenant.tax_id || "",
        gst_number: tenant.gst_number || "",
        vat_number: tenant.vat_number || "",
        company_registration_number: tenant.company_registration_number || "",
        billing_currency: tenant.billing_currency || "USD",
        billing_payment_method: tenant.billing_payment_method || "credit_card",

        // Technical
        data_region: tenant.data_region || "us-east-1",
        default_language: tenant.default_language || "en-US",
        default_timezone: tenant.default_timezone || "UTC",
        api_access_enabled: tenant.api_access_enabled || false,
        api_rate_limit: tenant.api_rate_limit || 1000,

        // Features
        features_enabled: tenant.features_enabled || {
          ai_assistant: true,
          code_review: false,
          advanced_analytics: false,
          custom_branding: false,
          api_access: false,
        },

        // Branding
        branding: tenant.branding || {
          logo_url: "",
          primary_color: "#6366f1",
          company_website: "",
        },

        // Compliance
        terms_accepted: tenant.terms_accepted || false,
        dpa_accepted: tenant.dpa_accepted || false,
        privacy_policy_accepted: tenant.privacy_policy_accepted || false,

        // Internal
        internal_notes: tenant.internal_notes || "",
      });
      setHasChanges(false);
    }
  }, [tenant, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('[EditTenantDialog] Submitting form data:', formData);

    setLoading(true);
    try {
      // Update the tenant with all form data
      await onSubmit(formData);

      console.log('[EditTenantDialog] Tenant updated successfully');

      setHasChanges(false);
      toast.success('Tenant updated successfully!');
    } catch (error) {
      console.error('[EditTenantDialog] Update failed:', error);
      toast.error('Failed to update tenant: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleFieldChange = (field, value) => {
    console.log(`[EditTenantDialog] Field changed: ${field} = `, value);

    let newFormData = { ...formData, [field]: value };

    // Auto-suspend logic for Trial End Date
    if (field === 'trial_ends_at' && value) {
      // Parse YYYY-MM-DD to local midnight
      const [year, month, day] = value.split('-').map(Number);
      const trialDate = new Date(year, month - 1, day);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (trialDate < today) {
        newFormData.status = 'suspended';
        newFormData.subscription_status = 'past_due';
        toast.warning("Trial date is in the past. Tenant status set to Suspended.");
      } else if (trialDate.getTime() === today.getTime()) {
        toast.info("Trial ends today. Tenant will be suspended tomorrow.");
      } else {
        // If extending trial from a suspended state, reactive it
        if (formData.status === 'suspended' || formData.subscription_status === 'past_due') {
          newFormData.status = 'trial';
          newFormData.subscription_status = 'trialing';
          toast.success("Trial date extended. Tenant status set to Trial.");
        }
      }
    }

    setFormData(newFormData);
    setHasChanges(true);
  };

  const handleBrandingChange = (field, value) => {
    setFormData({
      ...formData,
      branding: { ...formData.branding, [field]: value },
    });
    setHasChanges(true);
  };

  const handleFeatureToggle = (feature, checked) => {
    console.log(`[EditTenantDialog] Feature toggled: ${feature} = ${checked}`);
    setFormData({
      ...formData,
      features_enabled: { ...formData.features_enabled, [feature]: checked },
    });
    setHasChanges(true);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      handleBrandingChange('logo_url', file_url);
      toast.success('Logo uploaded successfully!');
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    handleBrandingChange('logo_url', '');
    toast.success('Logo removed');
  };

  const applyPlanPreset = (planId) => {
    const selectedPlan = subscriptionPlans.find(p => p.id === planId);
    if (selectedPlan) {
      console.log('[EditTenantDialog] Applying plan preset:', selectedPlan.name);
      console.log('[EditTenantDialog] Plan features:', selectedPlan.features);

      const isTrial = selectedPlan.name.toLowerCase().includes('trial');
      const validityDays = selectedPlan.validity_days || 30;

      let trialEndsAt = formData.trial_ends_at;
      let subscriptionEndsAt = formData.subscription_ends_at;
      let subscriptionType = formData.subscription_type;
      let subscriptionStatus = formData.subscription_status;

      if (isTrial) {
        const date = new Date();
        date.setDate(date.getDate() + validityDays);
        trialEndsAt = date.toISOString().split('T')[0];
        subscriptionType = 'trial';
        subscriptionStatus = 'trialing';
      } else {
        // For paid plans, set subscription end date
        const date = new Date();
        date.setDate(date.getDate() + validityDays);
        subscriptionEndsAt = date.toISOString().split('T')[0];
      }

      setFormData({
        ...formData,
        subscription_plan: selectedPlan.name.toLowerCase(),
        subscription_plan_id: planId,
        subscription_type: subscriptionType,
        subscription_status: subscriptionStatus,
        trial_ends_at: trialEndsAt,
        subscription_ends_at: subscriptionEndsAt,
        max_users: selectedPlan.features?.max_users || 5,
        max_projects: selectedPlan.features?.max_projects || 10,
        max_workspaces: selectedPlan.features?.max_workspaces || 1,
        max_storage_gb: selectedPlan.features?.max_storage_gb || 5,
        features_enabled: {
          ai_assistant: selectedPlan.features?.ai_assistant_enabled || false,
          advanced_analytics: selectedPlan.features?.advanced_analytics_enabled || false,
          code_review: formData.features_enabled?.code_review || false,
          custom_branding: formData.features_enabled?.custom_branding || false,
          api_access: formData.api_access_enabled || false,
        },
        api_access_enabled: formData.api_access_enabled || false,
      });
      setHasChanges(true);

      console.log('[EditTenantDialog] Updated formData with plan features');
      toast.success(`Applied ${selectedPlan.name} plan settings`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Edit Tenant: {tenant?.name}
          </DialogTitle>
          <DialogDescription>
            Update comprehensive tenant information, subscription, and feature access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="tenant" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                Tenant
              </TabsTrigger>
              <TabsTrigger value="contact" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="subscription" className="text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                Subscription
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="technical" className="text-xs">
                <Settings className="h-3 w-3 mr-1" />
                Technical
              </TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Compliance
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Tenant Information */}
            <TabsContent value="tenant" className="space-y-4 mt-4">
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  Update basic tenant information and identification details.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tenant Name / Organization Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Acme Corporation"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Tenant Code / Identifier</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleFieldChange('slug', e.target.value)}
                    placeholder="acme-corp"
                  />
                  <p className="text-xs text-slate-500">URL-friendly identifier</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain / Subdomain</Label>
                  <Input
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => handleFieldChange('domain', e.target.value)}
                    placeholder="acme.app.com"
                  />
                  <p className="text-xs text-slate-500">Tenant's access domain</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom_domain">Custom Domain (Optional)</Label>
                  <Input
                    id="custom_domain"
                    value={formData.custom_domain}
                    onChange={(e) => handleFieldChange('custom_domain', e.target.value)}
                    placeholder="portal.acme.com"
                  />
                  <p className="text-xs text-slate-500">Tenant's own domain</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_type">Company Type *</Label>
                  <Select
                    value={formData.company_type}
                    onValueChange={(value) => handleFieldChange('company_type', value)}
                  >
                    <SelectTrigger id="company_type">
                      <SelectValue placeholder="Select company type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOFTWARE">Software Development</SelectItem>
                      <SelectItem value="MARKETING">Marketing Agency</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Determines UI terminology and features</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry / Business Type</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => handleFieldChange('industry', value)}
                  >
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Select industry..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Tenant Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleFieldChange('status', value)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending - Setup in progress</SelectItem>
                      <SelectItem value="trial">Trial - Testing period</SelectItem>
                      <SelectItem value="active">Active - Full access</SelectItem>
                      <SelectItem value="suspended">Suspended - Access blocked</SelectItem>
                      <SelectItem value="cancelled">Cancelled - Marked for deletion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Primary Contact & Authentication */}
            <TabsContent value="contact" className="space-y-4 mt-4">
              <Alert>
                <User className="h-4 w-4" />
                <AlertDescription>
                  Update primary contact details and authentication settings.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_name">Primary Contact Name *</Label>
                  <Input
                    id="owner_name"
                    value={formData.owner_name}
                    onChange={(e) => handleFieldChange('owner_name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_email">Primary Contact Email *</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    value={formData.owner_email}
                    onChange={(e) => handleFieldChange('owner_email', e.target.value)}
                    placeholder="john@acme.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_phone">Phone Number</Label>
                  <Input
                    id="owner_phone"
                    type="tel"
                    value={formData.owner_phone}
                    onChange={(e) => handleFieldChange('owner_phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_job_title">Job Title / Role</Label>
                  <Input
                    id="owner_job_title"
                    value={formData.owner_job_title}
                    onChange={(e) => handleFieldChange('owner_job_title', e.target.value)}
                    placeholder="CEO, CTO, Project Manager"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Authentication Settings</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin_username">Admin Username</Label>
                    <Input
                      id="admin_username"
                      value={formData.admin_username}
                      onChange={(e) => handleFieldChange('admin_username', e.target.value)}
                      placeholder="admin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sso_type">SSO / Authentication Type</Label>
                    <Select
                      value={formData.sso_type}
                      onValueChange={(value) => handleFieldChange('sso_type', value)}
                    >
                      <SelectTrigger id="sso_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local - Email/Password</SelectItem>
                        <SelectItem value="saml">SAML 2.0</SelectItem>
                        <SelectItem value="oauth">OAuth 2.0</SelectItem>
                        <SelectItem value="azure_ad">Azure Active Directory</SelectItem>
                        <SelectItem value="google">Google Workspace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Subscription & Plan */}
            <TabsContent value="subscription" className="space-y-4 mt-4">
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  Configure subscription plan, billing cycle, and resource limits.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subscription_plan">Plan / Package Name *</Label>
                  <Select
                    value={formData.subscription_plan_id || ""}
                    onValueChange={applyPlanPreset}
                  >
                    <SelectTrigger id="subscription_plan">
                      <SelectValue placeholder="Select a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subscriptionPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="space-y-0.5">
                            <div className="font-medium">{plan.name} - ${plan.monthly_price}/mo</div>
                            <div className="text-xs text-slate-500">
                              {plan.features?.max_users || 1} users - {plan.features?.max_projects || 5} projects - {plan.features?.max_workspaces || 1} workspaces - {plan.features?.max_storage_gb || 1}GB
                              {plan.features?.ai_assistant_enabled && ' - AI'}
                              {plan.features?.advanced_analytics_enabled && ' - Analytics'}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      {subscriptionPlans.length === 0 && (
                        <SelectItem value="none" disabled>
                          No plans available. Create plans in Subscription Management.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {formData.subscription_plan_id
                      ? `Current: ${subscriptionPlans.find(p => p.id === formData.subscription_plan_id)?.name || 'Unknown'}`
                      : 'No plan selected'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_type">Subscription Type</Label>
                  <Select
                    value={formData.subscription_type}
                    onValueChange={(value) => handleFieldChange('subscription_type', value)}
                  >
                    <SelectTrigger id="subscription_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial - Free period</SelectItem>
                      <SelectItem value="monthly">Monthly Billing</SelectItem>
                      <SelectItem value="annual">Annual Billing</SelectItem>
                      <SelectItem value="custom">Custom Agreement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subscription_status">Payment Status</Label>
                  <Select
                    value={formData.subscription_status}
                    onValueChange={(value) => handleFieldChange('subscription_status', value)}
                  >
                    <SelectTrigger id="subscription_status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active - Paid</SelectItem>
                      <SelectItem value="trialing">Trialing - Free period</SelectItem>
                      <SelectItem value="past_due">Past Due - Payment failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled - Will expire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_start_date">Subscription Start Date</Label>
                  <Input
                    id="subscription_start_date"
                    type="date"
                    value={formData.subscription_start_date}
                    onChange={(e) => handleFieldChange('subscription_start_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trial_ends_at">Trial End Date</Label>
                  <Input
                    id="trial_ends_at"
                    type="date"
                    value={formData.trial_ends_at}
                    onChange={(e) => handleFieldChange('trial_ends_at', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_ends_at">Subscription End / Renewal Date</Label>
                  <Input
                    id="subscription_ends_at"
                    type="date"
                    value={formData.subscription_ends_at}
                    onChange={(e) => handleFieldChange('subscription_ends_at', e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Resource Limits</h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_users_limit">Max Users</Label>
                    <Input
                      id="max_users_limit"
                      type="number"
                      min="1"
                      value={formData.max_users}
                      onChange={(e) => handleFieldChange('max_users', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_projects">Max Projects</Label>
                    <Input
                      id="max_projects"
                      type="number"
                      min="1"
                      value={formData.max_projects}
                      onChange={(e) => handleFieldChange('max_projects', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_workspaces">Max Workspaces</Label>
                    <Input
                      id="max_workspaces"
                      type="number"
                      min="1"
                      value={formData.max_workspaces}
                      onChange={(e) => handleFieldChange('max_workspaces', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_storage_gb">Max Storage (GB)</Label>
                    <Input
                      id="max_storage_gb"
                      type="number"
                      min="1"
                      value={formData.max_storage_gb}
                      onChange={(e) => handleFieldChange('max_storage_gb', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Billing Information */}
            <TabsContent value="billing" className="space-y-4 mt-4">
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  Update billing contact and payment information.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billing_contact_name">Billing Contact Name</Label>
                  <Input
                    id="billing_contact_name"
                    value={formData.billing_contact_name}
                    onChange={(e) => handleFieldChange('billing_contact_name', e.target.value)}
                    placeholder="Same as primary if empty"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_email">Billing Email</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    value={formData.billing_email}
                    onChange={(e) => handleFieldChange('billing_email', e.target.value)}
                    placeholder="billing@acme.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_address">Billing Address</Label>
                <Textarea
                  id="company_address"
                  value={formData.company_address}
                  onChange={(e) => handleFieldChange('company_address', e.target.value)}
                  placeholder="123 Business Street, Suite 100"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_city">City</Label>
                  <Input
                    id="company_city"
                    value={formData.company_city}
                    onChange={(e) => handleFieldChange('company_city', e.target.value)}
                    placeholder="San Francisco"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_state">State / Province</Label>
                  <Input
                    id="company_state"
                    value={formData.company_state}
                    onChange={(e) => handleFieldChange('company_state', e.target.value)}
                    placeholder="California"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_country">Country</Label>
                  <Input
                    id="company_country"
                    value={formData.company_country}
                    onChange={(e) => handleFieldChange('company_country', e.target.value)}
                    placeholder="United States"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_postal_code">Postal / Zip Code</Label>
                  <Input
                    id="company_postal_code"
                    value={formData.company_postal_code}
                    onChange={(e) => handleFieldChange('company_postal_code', e.target.value)}
                    placeholder="94102"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Tax Information</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">Tax ID / EIN</Label>
                    <Input
                      id="tax_id"
                      value={formData.tax_id}
                      onChange={(e) => handleFieldChange('tax_id', e.target.value)}
                      placeholder="12-3456789"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gst_number">GST Number (India)</Label>
                    <Input
                      id="gst_number"
                      value={formData.gst_number}
                      onChange={(e) => handleFieldChange('gst_number', e.target.value)}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">VAT Number (EU)</Label>
                    <Input
                      id="vat_number"
                      value={formData.vat_number}
                      onChange={(e) => handleFieldChange('vat_number', e.target.value)}
                      placeholder="GB123456789"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_registration_number">Registration Number</Label>
                    <Input
                      id="company_registration_number"
                      value={formData.company_registration_number}
                      onChange={(e) => handleFieldChange('company_registration_number', e.target.value)}
                      placeholder="Company registration number"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billing_currency">Currency</Label>
                  <Select
                    value={formData.billing_currency}
                    onValueChange={(value) => handleFieldChange('billing_currency', value)}
                  >
                    <SelectTrigger id="billing_currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_payment_method">Payment Method</Label>
                  <Select
                    value={formData.billing_payment_method}
                    onValueChange={(value) => handleFieldChange('billing_payment_method', value)}
                  >
                    <SelectTrigger id="billing_payment_method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="invoice">Invoice / Net 30</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Technical Configuration */}
            <TabsContent value="technical" className="space-y-4 mt-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Configure technical settings, features, and API access.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_region">Region / Data Center</Label>
                  <Select
                    value={formData.data_region}
                    onValueChange={(value) => handleFieldChange('data_region', value)}
                  >
                    <SelectTrigger id="data_region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                      <SelectItem value="eu-west-1">EU West (Ireland)</SelectItem>
                      <SelectItem value="eu-central-1">EU Central (Frankfurt)</SelectItem>
                      <SelectItem value="ap-south-1">Asia Pacific (Mumbai)</SelectItem>
                      <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_language">Default Language</Label>
                  <Select
                    value={formData.default_language}
                    onValueChange={(value) => handleFieldChange('default_language', value)}
                  >
                    <SelectTrigger id="default_language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                      <SelectItem value="es-ES">Spanish</SelectItem>
                      <SelectItem value="fr-FR">French</SelectItem>
                      <SelectItem value="de-DE">German</SelectItem>
                      <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                      <SelectItem value="hi-IN">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_timezone">Timezone</Label>
                  <Select
                    value={formData.default_timezone}
                    onValueChange={(value) => handleFieldChange('default_timezone', value)}
                  >
                    <SelectTrigger id="default_timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Kolkata">India</SelectItem>
                      <SelectItem value="Asia/Singapore">Singapore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Feature Toggles</h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">AI Assistant</Label>
                      <p className="text-xs text-slate-600">Enable AI-powered project assistance</p>
                    </div>
                    <Switch
                      checked={formData.features_enabled?.ai_assistant || false}
                      onCheckedChange={(checked) => handleFeatureToggle('ai_assistant', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">Advanced Analytics</Label>
                      <p className="text-xs text-slate-600">Detailed insights and reports</p>
                    </div>
                    <Switch
                      checked={formData.features_enabled?.advanced_analytics || false}
                      onCheckedChange={(checked) => handleFeatureToggle('advanced_analytics', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">Custom Branding</Label>
                      <p className="text-xs text-slate-600">Logo, colors, theme customization</p>
                    </div>
                    <Switch
                      checked={formData.features_enabled?.custom_branding || false}
                      onCheckedChange={(checked) => handleFeatureToggle('custom_branding', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">API Access</Label>
                      <p className="text-xs text-slate-600">REST API for integrations</p>
                    </div>
                    <Switch
                      checked={formData.api_access_enabled || false}
                      onCheckedChange={(checked) => {
                        handleFieldChange('api_access_enabled', checked);
                        handleFeatureToggle('api_access', checked);
                      }}
                    />
                  </div>
                </div>

                {formData.api_access_enabled && (
                  <div className="space-y-2 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Label htmlFor="api_rate_limit">API Rate Limit (requests/hour)</Label>
                    <Input
                      id="api_rate_limit"
                      type="number"
                      min="100"
                      max="100000"
                      value={formData.api_rate_limit}
                      onChange={(e) => handleFieldChange('api_rate_limit', parseInt(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Branding</h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    {formData.branding?.logo_url ? (
                      <div className="relative inline-block">
                        <img
                          src={formData.branding.logo_url}
                          alt="Tenant logo"
                          className="h-24 w-24 object-contain border-2 border-slate-200 rounded-lg bg-white p-2"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={handleRemoveLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50">
                        <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm text-slate-600">No logo uploaded</p>
                      </div>
                    )}

                    <div>
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        disabled={uploadingLogo}
                        className="w-full"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {formData.branding?.logo_url ? 'Change Logo' : 'Upload Logo'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Brand Color</Label>
                    <div className="flex gap-3">
                      <Input
                        id="primary_color"
                        type="color"
                        value={formData.branding?.primary_color || "#6366f1"}
                        onChange={(e) => handleBrandingChange('primary_color', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={formData.branding?.primary_color || "#6366f1"}
                        onChange={(e) => handleBrandingChange('primary_color', e.target.value)}
                        placeholder="#6366f1"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_website">Company Website</Label>
                    <Input
                      id="company_website"
                      type="url"
                      value={formData.branding?.company_website || ""}
                      onChange={(e) => handleBrandingChange('company_website', e.target.value)}
                      placeholder="https://company.com"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Internal Notes</h4>
                <Textarea
                  placeholder="Add internal notes about this tenant (visible only to Super Admins)..."
                  value={formData.internal_notes}
                  onChange={(e) => handleFieldChange('internal_notes', e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Tab 5: Compliance & Status */}
            <TabsContent value="compliance" className="space-y-4 mt-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  View and manage compliance acceptance status.
                </AlertDescription>
              </Alert>

              <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms_accepted"
                    checked={formData.terms_accepted}
                    onCheckedChange={(checked) => handleFieldChange('terms_accepted', checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="terms_accepted" className="font-medium cursor-pointer">
                      Terms & Conditions Accepted
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      Tenant agrees to platform's Terms of Service
                    </p>
                    {tenant?.terms_accepted_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Accepted: {new Date(tenant.terms_accepted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="dpa_accepted"
                    checked={formData.dpa_accepted}
                    onCheckedChange={(checked) => handleFieldChange('dpa_accepted', checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="dpa_accepted" className="font-medium cursor-pointer">
                      Data Processing Agreement (DPA)
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      Required for GDPR compliance
                    </p>
                    {tenant?.dpa_accepted_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Accepted: {new Date(tenant.dpa_accepted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privacy_policy_accepted"
                    checked={formData.privacy_policy_accepted}
                    onCheckedChange={(checked) => handleFieldChange('privacy_policy_accepted', checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="privacy_policy_accepted" className="font-medium cursor-pointer">
                      Privacy Policy Acknowledgment
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      Tenant acknowledges Privacy Policy
                    </p>
                    {tenant?.privacy_policy_accepted_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Accepted: {new Date(tenant.privacy_policy_accepted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 text-sm">
                  Compliance acceptance timestamps are recorded automatically when checkboxes are toggled.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-4">
              {hasChanges && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tabs = ["tenant", "contact", "subscription", "billing", "technical", "compliance"];
                  const currentIndex = tabs.indexOf(currentTab);
                  if (currentIndex > 0) {
                    setCurrentTab(tabs[currentIndex - 1]);
                  }
                }}
                disabled={currentTab === "tenant" || loading}
              >
                Previous
              </Button>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>

              {currentTab !== "compliance" ? (
                <Button
                  type="button"
                  onClick={() => {
                    const tabs = ["tenant", "contact", "subscription", "billing", "technical", "compliance"];
                    const currentIndex = tabs.indexOf(currentTab);
                    if (currentIndex < tabs.length - 1) {
                      setCurrentTab(tabs[currentIndex + 1]);
                    }
                  }}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || !hasChanges}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save All Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

