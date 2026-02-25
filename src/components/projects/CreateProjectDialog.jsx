import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Folder, Sparkles, Loader2, Users, Upload, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { aiService } from "../shared/aiService";

export default function CreateProjectDialog({
  open,
  onClose,
  onSubmit,
  loading,
  error,
  selectedTemplate = null,
  preselectedWorkspaceId = null
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logo_url: "",
    status: "planning",
    priority: "medium",
    deadline: "",
    progress: 0,
    color: "#3b82f6",
    workspace_id: "",
    team_members: [],
    billing_model: "time_and_materials",
    contract_amount: 0,
    budget_hours: 0,
    default_bill_rate_per_hour: 0,
    currency: "INR",
    client: "", // Organization ID
    client_user_id: "", // User ID
    contract_start_date: "",
    contract_end_date: "",
    estimated_duration: 0,
    non_billable_reason: "",
    retainer_period: "month",
    retainer_amount: 0,
  });
  const [showFinancialFields, setShowFinancialFields] = useState(false);

  const [validationErrors, setValidationErrors] = useState({});
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => { });
  }, []);

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Workspace.filter({ tenant_id: effectiveTenantId }, '-created_date');
    },
    enabled: !!currentUser,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return await groonabackend.entities.Client.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: clientUsers = [] } = useQuery({
    queryKey: ['client-users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId && u.custom_role === 'client');
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  // Filter Active Organizations (allowing undefined status for backward compatibility)
  const activeClientsMap = clients.reduce((acc, client) => {
    if (client.status === 'active' || !client.status) {
      acc[client.id] = client;
    }
    return acc;
  }, {});

  // Users who belong to Active Organizations
  const availableClientUsers = clientUsers.filter(u => u.client_id && activeClientsMap[u.client_id]);

  const accessibleWorkspaces = workspaces.filter(ws => {
    if (currentUser?.role === 'admin' || currentUser?.is_super_admin) return true;
    if (ws.owner_email === currentUser?.email) return true;
    const member = ws.members?.find(m => m.user_email === currentUser?.email);
    return member && (member.role === 'admin' || member.role === 'member');
  });

  useEffect(() => {
    if (open) {
      const initialWorkspaceId = preselectedWorkspaceId || "";

      if (selectedTemplate) {
        setFormData({
          name: selectedTemplate.name || "",
          description: selectedTemplate.description || "",
          logo_url: "",
          status: selectedTemplate.default_status || "planning",
          priority: selectedTemplate.default_priority || "medium",
          deadline: "",
          progress: 0,
          color: selectedTemplate.color || "#3b82f6",
          workspace_id: initialWorkspaceId,
          team_members: [],
          billing_model: selectedTemplate.billing_model || "time_and_materials",
          contract_amount: selectedTemplate.contract_amount || 0,
          budget_hours: selectedTemplate.budget_hours || 0,
          default_bill_rate_per_hour: selectedTemplate.default_bill_rate_per_hour || 0,
          contract_start_date: "",
          contract_end_date: "",
          estimated_duration: 0,
          non_billable_reason: "",
          retainer_period: "month",
          retainer_amount: 0,
        });
        setShowFinancialFields(!!(selectedTemplate.billing_model || selectedTemplate.contract_amount || selectedTemplate.budget_hours));
      } else {
        setFormData({
          name: "",
          description: "",
          logo_url: "",
          status: "planning",
          priority: "medium",
          deadline: "",
          progress: 0,
          color: "#3b82f6",
          workspace_id: initialWorkspaceId,
          team_members: [],
          billing_model: "time_and_materials",
          contract_amount: 0,
          budget_hours: 0,
          default_bill_rate_per_hour: 0,
          contract_start_date: "",
          contract_end_date: "",
          estimated_duration: 0,
          non_billable_reason: "",
          retainer_period: "month",
          retainer_amount: 0,
        });
        setShowFinancialFields(false);
      }
    } else {
      setFormData({
        name: "",
        description: "",
        logo_url: "",
        status: "planning",
        priority: "medium",
        deadline: "",
        progress: 0,
        color: "#3b82f6",
        workspace_id: "",
        team_members: [],
        billing_model: "time_and_materials",
        contract_amount: 0,
        budget_hours: 0,
        default_bill_rate_per_hour: 0,
        currency: "INR",
        contract_start_date: "",
        contract_end_date: "",
        estimated_duration: 0,
        non_billable_reason: "",
        retainer_period: "month",
        retainer_amount: 0,
      });
      setShowFinancialFields(false);
      setValidationErrors({});
    }
  }, [open, selectedTemplate, preselectedWorkspaceId]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      toast.success('Logo uploaded successfully!');
    } catch (error) {
      console.error('[CreateProject] Logo upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Project name is required';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Project name must be at least 3 characters';
    }

    if (!formData.workspace_id || formData.workspace_id === "" || formData.workspace_id === undefined) {
      errors.workspace_id = 'Workspace is required';
    }

    if (showFinancialFields) {
      if (formData.billing_model === "fixed_price") {
        if (!formData.contract_amount || formData.contract_amount <= 0) {
          errors.contract_amount = 'Contract amount is required for fixed price projects';
        }
        if (!formData.contract_start_date) errors.contract_start_date = "Start date is required";
        if (!formData.contract_end_date) errors.contract_end_date = "End date is required";
      }

      if (formData.billing_model === "time_and_materials") {
        if (!formData.estimated_duration || formData.estimated_duration <= 0) {
          errors.estimated_duration = "Duration is required for Time & Materials";
        }
      }

      if (formData.billing_model === "retainer") {
        if (!formData.contract_start_date) errors.contract_start_date = "Start date is required";
        if (!formData.contract_end_date) errors.contract_end_date = "End date is required";
        if (!formData.retainer_amount || formData.retainer_amount <= 0) errors.retainer_amount = "Retainer amount is required";
      }

      if (formData.billing_model === "non_billable") {
        if (!formData.non_billable_reason || !formData.non_billable_reason.trim()) {
          errors.non_billable_reason = "Reason is required for non-billable projects";
        }
      }

      if (formData.budget_hours && isNaN(Number(formData.budget_hours))) {
        errors.budget_hours = 'Budget hours must be a valid number';
      }

      if (formData.default_bill_rate_per_hour && isNaN(Number(formData.default_bill_rate_per_hour))) {
        errors.default_bill_rate = 'Bill rate must be a valid number';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerateDescription = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a project name first');
      return;
    }

    setGeneratingDescription(true);
    try {
      const prompt = `Generate a concise, professional project description for a project named "${formData.name}". 
      The description should be 2-3 sentences, explaining the project's purpose, scope, and expected outcomes. 
      Keep it clear, actionable, and suitable for a project management tool.`;

      const response = await aiService.invokeLLM(prompt, {
        addContextFromInternet: false,
      });

      setFormData({ ...formData, description: response });
      toast.success('Description generated successfully!');
    } catch (error) {
      console.error('[CreateProject] Failed to generate description:', error);
      toast.error('Failed to generate description. Please try again.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const toggleTeamMember = (userEmail) => {
    setFormData(prev => ({
      ...prev,
      team_members: prev.team_members.includes(userEmail)
        ? prev.team_members.filter(email => email !== userEmail)
        : [...prev.team_members, userEmail]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // CRITICAL FIX: Properly handle workspace_id
    const workspaceId = formData.workspace_id && formData.workspace_id !== ""
      ? formData.workspace_id
      : undefined;

    // Exclusivity Logic for Create Project
    let billingFields = {};

    if (showFinancialFields) {
      switch (formData.billing_model) {
        case 'time_and_materials':
          billingFields = {
            estimated_duration: Number(formData.estimated_duration) || 0,
            default_bill_rate_per_hour: Number(formData.default_bill_rate_per_hour) || 0,
            // Clear others just in case backend has defaults
            contract_amount: 0,
            budget: 0,
            retainer_amount: 0,
            retainer_period: null,
            non_billable_reason: null,
            contract_start_date: null,
            contract_end_date: null
          };
          break;

        case 'fixed_price':
          billingFields = {
            contract_amount: Number(formData.contract_amount) || 0,
            budget: Number(formData.contract_amount) || 0,
            contract_start_date: formData.contract_start_date || undefined,
            contract_end_date: formData.contract_end_date || undefined,
            // Clear others
            estimated_duration: 0,
            default_bill_rate_per_hour: 0,
            retainer_amount: 0,
            retainer_period: null,
            non_billable_reason: null
          };
          break;

        case 'retainer':
          billingFields = {
            retainer_amount: Number(formData.retainer_amount) || 0,
            retainer_period: formData.retainer_period || 'month',
            contract_start_date: formData.contract_start_date || undefined,
            contract_end_date: formData.contract_end_date || undefined,
            // Clear others
            contract_amount: 0,
            budget: 0,
            estimated_duration: 0,
            default_bill_rate_per_hour: 0,
            non_billable_reason: null
          };
          break;

        case 'non_billable':
          billingFields = {
            non_billable_reason: formData.non_billable_reason || undefined,
            // Clear others
            contract_amount: 0,
            budget: 0,
            estimated_duration: 0,
            default_bill_rate_per_hour: 0,
            retainer_amount: 0,
            retainer_period: null,
            contract_start_date: null,
            contract_end_date: null
          };
          break;
      }
    }

    const cleanData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      logo_url: formData.logo_url || undefined,
      status: formData.status,
      priority: formData.priority,
      deadline: formData.deadline || undefined,
      progress: formData.progress,
      color: formData.color,
      workspace_id: workspaceId,
      owner: currentUser?.email,
      client: formData.client || undefined,
      client_user_id: formData.client_user_id || undefined,
      team_members: formData.team_members.length > 0
        ? formData.team_members.map(email => ({
          email,
          role: 'member'
        }))
        : [],
      template_id: selectedTemplate?.id || undefined,

      // Financials
      ...(showFinancialFields ? {
        billing_model: formData.billing_model,
        currency: formData.currency,
        ...billingFields
      } : {}),
    };

    console.log('[CreateProjectDialog] Submitting:', cleanData);
    onSubmit(cleanData);
  };

  const getProjectInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'PR';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {selectedTemplate ? `Create Project from "${selectedTemplate.name}"` : 'Create New Project'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message?.includes('permission') || error.message?.includes('RLS') || error.message?.includes('policy')
                ? 'You need admin permissions to create projects. Contact your administrator.'
                : `Failed to create project: ${error.message || 'Please try again.'}`}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Logo Upload */}
          <div className="flex items-center gap-6">
            <div>
              <Label className="mb-2 block">Project Logo (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={loading || uploadingLogo}
              />
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-slate-200 shadow-md">
                  {formData.logo_url ? (
                    <AvatarImage src={formData.logo_url} alt="Project logo" />
                  ) : (
                    <AvatarFallback
                      className="text-white font-bold text-xl"
                      style={{ background: `linear-gradient(135deg, ${formData.color}, ${formData.color}dd)` }}
                    >
                      {formData.name ? getProjectInitials(formData.name) : <ImageIcon className="h-8 w-8" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  {formData.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, logo_url: "" })}
                      disabled={loading}
                      className="text-red-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-slate-500">PNG, JPG or GIF (max 5MB)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (validationErrors.name) {
                    setValidationErrors({ ...validationErrors, name: undefined });
                  }
                }}
                placeholder="Enter project name"
                className={validationErrors.name ? 'border-red-500' : ''}
                disabled={loading}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-600">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Project Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                  disabled={loading}
                />
                <span className="text-sm text-slate-600">{formData.color}</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="workspace">
                Workspace *
              </Label>
              {accessibleWorkspaces.length > 0 ? (
                <>
                  <Select
                    value={formData.workspace_id}
                    onValueChange={(value) => {
                      setFormData({ ...formData, workspace_id: value });
                      if (validationErrors.workspace_id) {
                        setValidationErrors({ ...validationErrors, workspace_id: undefined });
                      }
                    }}
                    disabled={loading || !!preselectedWorkspaceId}
                  >
                    <SelectTrigger id="workspace" className={validationErrors.workspace_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select a workspace..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleWorkspaces.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            {ws.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.workspace_id && (
                    <p className="text-xs text-red-600">{validationErrors.workspace_id}</p>
                  )}
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No workspaces available. Please create a workspace first.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className={`grid ${formData.client ? 'grid-cols-2' : ''} gap-6`}>
              <div className="space-y-2">
                <Label htmlFor="client_org">Client Organization</Label>
                <Select
                  value={formData.client}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      client: value,
                      client_user_id: "" // Reset user when org changes
                    });
                  }}
                  disabled={loading}
                >
                  <SelectTrigger id="client_org">
                    <SelectValue placeholder="Select an organization...">
                      {formData.client && activeClientsMap[formData.client] ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 border border-slate-200">
                            <AvatarImage src={activeClientsMap[formData.client]?.logo_url} className="object-cover" />
                            <AvatarFallback className="text-[10px]">
                              {activeClientsMap[formData.client]?.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {activeClientsMap[formData.client]?.name}
                        </div>
                      ) : "Select an organization..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(activeClientsMap).map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 border border-slate-200">
                            <AvatarImage src={client.logo_url} className="object-cover" />
                            <AvatarFallback className="text-[10px]">
                              {client.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {client.name}
                        </div>
                      </SelectItem>
                    ))}
                    {Object.keys(activeClientsMap).length === 0 && (
                      <div className="p-2 text-sm text-slate-500 text-center">No active clients found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Client User Selection - Only visible if Organization is selected */}
              {formData.client && (
                <div className="space-y-2">
                  <Label htmlFor="client_user">Client User</Label>
                  <Select
                    value={formData.client_user_id || "none"}
                    onValueChange={(userId) => {
                      setFormData({
                        ...formData,
                        client_user_id: userId === "none" ? "" : userId
                      });
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger id="client_user">
                      <SelectValue placeholder="Select a user...">
                        {formData.client_user_id ? (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col text-left">
                              <span className="font-medium text-sm leading-tight">
                                {availableClientUsers.find(u => u.id === formData.client_user_id)?.full_name || "Unknown User"}
                              </span>
                            </div>
                          </div>
                        ) : "Select a user..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-slate-500 italic">No Specific User</span>
                      </SelectItem>
                      {availableClientUsers
                        .filter(u => u.client_id === formData.client) // Filter users by selected Org
                        .map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2 w-full">
                              <span>{user.full_name}</span>
                              <span className="text-xs text-slate-400">({user.email})</span>
                            </div>
                          </SelectItem>
                        ))
                      }
                      {availableClientUsers.filter(u => u.client_id === formData.client).length === 0 && (
                        <div className="p-2 text-sm text-slate-500 text-center">No users found for this client</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={generatingDescription || loading || !formData.name.trim()}
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              >
                {generatingDescription ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Generate
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this project about?"
              rows={3}
              disabled={loading || generatingDescription}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (Optional)</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              disabled={loading}
            />
          </div>

          {currentUser?.custom_role !== 'project_manager' && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="financial-tracking"
                  checked={showFinancialFields}
                  onCheckedChange={setShowFinancialFields}
                  disabled={loading}
                />
                <Label htmlFor="financial-tracking" className="font-medium cursor-pointer">
                  Enable Financial Tracking
                </Label>
              </div>

              {showFinancialFields && (
                <div className="grid md:grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="billing_model">Billing Model</Label>
                    <Select
                      value={formData.billing_model}
                      onValueChange={(value) => setFormData({ ...formData, billing_model: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                        <SelectItem value="fixed_price">Fixed Price</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                        <SelectItem value="non_billable">Non-Billable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.billing_model !== 'non_billable' && formData.billing_model !== 'retainer' && (
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => setFormData({ ...formData, currency: value })}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="AUD">AUD (A$)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                          <SelectItem value="SGD">SGD (S$)</SelectItem>
                          <SelectItem value="AED">AED (dh)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Fixed Price Fields */}
                  {formData.billing_model === 'fixed_price' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="contract_amount">Fixed Price Amount</Label>
                        <Input
                          id="contract_amount"
                          type="number"
                          min="0"
                          value={formData.contract_amount}
                          onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                          placeholder="0.00"
                          className={validationErrors.contract_amount ? 'border-red-500' : ''}
                          disabled={loading}
                        />
                        {validationErrors.contract_amount && <p className="text-xs text-red-600">{validationErrors.contract_amount}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4 col-span-2">
                        <div className="space-y-2">
                          <Label>Contract Start Date *</Label>
                          <Input type="date" value={formData.contract_start_date} onChange={e => setFormData({ ...formData, contract_start_date: e.target.value })} className={validationErrors.contract_start_date ? 'border-red-500' : ''} />
                          {validationErrors.contract_start_date && <p className="text-xs text-red-600">{validationErrors.contract_start_date}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Contract End Date *</Label>
                          <Input type="date" value={formData.contract_end_date} onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} className={validationErrors.contract_end_date ? 'border-red-500' : ''} />
                          {validationErrors.contract_end_date && <p className="text-xs text-red-600">{validationErrors.contract_end_date}</p>}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Time & Materials Fields */}
                  {formData.billing_model === 'time_and_materials' && (
                    <>
                      <div className="space-y-2">
                        <Label>Estimated Duration (Hours) *</Label>
                        <Input type="number" min="0" value={formData.estimated_duration} onChange={e => setFormData({ ...formData, estimated_duration: e.target.value })} className={validationErrors.estimated_duration ? 'border-red-500' : ''} />
                        {validationErrors.estimated_duration && <p className="text-xs text-red-600">{validationErrors.estimated_duration}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="default_bill_rate">Default Bill Rate (/hr)</Label>
                        <Input
                          id="default_bill_rate"
                          type="number"
                          min="0"
                          value={formData.default_bill_rate_per_hour}
                          onChange={(e) => setFormData({ ...formData, default_bill_rate_per_hour: e.target.value })}
                          placeholder="0.00"
                          disabled={loading}
                        />
                      </div>
                    </>
                  )}

                  {/* Retainer Fields */}
                  {formData.billing_model === 'retainer' && (
                    <>
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Retainer Amount *</Label>
                          <Input type="number" min="0" value={formData.retainer_amount} onChange={e => setFormData({ ...formData, retainer_amount: e.target.value })} className={validationErrors.retainer_amount ? 'border-red-500' : ''} placeholder="3000" />
                          {validationErrors.retainer_amount && <p className="text-xs text-red-600">{validationErrors.retainer_amount}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Period</Label>
                          <Select value={formData.retainer_period} onValueChange={v => setFormData({ ...formData, retainer_period: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="week">Weekly</SelectItem>
                              <SelectItem value="month">Monthly</SelectItem>
                              <SelectItem value="quarter">Quarterly</SelectItem>
                              <SelectItem value="year">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Contract Start Date *</Label>
                          <Input type="date" value={formData.contract_start_date} onChange={e => setFormData({ ...formData, contract_start_date: e.target.value })} className={validationErrors.contract_start_date ? 'border-red-500' : ''} />
                          {validationErrors.contract_start_date && <p className="text-xs text-red-600">{validationErrors.contract_start_date}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Contract End Date *</Label>
                          <Input type="date" value={formData.contract_end_date} onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} className={validationErrors.contract_end_date ? 'border-red-500' : ''} />
                          {validationErrors.contract_end_date && <p className="text-xs text-red-600">{validationErrors.contract_end_date}</p>}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Non-Billable Fields */}
                  {formData.billing_model === 'non_billable' && (
                    <div className="col-span-2 space-y-2">
                      <Label>Reason for Non-Billable *</Label>
                      <Input value={formData.non_billable_reason} onChange={e => setFormData({ ...formData, non_billable_reason: e.target.value })} placeholder="e.g. Internal Training, Pro-bono work" className={validationErrors.non_billable_reason ? 'border-red-500' : ''} />
                      {validationErrors.non_billable_reason && <p className="text-xs text-red-600">{validationErrors.non_billable_reason}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {teamMembers.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite Team Members (Optional)
              </Label>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                <div className="space-y-2">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-2 hover:bg-white rounded transition-colors">
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={formData.team_members.includes(member.email)}
                        onCheckedChange={() => toggleTeamMember(member.email)}
                        disabled={loading || member.email === currentUser?.email}
                      />
                      <label htmlFor={`member-${member.id}`} className="flex-1 cursor-pointer text-sm">
                        <div className="font-medium text-slate-900">{member.full_name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </label>
                      {member.email === currentUser?.email && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {formData.team_members.length} member(s) selected
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || generatingDescription || uploadingLogo || accessibleWorkspaces.length === 0}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

