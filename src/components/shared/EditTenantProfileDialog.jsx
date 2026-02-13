import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Upload, X, Building2, MapPin, Hash, Globe, CreditCard, Settings as SettingsIcon, Zap, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function EditTenantProfileDialog({ open, onClose, tenant, onSuccess }) {
  const [formData, setFormData] = useState({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (tenant) {
      setFormData({
        // Basic Info
        name: tenant.name || "",
        company_phone: tenant.company_phone || "",
        billing_email: tenant.billing_email || "",
        company_registration_number: tenant.company_registration_number || "",
        
        // Location
        company_address: tenant.company_address || "",
        company_city: tenant.company_city || "",
        company_state: tenant.company_state || "",
        company_country: tenant.company_country || "",
        company_postal_code: tenant.company_postal_code || "",
        
        // Tax & Legal
        tax_id: tenant.tax_id || "",
        gst_number: tenant.gst_number || "",
        vat_number: tenant.vat_number || "",
        
        // Subscription (Read-only for non-super-admins)
        subscription_plan: tenant.subscription_plan || "free",
        subscription_status: tenant.subscription_status || "active",
        max_users: tenant.max_users || 5,
        max_projects: tenant.max_projects || 10,
        max_storage_gb: tenant.max_storage_gb || 5,
        
        // Features (Read-only for non-super-admins)
        features_enabled: tenant.features_enabled || {
          ai_assistant: true,
          code_review: false,
          advanced_analytics: false,
          custom_branding: false,
          api_access: false,
        },
        
        // Branding
        branding: {
          logo_url: tenant.branding?.logo_url || "",
          primary_color: tenant.branding?.primary_color || "#6366f1",
          company_website: tenant.branding?.company_website || "",
        },
      });
      setHasChanges(false);
    }
  }, [tenant, open]);

  const handleFieldChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setHasChanges(true);
  };

  const handleBrandingChange = (field, value) => {
    setFormData({
      ...formData,
      branding: { ...formData.branding, [field]: value },
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
      toast.success('Logo uploaded!');
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    try {
      // Update tenant
      await groonabackend.entities.Tenant.update(tenant.id, formData);
      
      toast.success('Company profile updated successfully!');
      setHasChanges(false);
      
      // Trigger refresh and close
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const planColors = {
    free: "bg-slate-100 text-slate-800",
    starter: "bg-blue-100 text-blue-800",
    professional: "bg-purple-100 text-purple-800",
    enterprise: "bg-amber-100 text-amber-800",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Company Settings
          </DialogTitle>
          <DialogDescription>
            Manage your company information, subscription, and feature access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="tax">Tax & Legal</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
            </TabsList>

            {/* Basic Information */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  Update your company's basic information and contact details.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_phone">Company Phone</Label>
                <Input
                  id="company_phone"
                  type="tel"
                  value={formData.company_phone}
                  onChange={(e) => handleFieldChange('company_phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_email">Billing Email</Label>
                <Input
                  id="billing_email"
                  type="email"
                  value={formData.billing_email}
                  onChange={(e) => handleFieldChange('billing_email', e.target.value)}
                  placeholder="billing@company.com"
                />
                <p className="text-xs text-slate-500">Email for invoices and billing notifications</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_registration">Company Registration Number</Label>
                <Input
                  id="company_registration"
                  value={formData.company_registration_number}
                  onChange={(e) => handleFieldChange('company_registration_number', e.target.value)}
                  placeholder="Registration or incorporation number"
                />
              </div>
            </TabsContent>

            {/* Location Information */}
            <TabsContent value="location" className="space-y-4 mt-4">
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  Provide your company's physical address for billing and compliance.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="company_address">Street Address</Label>
                <Textarea
                  id="company_address"
                  value={formData.company_address}
                  onChange={(e) => handleFieldChange('company_address', e.target.value)}
                  placeholder="123 Business Street, Suite 100"
                  rows={3}
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
                  <Label htmlFor="company_state">State/Province</Label>
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
                  <Label htmlFor="company_postal_code">Postal/Zip Code</Label>
                  <Input
                    id="company_postal_code"
                    value={formData.company_postal_code}
                    onChange={(e) => handleFieldChange('company_postal_code', e.target.value)}
                    placeholder="94102"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tax & Legal Information */}
            <TabsContent value="tax" className="space-y-4 mt-4">
              <Alert>
                <Hash className="h-4 w-4" />
                <AlertDescription>
                  Tax information for proper invoicing and compliance. Optional but recommended.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="tax_id" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Tax ID / EIN
                </Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => handleFieldChange('tax_id', e.target.value)}
                  placeholder="12-3456789"
                />
                <p className="text-xs text-slate-500">
                  Tax Identification Number or Employer Identification Number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst_number" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  GST Number (India)
                </Label>
                <Input
                  id="gst_number"
                  value={formData.gst_number}
                  onChange={(e) => handleFieldChange('gst_number', e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                />
                <p className="text-xs text-slate-500">
                  Goods and Services Tax Identification Number (for Indian companies)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vat_number" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  VAT Number (EU)
                </Label>
                <Input
                  id="vat_number"
                  value={formData.vat_number}
                  onChange={(e) => handleFieldChange('vat_number', e.target.value)}
                  placeholder="GB123456789"
                />
                <p className="text-xs text-slate-500">
                  Value Added Tax Number (for EU companies)
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Tax information is kept secure and only used for billing purposes.
                  It helps ensure accurate invoices and tax compliance.
                </p>
              </div>
            </TabsContent>

            {/* Branding */}
            <TabsContent value="branding" className="space-y-4 mt-4">
              <Alert>
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  Customize your company logo, brand colors, and website information.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="space-y-4">
                  {formData.branding?.logo_url ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.branding.logo_url}
                        alt="Company logo"
                        className="h-24 w-24 object-contain border-2 border-slate-200 rounded-lg bg-white p-2"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={() => handleBrandingChange('logo_url', '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50">
                      <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-600 mb-2">No logo uploaded</p>
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
                    <p className="text-xs text-slate-500 mt-2">
                      PNG, JPG or SVG. Max 5MB. Recommended: 200x200px
                    </p>
                  </div>
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
                <p className="text-xs text-slate-500">Used for buttons and accent elements</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Company Website
                </Label>
                <Input
                  id="company_website"
                  type="url"
                  value={formData.branding?.company_website || ""}
                  onChange={(e) => handleBrandingChange('company_website', e.target.value)}
                  placeholder="https://company.com"
                />
              </div>
            </TabsContent>

            {/* Subscription & Features - READ ONLY */}
            <TabsContent value="subscription" className="space-y-4 mt-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Note:</strong> Subscription and feature settings are managed by platform administrators. Contact support to upgrade or modify your plan.
                </AlertDescription>
              </Alert>

              {/* Current Plan Display */}
              <div className="space-y-2">
                <Label>Current Plan</Label>
                <div className="p-4 bg-white border-2 border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={planColors[formData.subscription_plan]}>
                      {formData.subscription_plan?.charAt(0).toUpperCase() + formData.subscription_plan?.slice(1)} Plan
                    </Badge>
                    <Badge variant="outline">
                      {formData.subscription_status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    Your current subscription tier and billing status
                  </p>
                </div>
              </div>

              {/* Resource Limits Display */}
              <div className="space-y-2">
                <Label>Resource Limits</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-900">{formData.max_users}</div>
                    <div className="text-xs text-slate-600 mt-1">Max Users</div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-900">{formData.max_projects}</div>
                    <div className="text-xs text-slate-600 mt-1">Max Projects</div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-900">{formData.max_storage_gb}GB</div>
                    <div className="text-xs text-slate-600 mt-1">Storage</div>
                  </div>
                </div>
              </div>

              {/* Feature Access Display */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Enabled Features
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">AI Assistant</div>
                      <div className="text-xs text-slate-600">Chat with AI for project insights</div>
                    </div>
                    {formData.features_enabled?.ai_assistant ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Code Review</div>
                      <div className="text-xs text-slate-600">AI-powered code analysis</div>
                    </div>
                    {formData.features_enabled?.code_review ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Advanced Analytics</div>
                      <div className="text-xs text-slate-600">Detailed insights and reports</div>
                    </div>
                    {formData.features_enabled?.advanced_analytics ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Custom Branding</div>
                      <div className="text-xs text-slate-600">Logo and theme customization</div>
                    </div>
                    {formData.features_enabled?.custom_branding ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">API Access</div>
                      <div className="text-xs text-slate-600">REST API for integrations</div>
                    </div>
                    {formData.features_enabled?.api_access ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  <strong>Want to upgrade?</strong> Contact your platform administrator or support team to discuss plan upgrades and additional features.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xs text-slate-500">
              {hasChanges && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Info className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !hasChanges}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

