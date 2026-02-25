import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";

export default function ReportBugDialog({ open, onClose, onSuccess }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    type: "bug",
    category: "",
    page_url: "",
    screenshots: [],
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      setCurrentUser(user);
      setFormData(prev => ({
        ...prev,
        page_url: window.location.href,
        browser_info: navigator.userAgent,
      }));
    });
  }, []);

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

    setSubmitting(true);
    try {
      const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
        ? currentUser.active_tenant_id 
        : currentUser?.tenant_id;

      const ticketCount = await groonabackend.entities.Ticket.filter({ tenant_id: effectiveTenantId });
      const ticketNumber = `TKT-${String(ticketCount.length + 1).padStart(4, '0')}`;

      await groonabackend.entities.Ticket.create({
        tenant_id: effectiveTenantId,
        ticket_number: ticketNumber,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        type: formData.type,
        category: formData.category || 'other',
        reporter_email: currentUser.email,
        reporter_name: currentUser.full_name,
        reporter_role: currentUser.role,
        page_url: formData.page_url,
        browser_info: formData.browser_info,
        screenshots: formData.screenshots,
        status: 'open',
        last_activity_at: new Date().toISOString(),
      });

      toast.success('Bug report submitted successfully!');
      
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        type: "bug",
        category: "",
        page_url: window.location.href,
        screenshots: [],
      });
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      toast.error('Failed to submit bug report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Report a Bug
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs or issues you encounter
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Issue Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select feature area..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="projects">Projects</SelectItem>
                <SelectItem value="tasks">Tasks</SelectItem>
                <SelectItem value="timesheets">Timesheets</SelectItem>
                <SelectItem value="ai_assistant">AI Assistant</SelectItem>
                <SelectItem value="collaboration">Collaboration</SelectItem>
                <SelectItem value="reports">Reports & Analytics</SelectItem>
                <SelectItem value="user_management">User Management</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Detailed Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Please describe the issue in detail. Include steps to reproduce if applicable."
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Screenshots / Attachments</Label>
            <div className="space-y-3">
              {formData.screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.screenshots.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border-2 border-slate-200"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeScreenshot(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <input
                  type="file"
                  id="file-upload"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Screenshots
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 bg-slate-50 rounded-lg text-xs">
            <div>
              <strong>Page URL:</strong> {formData.page_url}
            </div>
            <div>
              <strong>Browser:</strong> {formData.browser_info?.split(' ').slice(0, 3).join(' ')}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !formData.title.trim() || !formData.description.trim()}
              className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit Bug Report
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

