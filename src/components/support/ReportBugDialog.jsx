import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Ticket, Plus, FileText, Globe } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReportBugDialog({ open, onClose, onSuccess, tenantName: passedTenantName }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "Medium",
    type: "Technical",
    category: "other",
    page_url: "",
    screenshots: [],
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      groonabackend.auth.me().then(user => {
        setCurrentUser(user);
        setFormData(prev => ({
          ...prev,
          page_url: window.location.href,
          browser_info: navigator.userAgent,
        }));
      }).catch(err => {
        console.error("Failed to fetch user context:", err);
      });
    }
  }, [open]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file =>
        groonabackend.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const fileUrls = results.map(r => r.file_url);

      setFormData(prev => ({
        ...prev,
        screenshots: [...prev.screenshots, ...fileUrls]
      }));

      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const removeScreenshot = (index) => {
    setFormData(prev => ({
      ...prev,
      screenshots: prev.screenshots.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!currentUser) {
      toast.error('User context not found. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Determine Tenant Context
      const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
        ? currentUser.active_tenant_id
        : currentUser?.tenant_id;

      if (!effectiveTenantId) {
        console.warn("Missing tenant_id for ticket creation. Falling back to 'system' if allowed.");
      }

      // 2. Prepare Ticket Number
      let ticketNumber = "TKT-0001";
      try {
        const ticketCountList = await groonabackend.entities.Ticket.filter(
          effectiveTenantId ? { tenant_id: effectiveTenantId } : {}
        );
        if (Array.isArray(ticketCountList)) {
          ticketNumber = `TKT-${String(ticketCountList.length + 1).padStart(4, '0')}`;
        }
      } catch (err) {
        console.warn("Could not fetch ticket count for numbering:", err);
      }

      // 3. SYNC WITH GROONA SUPPORT APPLICATION (First, to get the canonical ticket ID)
      let supportAppTicketNumber = ticketNumber;
      try {
        const supportApiUrl = import.meta.env.VITE_SUPPORT_API_URL || "http://localhost:5001/api";

        // Fetch Tenant Name with high-reliability lookup hierarchy
        let tenantName = 'Individual';

        // 1. Priority: Prop passed from parent (Layout)
        if (passedTenantName && passedTenantName !== 'Individual' && passedTenantName !== 'Organization') {
          tenantName = passedTenantName;
        }
        // 2. Fallback: Direct inspection of currentUser fields
        else if (currentUser?.tenant_name) {
          tenantName = currentUser.tenant_name;
        } else if (currentUser?.organization_name) {
          tenantName = currentUser.organization_name;
        } else if (currentUser?.tenant?.name) {
          tenantName = currentUser.tenant.name;
        } else if (currentUser?.company_name) {
          tenantName = currentUser.company_name;
        }
        // 3. Last Resort: Intensive DB Lookup using available IDs
        else {
          const tid = effectiveTenantId || currentUser?.tenant_id || currentUser?.active_tenant_id;
          if (tid) {
            try {
              // Extract ID if it's an object (common in some SDKs)
              const cleanId = typeof tid === 'object' ? (tid._id || tid.id) : tid;
              const tenants = await groonabackend.entities.Tenant.filter({ _id: cleanId });

              if (tenants && tenants[0]) {
                const tDoc = tenants[0];
                tenantName = tDoc.name || tDoc.organization_name || tDoc.company_name || tDoc.tenant_name || 'Organization';
              }
            } catch (tErr) {
              console.warn("Could not fetch tenant name for reporting:", tErr);
            }
          }
        }

        // Final sanity check: if everything failed but it's a super admin, use 'System Admin'
        if (tenantName === 'Individual' && currentUser?.is_super_admin) {
          tenantName = 'System Admin';
        }

        const supportResponse = await fetch(`${supportApiUrl}/tickets/external-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            type: formData.type, // "Technical" or "NonTechnical"
            priority: formData.priority, // "Low", "Medium", "High"
            reporter_name: currentUser.full_name,
            reporter_email: currentUser.email,
            tenant_name: tenantName,
            attachments: formData.screenshots,
          }),
        });

        if (supportResponse.ok) {
          const supportTicketData = await supportResponse.json();
          if (supportTicketData && supportTicketData.ticket_number) {
            supportAppTicketNumber = supportTicketData.ticket_number;
          }
          console.log("Successfully submitted ticket to Groona Support Application as", supportAppTicketNumber);
        } else {
          console.warn("Groona Support Application returned an error:", await supportResponse.text());
        }
      } catch (supportError) {
        console.error("Failed to connect to Groona Support Application:", supportError);
      }

      // 4. SUBMIT TO GROONA INTERNAL BACKEND
      try {
        const internalTicketData = {
          tenant_id: effectiveTenantId || "default_tenant",
          tenant_name: tenantName,
          ticket_number: supportAppTicketNumber, // Use the ID from Support App if available
          title: formData.title,
          description: formData.description,
          priority: formData.priority.toUpperCase(),
          status: "OPEN",
          reporter_email: currentUser.email || "unknown@user.com",
          reporter_name: currentUser.full_name || "Unknown User",
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          page_url: formData.page_url,
          browser_info: formData.browser_info,
          screenshots: formData.screenshots,
          category: formData.category || 'other'
        };

        await groonabackend.entities.Ticket.create(internalTicketData);
        console.log("Successfully submitted ticket to Groona Internal Backend");
      } catch (internalError) {
        console.error("Groona Internal Backend Submission Failed:", internalError);
      }

      toast.success('Support request submitted successfully!');

      // Reset Form
      setFormData({
        title: "",
        description: "",
        priority: "Medium",
        type: "Technical",
        category: "other",
        page_url: window.location.href,
        screenshots: [],
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (outerError) {
      console.error('Submission failed:', outerError);
      toast.error('Failed to submit support request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] w-[95vw] p-0 rounded-3xl border-none shadow-2xl bg-white overflow-hidden max-h-[92vh] flex flex-col">
        {/* Accessibility Improvements */}
        <DialogHeader className="sr-only">
          <DialogTitle>Create Support Request</DialogTitle>
          <DialogDescription>Submit a new bug report or support ticket to our team.</DialogDescription>
        </DialogHeader>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="flex flex-row items-center justify-between pb-4 mb-2 border-b border-slate-50">
            <h2 className="text-2xl font-black text-[#111827] tracking-tight">
              Support Request
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            {/* SUBJECT */}
            <div className="space-y-2 text-left">
              <Label htmlFor="title" className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase ml-1">
                SUBJECT
              </Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors">
                  <Ticket className="h-4 w-4" />
                </div>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Issue title"
                  required
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 transition-all rounded-xl text-slate-700 text-sm font-semibold"
                />
              </div>
            </div>

            {/* DESCRIPTION */}
            <div className="space-y-2 text-left">
              <Label htmlFor="description" className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase ml-1">
                DESCRIPTION
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Details of the issue..."
                rows={4}
                required
                className="bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 transition-all rounded-xl text-slate-700 p-4 resize-none text-sm leading-relaxed"
              />
            </div>

            {/* TYPE & PRIORITY */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="type" className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase ml-1">
                  TYPE
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type" className="h-11 bg-slate-50 border-slate-200 rounded-xl text-slate-700 font-semibold text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    <SelectItem value="Technical" className="text-xs">Technical</SelectItem>
                    <SelectItem value="NonTechnical" className="text-xs">Non-Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 text-left">
                <Label htmlFor="priority" className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase ml-1">
                  PRIORITY
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger id="priority" className="h-11 bg-slate-50 border-slate-200 rounded-xl text-slate-700 font-semibold text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    <SelectItem value="Low" className="text-xs">Low</SelectItem>
                    <SelectItem value="Medium" className="text-xs">Medium</SelectItem>
                    <SelectItem value="High" className="text-xs">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ATTACHMENTS */}
            <div className="space-y-2 text-left">
              <Label className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase ml-1">
                ATTACHMENTS
              </Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-2xl p-5 transition-all bg-slate-50 flex flex-col items-center justify-center gap-2",
                  uploading ? "border-slate-100" : "border-slate-200 hover:border-blue-300 hover:bg-white cursor-pointer"
                )}
                onClick={() => !uploading && document.getElementById('file-upload')?.click()}
              >
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />

                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                </div>

                <div className="text-center">
                  <p className="font-bold text-slate-600 text-sm">
                    {uploading ? "Uploading..." : "Click to add screenshots"}
                  </p>
                </div>

                {formData.screenshots.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 w-full justify-center">
                    {formData.screenshots.map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="h-10 w-10 rounded-lg bg-white overflow-hidden border border-slate-100 shadow-sm transition-colors">
                          {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                            <img src={url} alt="upload" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <FileText className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
                          onClick={(e) => { e.stopPropagation(); removeScreenshot(index); }}
                        >
                          <X className="h-2.5 w-2.5 " />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting || !formData.title.trim() || !formData.description.trim()}
                className="w-full h-13 rounded-xl bg-[#0f172a] hover:bg-black text-white font-black text-base shadow-lg active:scale-[0.98] transition-all disabled:opacity-40 mt-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </Button>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold mt-4">
                <Globe className="h-3 w-3" />
                <span>Contextual Diagnostic Enabled</span>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
