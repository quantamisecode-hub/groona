import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Upload, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function BrandingStep({ tenant, onNext, onBack }) {
  const [branding, setBranding] = useState({
    logo_url: tenant.branding?.logo_url || "",
    primary_color: tenant.branding?.primary_color || "#2563eb",
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
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      await groonabackend.entities.Tenant.update(tenant.id, { branding });
      onNext({ branding });
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const customBrandingEnabled = true; // Forcing true for a better onboarding experience in this context

  return (
    <div className="w-full space-y-12">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          Make it <span className="text-blue-600">yours.</span>
        </h2>
        <p className="text-slate-500 text-xl max-w-2xl">
          Personalize your workspace with your company's visual identity. This will be visible to all invited members.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-10"
        >
          {/* Logo Section */}
          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Company Logo</Label>
            <div
              className="relative aspect-video w-full max-w-md rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-200 hover:bg-blue-50/30 transition-all overflow-hidden group shadow-sm"
              onClick={() => document.getElementById('logo-upload').click()}
            >
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain p-8" />
              ) : (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">Click to upload logo</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase">PNG, SVG or JPG (Max 2MB)</p>
                  </div>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}
            </div>
            <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
          </div>

          {/* Color Section */}
          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Brand Identity Color</Label>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl border border-slate-100 shadow-sm shrink-0 cursor-pointer overflow-hidden hover:scale-105 transition-transform"
                style={{ backgroundColor: branding.primary_color }}
                onClick={() => document.getElementById('color-picker').click()}
              />
              <div className="flex-1 space-y-2">
                <Input
                  type="text"
                  value={branding.primary_color}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  className="h-14 border-slate-100 focus:border-blue-600 rounded-2xl font-mono text-lg uppercase px-6"
                />
              </div>
              <input
                id="color-picker"
                type="color"
                className="hidden"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
              />
            </div>
            <p className="text-xs text-slate-400 font-medium">This color will be used for buttons, links, and primary UI elements.</p>
          </div>

          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Company Website</Label>
            <div className="relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300">
                <Upload className="w-5 h-5 rotate-90" /> {/* Reusing icon for world vibe or just input */}
              </div>
              <Input
                type="url"
                placeholder="https://acme.inc"
                value={branding.company_website}
                onChange={(e) => setBranding({ ...branding, company_website: e.target.value })}
                className="h-14 pl-14 border-slate-100 focus:border-blue-600 rounded-2xl text-lg"
              />
            </div>
          </div>
        </motion.div>

        {/* Live Preview Sidepanel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-8 lg:sticky lg:top-8"
        >
          <div className="p-8 md:p-12 rounded-[2.5rem] bg-slate-950 text-white shadow-2xl relative overflow-hidden group">
            <header className="relative z-10 flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden border border-white/5">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="w-6 h-6 rounded-md shadow-inner" style={{ backgroundColor: branding.primary_color }} />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-white/20 rounded-full" />
                  <div className="h-2 w-20 bg-white/10 rounded-full" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-white/10" />
                <div className="w-2 h-2 rounded-full bg-white/10" />
              </div>
            </header>

            <div className="relative z-10 space-y-6">
              <div className="space-y-3">
                <div className="h-3 w-full bg-white/10 rounded-full" />
                <div className="h-3 w-[85%] bg-white/10 rounded-full" />
                <div className="h-3 w-[60%] bg-white/5 rounded-full" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="h-14 rounded-2xl border border-white/10 flex items-center justify-center">
                  <div className="h-2 w-12 bg-white/20 rounded-full" />
                </div>
                <div className="h-14 rounded-2xl flex items-center justify-center shadow-lg hover:brightness-110 transition-all cursor-default"
                  style={{ backgroundColor: branding.primary_color }}>
                  <div className="h-2 w-12 bg-white/40 rounded-full" />
                </div>
              </div>
            </div>

            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          </div>

          <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 leading-none pt-1">Brand Consistency</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  A unified visual language helps teams feel part of something bigger. Your custom branding will be applied to invitation emails, the dashboard, and shared reports.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-8 border-t border-slate-100 flex items-center justify-between"
      >
        <Button variant="ghost" onClick={onBack} className="text-slate-400 hover:text-slate-600 rounded-full px-6">
          Previous
        </Button>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => onNext({ branding })} className="text-slate-400 hover:text-slate-600">
            Skip
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading || uploading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 h-14 font-semibold group flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save Branding <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

