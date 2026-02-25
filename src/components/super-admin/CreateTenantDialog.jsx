import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Building2, User, CreditCard, Settings, FileText, Shield } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function CreateTenantDialog({ open, onClose, onSubmit, loading }) {
  const [currentTab, setCurrentTab] = useState("tenant");

  // Fetch subscription plans from database
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => groonabackend.entities.SubscriptionPlan.filter({ is_active: true }, 'sort_order'),
    enabled: open,
  });

  const [formData, setFormData] = useState({
    // Tenant Information
    name: "",
    slug: "",
    domain: "",
    industry: "",
    company_type: "SOFTWARE",
    max_users: 5,
    
    // Primary Contact
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    owner_job_title: "",
    admin_username: "",
    
    // Authentication
    sso_type: "local",
    
    // Subscription & Plan
    subscription_plan: "free",
    subscription_plan_id: "",
    subscription_type: "trial",
    subscription_start_date: new Date().toISOString().split('T')[0],
    trial_ends_at: "",
    subscription_ends_at: "",
    
    // Billing
    billing_contact_name: "",
    billing_email: "",
    company_address: "",
    company_city: "",
    company_state: "",
    company_country: "",
    company_postal_code: "",
    billing_currency: "USD",
    billing_payment_method: "credit_card",
    
    // Technical & Configuration
    data_region: "us-east-1",
    default_language: "en-US",
    default_timezone: "UTC",
    api_access_enabled: false,
    custom_domain: "",
    
    // Features
    features_enabled: {
      ai_assistant: true,
      code_review: false,
      advanced_analytics: false,
      custom_branding: false,
      api_access: false,
    },
    
    // Compliance
    terms_accepted: false,
    dpa_accepted: false,
    privacy_policy_accepted: false,
    
    // Limits & Status
    max_projects: 10,
    max_storage_gb: 5,
    status: "trial",
    
    // Internal
    internal_notes: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error("Tenant name is required");
      setCurrentTab("tenant");
      return;
    }

    if (!formData.owner_email.trim()) {
      toast.error("Owner email is required");
      setCurrentTab("contact");
      return;
    }

    if (!formData.owner_name.trim()) {
      toast.error("Owner name is required");
      setCurrentTab("contact");
      return;
    }

    // Compliance validation
    if (!formData.terms_accepted) {
      toast.error("Terms & Conditions must be accepted");
      setCurrentTab("compliance");
      return;
    }

    if (!formData.dpa_accepted) {
      toast.error("Data Processing Agreement must be accepted");
      setCurrentTab("compliance");
      return;
    }

    if (!formData.privacy_policy_accepted) {
      toast.error("Privacy Policy must be accepted");
      setCurrentTab("compliance");
      return;
    }

    // Auto-generate slug if not provided
    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Auto-generate domain if not provided
    const domain = formData.domain || `${slug}.app.com`;

    // Set trial end date based on plan validity_days or default to 30 days
    let trialEndsAt = formData.trial_ends_at;
    if (!trialEndsAt && formData.subscription_type === 'trial') {
      const selectedPlan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
      const validityDays = selectedPlan?.validity_days || 30;
      const trialDate = new Date(formData.subscription_start_date);
      trialDate.setDate(trialDate.getDate() + validityDays);
      trialEndsAt = trialDate.toISOString();
    }

    // Set subscription end date based on plan validity_days
    let subscriptionEndsAt = formData.subscription_ends_at;
    if (!subscriptionEndsAt && formData.subscription_plan_id) {
      const selectedPlan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
      const validityDays = selectedPlan?.validity_days || 30;
      const endDate = new Date(formData.subscription_start_date);
      endDate.setDate(endDate.getDate() + validityDays);
      subscriptionEndsAt = endDate.toISOString();
    }

    // Auto-generate admin username if not provided
    const adminUsername = formData.admin_username || formData.owner_email.split('@')[0];

    // Set acceptance timestamps
    const now = new Date().toISOString();

    onSubmit({
      ...formData,
      slug,
      domain,
      admin_username: adminUsername,
      trial_ends_at: trialEndsAt,
      subscription_ends_at: subscriptionEndsAt,
      terms_accepted_at: formData.terms_accepted ? now : null,
      dpa_accepted_at: formData.dpa_accepted ? now : null,
      privacy_policy_accepted_at: formData.privacy_policy_accepted ? now : null,
    });
  };

  const handleClose = () => {
    setFormData({
      name: "",
      slug: "",
      domain: "",
      industry: "",
      company_type: "SOFTWARE",
      max_users: 5,
      owner_name: "",
      owner_email: "",
      owner_phone: "",
      owner_job_title: "",
      admin_username: "",
      sso_type: "local",
      subscription_plan: "free",
      subscription_plan_id: "",
      subscription_type: "trial",
      subscription_start_date: new Date().toISOString().split('T')[0],
      trial_ends_at: "",
      subscription_ends_at: "",
      billing_contact_name: "",
      billing_email: "",
      company_address: "",
      company_city: "",
      company_state: "",
      company_country: "",
      company_postal_code: "",
      billing_currency: "USD",
      billing_payment_method: "credit_card",
      data_region: "us-east-1",
      default_language: "en-US",
      default_timezone: "UTC",
      api_access_enabled: false,
      custom_domain: "",
      features_enabled: {
        ai_assistant: true,
        code_review: false,
        advanced_analytics: false,
        custom_branding: false,
        api_access: false,
      },
      terms_accepted: false,
      dpa_accepted: false,
      privacy_policy_accepted: false,
      max_projects: 10,
      max_storage_gb: 5,
      status: "trial",
      internal_notes: "",
    });
    setCurrentTab("tenant");
    onClose();
  };

  // Update features based on plan selection
  const handlePlanChange = (planId) => {
    const selectedPlan = subscriptionPlans.find(p => p.id === planId);
    if (selectedPlan) {
      setFormData({
        ...formData,
        subscription_plan: selectedPlan.name.toLowerCase(),
        subscription_plan_id: planId,
        features_enabled: {
          ai_assistant: selectedPlan.features?.ai_assistant_enabled || false,
          advanced_analytics: selectedPlan.features?.advanced_analytics_enabled || false,
          code_review: false,
          custom_branding: false,
          api_access: false,
        },
        max_users: selectedPlan.features?.max_users || 5,
        max_projects: selectedPlan.features?.max_projects || 10,
        max_workspaces: selectedPlan.features?.max_workspaces || 1,
        max_storage_gb: selectedPlan.features?.max_storage_gb || 5,
        api_access_enabled: false,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Create New Tenant
          </DialogTitle>
          <DialogDescription>
            Complete all required information to onboard a new tenant to the platform
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
                  <strong>Step 1 of 6:</strong> Enter basic tenant information and identification details.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tenant Name / Organization Name *</Label>
                  <Input
                    id="name"
                    placeholder="Acme Corporation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Tenant Code / Identifier</Label>
                  <Input
                    id="slug"
                    placeholder="acme-corp (auto-generated if empty)"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">URL-friendly identifier for the tenant</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain / Subdomain</Label>
                  <Input
                    id="domain"
                    placeholder="acme.app.com (auto-generated if empty)"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">Tenant's access domain</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom_domain">Custom Domain (Optional)</Label>
                  <Input
                    id="custom_domain"
                    placeholder="portal.acme.com"
                    value={formData.custom_domain}
                    onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">If tenant brings their own domain</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_type">Company Type *</Label>
                  <Select
                    value={formData.company_type}
                    onValueChange={(value) => setFormData({ ...formData, company_type: value })}
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
                    onValueChange={(value) => setFormData({ ...formData, industry: value })}
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
                  <Label htmlFor="max_users">Initial User Count / Seats</Label>
                  <Input
                    id="max_users"
                    type="number"
                    min="1"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-slate-500">Number of user licenses</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Tenant Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending - Setup in progress</SelectItem>
                      <SelectItem value="trial">Trial - Testing period</SelectItem>
                      <SelectItem value="active">Active - Full access</SelectItem>
                      <SelectItem value="suspended">Suspended - Access blocked</SelectItem>
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
                  <strong>Step 2 of 6:</strong> Enter primary contact details and authentication setup.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_name">Primary Contact Name *</Label>
                  <Input
                    id="owner_name"
                    placeholder="John Doe"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_email">Primary Contact Email (Login) *</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    placeholder="john@acme.com"
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
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
                    placeholder="+1 (555) 123-4567"
                    value={formData.owner_phone}
                    onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_job_title">Job Title / Role</Label>
                  <Input
                    id="owner_job_title"
                    placeholder="CEO, CTO, Project Manager, etc."
                    value={formData.owner_job_title}
                    onChange={(e) => setFormData({ ...formData, owner_job_title: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Authentication Setup</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin_username">Admin Username</Label>
                    <Input
                      id="admin_username"
                      placeholder="Auto-generated from email if empty"
                      value={formData.admin_username}
                      onChange={(e) => setFormData({ ...formData, admin_username: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sso_type">SSO / Authentication Type</Label>
                    <Select
                      value={formData.sso_type}
                      onValueChange={(value) => setFormData({ ...formData, sso_type: value })}
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

                <Alert className="mt-4 bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900 text-sm">
                    A temporary password setup link will be sent to the primary contact email after tenant creation.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* Tab 3: Subscription & Plan */}
            <TabsContent value="subscription" className="space-y-4 mt-4">
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  <strong>Step 3 of 6:</strong> Configure subscription plan and license details.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subscription_plan">Plan / Package Name *</Label>
                  <Select
                    value={formData.subscription_plan_id || ""}
                    onValueChange={handlePlanChange}
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
                              {plan.features?.max_users || 1} users - {plan.features?.max_projects || 5} projects - {plan.features?.max_storage_gb || 1}GB
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_type">Subscription Type</Label>
                  <Select
                    value={formData.subscription_type}
                    onValueChange={(value) => setFormData({ ...formData, subscription_type: value })}
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
                  <Label htmlFor="subscription_start_date">Subscription Start Date</Label>
                  <Input
                    id="subscription_start_date"
                    type="date"
                    value={formData.subscription_start_date}
                    onChange={(e) => setFormData({ ...formData, subscription_start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trial_ends_at">Trial End Date (Optional)</Label>
                  <Input
                    id="trial_ends_at"
                    type="date"
                    value={formData.trial_ends_at}
                    onChange={(e) => setFormData({ ...formData, trial_ends_at: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">Auto-set to 30 days if empty</p>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Resource Limits</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_users_limit">Max Users</Label>
                    <Input
                      id="max_users_limit"
                      type="number"
                      min="1"
                      value={formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_projects">Max Projects</Label>
                    <Input
                      id="max_projects"
                      type="number"
                      min="1"
                      value={formData.max_projects}
                      onChange={(e) => setFormData({ ...formData, max_projects: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_storage_gb">Max Storage (GB)</Label>
                    <Input
                      id="max_storage_gb"
                      type="number"
                      min="1"
                      value={formData.max_storage_gb}
                      onChange={(e) => setFormData({ ...formData, max_storage_gb: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Billing Information */}
            <TabsContent value="billing" className="space-y-4 mt-4">
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  <strong>Step 4 of 6:</strong> Enter billing contact and payment information.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billing_contact_name">Billing Contact Name</Label>
                  <Input
                    id="billing_contact_name"
                    placeholder="Same as primary contact if empty"
                    value={formData.billing_contact_name}
                    onChange={(e) => setFormData({ ...formData, billing_contact_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_email">Billing Email</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    placeholder="billing@acme.com"
                    value={formData.billing_email}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_address">Billing Address</Label>
                <Textarea
                  id="company_address"
                  placeholder="123 Business Street, Suite 100"
                  value={formData.company_address}
                  onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_city">City</Label>
                  <Input
                    id="company_city"
                    placeholder="San Francisco"
                    value={formData.company_city}
                    onChange={(e) => setFormData({ ...formData, company_city: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_state">State / Province</Label>
                  <Input
                    id="company_state"
                    placeholder="California"
                    value={formData.company_state}
                    onChange={(e) => setFormData({ ...formData, company_state: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_country">Country</Label>
                  <Input
                    id="company_country"
                    placeholder="United States"
                    value={formData.company_country}
                    onChange={(e) => setFormData({ ...formData, company_country: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_postal_code">Postal / Zip Code</Label>
                  <Input
                    id="company_postal_code"
                    placeholder="94102"
                    value={formData.company_postal_code}
                    onChange={(e) => setFormData({ ...formData, company_postal_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billing_currency">Currency</Label>
                  <Select
                    value={formData.billing_currency}
                    onValueChange={(value) => setFormData({ ...formData, billing_currency: value })}
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
                    onValueChange={(value) => setFormData({ ...formData, billing_payment_method: value })}
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

            {/* Tab 5: Technical Configuration */}
            <TabsContent value="technical" className="space-y-4 mt-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <strong>Step 5 of 6:</strong> Configure technical settings and feature access.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_region">Region / Data Center</Label>
                  <Select
                    value={formData.data_region}
                    onValueChange={(value) => setFormData({ ...formData, data_region: value })}
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
                    onValueChange={(value) => setFormData({ ...formData, default_language: value })}
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
                    onValueChange={(value) => setFormData({ ...formData, default_timezone: value })}
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
                    <Checkbox
                      checked={formData.features_enabled.ai_assistant}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          features_enabled: { ...formData.features_enabled, ai_assistant: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">Code Review</Label>
                      <p className="text-xs text-slate-600">AI-powered code analysis</p>
                    </div>
                    <Checkbox
                      checked={formData.features_enabled.code_review}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          features_enabled: { ...formData.features_enabled, code_review: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">Advanced Analytics</Label>
                      <p className="text-xs text-slate-600">Detailed insights and reports</p>
                    </div>
                    <Checkbox
                      checked={formData.features_enabled.advanced_analytics}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          features_enabled: { ...formData.features_enabled, advanced_analytics: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">Custom Branding</Label>
                      <p className="text-xs text-slate-600">Logo, colors, and theme customization</p>
                    </div>
                    <Checkbox
                      checked={formData.features_enabled.custom_branding}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          features_enabled: { ...formData.features_enabled, custom_branding: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="font-medium cursor-pointer">API Access</Label>
                      <p className="text-xs text-slate-600">REST API for integrations</p>
                    </div>
                    <Checkbox
                      checked={formData.api_access_enabled}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          api_access_enabled: checked,
                          features_enabled: { ...formData.features_enabled, api_access: checked },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-sm mb-3">Internal Notes</h4>
                <Textarea
                  placeholder="Add internal notes about this tenant (visible only to Super Admins)..."
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Tab 6: Compliance & Agreements */}
            <TabsContent value="compliance" className="space-y-4 mt-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Step 6 of 6:</strong> Review and accept all required compliance agreements.
                </AlertDescription>
              </Alert>

              <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms_accepted"
                    checked={formData.terms_accepted}
                    onCheckedChange={(checked) => setFormData({ ...formData, terms_accepted: checked })}
                    required
                  />
                  <div className="flex-1">
                    <Label htmlFor="terms_accepted" className="font-medium cursor-pointer">
                      Terms & Conditions Acceptance *
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      I confirm that the tenant agrees to the platform's Terms of Service and Acceptable Use Policy.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="dpa_accepted"
                    checked={formData.dpa_accepted}
                    onCheckedChange={(checked) => setFormData({ ...formData, dpa_accepted: checked })}
                    required
                  />
                  <div className="flex-1">
                    <Label htmlFor="dpa_accepted" className="font-medium cursor-pointer">
                      Data Processing Agreement (DPA) *
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      Required for GDPR compliance. The tenant acknowledges data processing terms and responsibilities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privacy_policy_accepted"
                    checked={formData.privacy_policy_accepted}
                    onCheckedChange={(checked) => setFormData({ ...formData, privacy_policy_accepted: checked })}
                    required
                  />
                  <div className="flex-1">
                    <Label htmlFor="privacy_policy_accepted" className="font-medium cursor-pointer">
                      Privacy Policy Acknowledgment *
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      The tenant has read and agrees to the Privacy Policy regarding data collection and usage.
                    </p>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Important:</strong> All compliance checkboxes must be accepted before creating the tenant. 
                  Acceptance timestamps will be recorded for audit purposes.
                </AlertDescription>
              </Alert>

              <Alert className="bg-blue-50 border-blue-200">
                <FileText className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 text-sm">
                  After tenant creation, a welcome email with setup instructions and temporary login credentials 
                  will be sent to the primary contact email address.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
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

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
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
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Tenant...
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 mr-2" />
                      Create Tenant
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

