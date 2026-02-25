import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BrandingStep({ tenant, onNext, onSkip, onBack }) {
  const [branding, setBranding] = useState({
    logo_url: tenant.branding?.logo_url || "",
    primary_color: tenant.branding?.primary_color || "#3b82f6",
    company_website: tenant.branding?.company_website || "",
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      setBranding({ ...branding, logo_url: file_url });
      toast.success("Logo uploaded!");
    } catch (error) {
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      await groonabackend.entities.Tenant.update(tenant.id, {
        branding: branding,
      });

      toast.success("Branding saved!");
      onNext({ branding });
    } catch (error) {
      toast.error("Failed to save branding");
    } finally {
      setLoading(false);
    }
  };

  const customBrandingEnabled = tenant.features_enabled?.custom_branding;

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-3">
          <Palette className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Customize Your Workspace</h2>
        <p className="text-slate-600">
          {customBrandingEnabled 
            ? "Add your company branding to personalize the workspace"
            : "Custom branding is available on Professional and Enterprise plans"}
        </p>
      </div>

      {!customBrandingEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            ⭐ Upgrade to Professional or Enterprise plan to enable custom branding
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {branding.logo_url && (
              <img
                src={branding.logo_url}
                alt="Logo"
                className="h-16 w-16 object-contain border border-slate-200 rounded-lg p-2"
              />
            )}
            <div className="flex-1">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={!customBrandingEnabled || uploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">
                PNG, JPG or SVG. Max size 2MB.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Color */}
        <div className="space-y-3">
          <Label>Primary Color</Label>
          <div className="flex gap-3">
            <Input
              type="color"
              value={branding.primary_color}
              onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
              disabled={!customBrandingEnabled}
              className="w-20 h-10 cursor-pointer"
            />
            <Input
              type="text"
              value={branding.primary_color}
              onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
              disabled={!customBrandingEnabled}
              placeholder="#3b82f6"
              className="flex-1"
            />
          </div>
          <div className="h-8 rounded-lg" style={{ backgroundColor: branding.primary_color }} />
        </div>

        {/* Company Website */}
        <div className="space-y-3">
          <Label>Company Website (Optional)</Label>
          <Input
            type="url"
            placeholder="https://yourcompany.com"
            value={branding.company_website}
            onChange={(e) => setBranding({ ...branding, company_website: e.target.value })}
            disabled={!customBrandingEnabled}
          />
        </div>
      </div>

      {/* Preview */}
      {customBrandingEnabled && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
          <p className="text-sm font-medium text-slate-700 mb-3">Preview</p>
          <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
            {branding.logo_url && (
              <img src={branding.logo_url} alt="Logo" className="h-8 w-8 object-contain" />
            )}
            <div className="flex-1">
              <div 
                className="h-2 w-full rounded-full" 
                style={{ backgroundColor: branding.primary_color }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={loading || uploading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}

