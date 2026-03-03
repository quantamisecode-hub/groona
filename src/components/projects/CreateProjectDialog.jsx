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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  Folder,
  Sparkles,
  Loader2,
  Users,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { aiService } from "../shared/aiService";

export default function CreateProjectDialog({
  open,
  onClose,
  onSubmit,
  loading,
  error,
  selectedTemplate = null,
  preselectedWorkspaceId = null,
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
    expense_budget: 0,
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
    queryKey: ["workspaces", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Workspace.filter({ tenant_id: effectiveTenantId }, "-created_date");
    },
    enabled: !!currentUser,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["users", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter((u) => u.tenant_id === effectiveTenantId);
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return await groonabackend.entities.Client.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const { data: clientUsers = [] } = useQuery({
    queryKey: ["client-users", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter((u) => u.tenant_id === effectiveTenantId && u.custom_role === "client");
    },
    enabled: !!currentUser && !!effectiveTenantId,
  });

  const activeClientsMap = clients.reduce((acc, client) => {
    if (client.status === "active" || !client.status) {
      acc[client.id] = client;
    }
    return acc;
  }, {});

  const availableClientUsers = clientUsers.filter((u) => u.client_id && activeClientsMap[u.client_id]);

  const accessibleWorkspaces = workspaces.filter((ws) => {
    if (currentUser?.role === "admin" || currentUser?.is_super_admin) return true;
    if (ws.owner_email === currentUser?.email) return true;
    const member = ws.members?.find((m) => m.user_email === currentUser?.email);
    return member && (member.role === "admin" || member.role === "member");
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
          currency: selectedTemplate.currency || "INR",
          contract_start_date: "",
          contract_end_date: "",
          estimated_duration: 0,
          non_billable_reason: "",
          retainer_period: "month",
          retainer_amount: 0,
          expense_budget: 0,
          client: "",
          client_user_id: "",
        });
        setShowFinancialFields(!!(selectedTemplate.billing_model || selectedTemplate.contract_amount));
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
          currency: "INR",
          contract_start_date: "",
          contract_end_date: "",
          estimated_duration: 0,
          non_billable_reason: "",
          retainer_period: "month",
          retainer_amount: 0,
          expense_budget: 0,
          client: "",
          client_user_id: "",
        });
        setShowFinancialFields(false);
      }
    } else {
      // reset
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
        expense_budget: 0,
        client: "",
        client_user_id: "",
      });
      setShowFinancialFields(false);
      setValidationErrors({});
    }
  }, [open, selectedTemplate, preselectedWorkspaceId]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({ ...prev, logo_url: file_url }));
      toast.success("Logo uploaded successfully!");
    } catch (err) {
      console.error("[CreateProject] Logo upload error:", err);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "Project name is required";
    } else if (formData.name.trim().length < 3) {
      errors.name = "Project name must be at least 3 characters";
    }

    if (!formData.workspace_id) {
      errors.workspace_id = "Workspace is required";
    }

    if (showFinancialFields) {
      if (formData.billing_model === "fixed_price") {
        if (!formData.contract_amount || formData.contract_amount <= 0) {
          errors.contract_amount = "Contract amount is required";
        }
        if (!formData.contract_start_date) errors.contract_start_date = "Start date is required";
        if (!formData.contract_end_date) errors.contract_end_date = "End date is required";
      }

      if (formData.billing_model === "time_and_materials") {
        if (!formData.estimated_duration || formData.estimated_duration <= 0) {
          errors.estimated_duration = "Estimated duration is required";
        }
      }

      if (formData.billing_model === "retainer") {
        if (!formData.retainer_amount || formData.retainer_amount <= 0) {
          errors.retainer_amount = "Retainer amount is required";
        }
        if (!formData.contract_start_date) errors.contract_start_date = "Start date is required";
        if (!formData.contract_end_date) errors.contract_end_date = "End date is required";
      }

      if (formData.billing_model === "non_billable") {
        if (!formData.non_billable_reason?.trim()) {
          errors.non_billable_reason = "Reason is required for non-billable projects";
        }
      }

      if (formData.default_bill_rate_per_hour && isNaN(Number(formData.default_bill_rate_per_hour))) {
        errors.default_bill_rate_per_hour = "Bill rate must be a valid number";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerateDescription = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a project name first");
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

      setFormData((prev) => ({ ...prev, description: response }));
      toast.success("Description generated successfully!");
    } catch (err) {
      console.error("[CreateProject] Failed to generate description:", err);
      toast.error("Failed to generate description. Please try again.");
    } finally {
      setGeneratingDescription(false);
    }
  };

  const toggleTeamMember = (userEmail) => {
    setFormData((prev) => ({
      ...prev,
      team_members: prev.team_members.includes(userEmail)
        ? prev.team_members.filter((email) => email !== userEmail)
        : [...prev.team_members, userEmail],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const workspaceId = formData.workspace_id || undefined;

    let billingFields = {};

    if (showFinancialFields) {
      switch (formData.billing_model) {
        case "time_and_materials":
          billingFields = {
            estimated_duration: Number(formData.estimated_duration) || 0,
            default_bill_rate_per_hour: Number(formData.default_bill_rate_per_hour) || 0,
            contract_amount: 0,
            budget: 0,
            retainer_amount: 0,
            retainer_period: null,
            non_billable_reason: null,
            contract_start_date: null,
            contract_end_date: null,
          };
          break;

        case "fixed_price":
          billingFields = {
            contract_amount: Number(formData.contract_amount) || 0,
            budget: Number(formData.contract_amount) || 0,
            contract_start_date: formData.contract_start_date || undefined,
            contract_end_date: formData.contract_end_date || undefined,
            estimated_duration: 0,
            default_bill_rate_per_hour: 0,
            retainer_amount: 0,
            retainer_period: null,
            non_billable_reason: null,
          };
          break;

        case "retainer":
          billingFields = {
            retainer_amount: Number(formData.retainer_amount) || 0,
            retainer_period: formData.retainer_period || "month",
            contract_start_date: formData.contract_start_date || undefined,
            contract_end_date: formData.contract_end_date || undefined,
            contract_amount: 0,
            budget: 0,
            estimated_duration: 0,
            default_bill_rate_per_hour: 0,
            non_billable_reason: null,
          };
          break;

        case "non_billable":
          billingFields = {
            non_billable_reason: formData.non_billable_reason?.trim() || undefined,
            contract_amount: 0,
            budget: 0,
            estimated_duration: 0,
            default_bill_rate_per_hour: 0,
            retainer_amount: 0,
            retainer_period: null,
            contract_start_date: null,
            contract_end_date: null,
          };
          break;
        default:
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
      team_members:
        formData.team_members.length > 0
          ? formData.team_members.map((email) => ({
            email,
            role: "member",
          }))
          : [],
      template_id: selectedTemplate?.id || undefined,

      ...(showFinancialFields
        ? {
          billing_model: formData.billing_model,
          currency: formData.currency,
          expense_budget: Number(formData.expense_budget) || 0,
          ...billingFields,
        }
        : {}),
    };

    console.log("[CreateProjectDialog] Submitting:", cleanData);
    onSubmit(cleanData);
  };

  const getProjectInitials = (name) =>
    name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "PR";

  const currencySymbol = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AUD: "A$",
    CAD: "C$",
    SGD: "S$",
    AED: "dh",
  }[formData.currency] || formData.currency;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl h-[90vh] max-h-[900px] flex flex-col p-0 gap-0 bg-white">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {selectedTemplate ? `Create Project from "${selectedTemplate.name}"` : "Create New Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message?.includes("permission") ||
                    error.message?.includes("RLS") ||
                    error.message?.includes("policy")
                    ? "You need admin permissions to create projects. Contact your administrator."
                    : `Failed to create project: ${error.message || "Please try again."}`}
                </AlertDescription>
              </Alert>
            )}

            {/* Logo */}
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
                        onClick={() => setFormData((p) => ({ ...p, logo_url: "" }))}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
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

            {/* Name + Color */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, name: e.target.value }));
                    if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder="Enter project name"
                  className={validationErrors.name ? "border-red-500" : ""}
                  disabled={loading}
                />
                {validationErrors.name && <p className="text-xs text-red-600">{validationErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Project Color</Label>
                <div className="flex gap-3 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                    className="w-20 h-10 p-1"
                    disabled={loading}
                  />
                  <span className="text-sm text-slate-600 font-mono">{formData.color}</span>
                </div>
              </div>
            </div>

            {/* Workspace + Client */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace *</Label>
                {accessibleWorkspaces.length > 0 ? (
                  <>
                    <Select
                      value={formData.workspace_id}
                      onValueChange={(value) => {
                        setFormData((p) => ({ ...p, workspace_id: value }));
                        if (validationErrors.workspace_id)
                          setValidationErrors((p) => ({ ...p, workspace_id: undefined }));
                      }}
                      disabled={loading || !!preselectedWorkspaceId}
                    >
                      <SelectTrigger id="workspace" className={validationErrors.workspace_id ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select a workspace..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accessibleWorkspaces.map((ws) => (
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
                    <AlertDescription>No workspaces available. Please create a workspace first.</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className={`space-y-2 ${formData.client ? "grid grid-cols-2 gap-4" : ""}`}>
                <div className="space-y-2">
                  <Label htmlFor="client_org">Client Organization</Label>
                  <Select
                    value={formData.client}
                    onValueChange={(value) =>
                      setFormData((p) => ({ ...p, client: value, client_user_id: "" }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="client_org">
                      <SelectValue
                        placeholder="Select an organization..."
                        // Custom render when selected
                        renderValue={(value) =>
                          value && activeClientsMap[value] ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={activeClientsMap[value].logo_url} />
                                <AvatarFallback className="text-xs">
                                  {activeClientsMap[value].name?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {activeClientsMap[value].name}
                            </div>
                          ) : (
                            "Select an organization..."
                          )
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(activeClientsMap).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={client.logo_url} />
                              <AvatarFallback className="text-xs">{client.name?.[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {client.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.client && (
                  <div className="space-y-2">
                    <Label htmlFor="client_user">Client Contact Person</Label>
                    <Select
                      value={formData.client_user_id || "none"}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, client_user_id: v === "none" ? "" : v }))
                      }
                      disabled={loading}
                    >
                      <SelectTrigger id="client_user">
                        <SelectValue placeholder="Select contact person..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-slate-500 italic">No specific person</span>
                        </SelectItem>
                        {availableClientUsers
                          .filter((u) => u.client_id === formData.client)
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name} <span className="text-xs text-muted-foreground">({user.email})</span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Description + AI */}
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
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="What is this project about? (AI can help generate it)"
                rows={3}
                disabled={loading || generatingDescription}
              />
            </div>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
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
                  onValueChange={(v) => setFormData((p) => ({ ...p, priority: v }))}
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
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFormData((p) => ({ ...p, deadline: e.target.value }))}
                disabled={loading}
              />
            </div>

            {currentUser?.custom_role !== "project_manager" && (
              <div className="border rounded-lg p-5 bg-slate-50/70 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="financial-tracking"
                    checked={showFinancialFields}
                    onCheckedChange={setShowFinancialFields}
                    disabled={loading}
                  />
                  <Label htmlFor="financial-tracking" className="font-medium cursor-pointer text-base">
                    Enable Financial Tracking
                  </Label>
                </div>

                {showFinancialFields && (
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="billing_model">Billing Model</Label>
                      <Select
                        value={formData.billing_model}
                        onValueChange={(v) => setFormData((p) => ({ ...p, billing_model: v }))}
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

                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(v) => setFormData((p) => ({ ...p, currency: v }))}
                        disabled={loading}
                      >
                        <SelectTrigger id="currency">
                          <SelectValue />
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

                    {/* ──────────────────────────────────────── */}
                    {/*           FIXED PRICE SECTION            */}
                    {/* ──────────────────────────────────────── */}
                    {formData.billing_model === "fixed_price" && (
                      <>
                        <div className="space-y-2">
                          <Label>Fixed Price Amount *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              value={formData.contract_amount}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, contract_amount: e.target.value }))
                              }
                              className="pl-10"
                              placeholder="0.00"
                            />
                          </div>
                          {validationErrors.contract_amount && (
                            <p className="text-xs text-red-600">{validationErrors.contract_amount}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 col-span-2">
                          <div className="space-y-2">
                            <Label>Contract Start Date *</Label>
                            <Input
                              type="date"
                              value={formData.contract_start_date}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, contract_start_date: e.target.value }))
                              }
                              className={validationErrors.contract_start_date ? "border-red-500" : ""}
                            />
                            {validationErrors.contract_start_date && (
                              <p className="text-xs text-red-600">{validationErrors.contract_start_date}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Contract End Date *</Label>
                            <Input
                              type="date"
                              value={formData.contract_end_date}
                              min={formData.contract_start_date || new Date().toISOString().split("T")[0]}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, contract_end_date: e.target.value }))
                              }
                              className={validationErrors.contract_end_date ? "border-red-500" : ""}
                            />
                            {validationErrors.contract_end_date && (
                              <p className="text-xs text-red-600">{validationErrors.contract_end_date}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ──────────────────────────────────────── */}
                    {/*        TIME & MATERIALS SECTION          */}
                    {/* ──────────────────────────────────────── */}
                    {formData.billing_model === "time_and_materials" && (
                      <>
                        <div className="space-y-2">
                          <Label>Estimated Duration (hours) *</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.estimated_duration}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, estimated_duration: e.target.value }))
                            }
                            placeholder="e.g. 120"
                            className={validationErrors.estimated_duration ? "border-red-500" : ""}
                          />
                          {validationErrors.estimated_duration && (
                            <p className="text-xs text-red-600">{validationErrors.estimated_duration}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Default Bill Rate (per hour)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formData.default_bill_rate_per_hour}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, default_bill_rate_per_hour: e.target.value }))
                              }
                              className="pl-10"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* ──────────────────────────────────────── */}
                    {/*            RETAINER SECTION              */}
                    {/* ──────────────────────────────────────── */}
                    {formData.billing_model === "retainer" && (
                      <>
                        <div className="space-y-2">
                          <Label>Retainer Amount *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              value={formData.retainer_amount}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, retainer_amount: e.target.value }))
                              }
                              className="pl-10"
                              placeholder="0.00"
                            />
                          </div>
                          {validationErrors.retainer_amount && (
                            <p className="text-xs text-red-600">{validationErrors.retainer_amount}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Retainer Period</Label>
                          <Select
                            value={formData.retainer_period}
                            onValueChange={(v) => setFormData((p) => ({ ...p, retainer_period: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="month">Monthly</SelectItem>
                              <SelectItem value="quarter">Quarterly</SelectItem>
                              <SelectItem value="year">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 col-span-2">
                          <div className="space-y-2">
                            <Label>Start Date *</Label>
                            <Input
                              type="date"
                              value={formData.contract_start_date}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, contract_start_date: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>End Date *</Label>
                            <Input
                              type="date"
                              value={formData.contract_end_date}
                              min={formData.contract_start_date || new Date().toISOString().split("T")[0]}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, contract_end_date: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* ──────────────────────────────────────── */}
                    {/*         NON-BILLABLE SECTION             */}
                    {/* ──────────────────────────────────────── */}
                    {formData.billing_model === "non_billable" && (
                      <div className="col-span-2 space-y-2">
                        <Label>Reason for Non-Billable *</Label>
                        <Input
                          value={formData.non_billable_reason}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, non_billable_reason: e.target.value }))
                          }
                          placeholder="e.g. Internal initiative, Proof of concept, Pro-bono work"
                          className={validationErrors.non_billable_reason ? "border-red-500" : ""}
                        />
                        {validationErrors.non_billable_reason && (
                          <p className="text-xs text-red-600">{validationErrors.non_billable_reason}</p>
                        )}
                      </div>
                    )}

                    {/* Expense Budget – common field */}
                    <div className="col-span-2 space-y-2 pt-2 border-t">
                      <Label>Expense Budget (optional)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                          {currencySymbol}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          value={formData.expense_budget}
                          onChange={(e) => setFormData((p) => ({ ...p, expense_budget: e.target.value }))}
                          className="pl-10"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Maximum amount allowed for project-related expenses
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Team Members */}
            {teamMembers.length > 0 && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-medium">
                  <Users className="h-4 w-4" />
                  Team Members (optional)
                </Label>
                <div className="border rounded-lg p-4 max-h-56 overflow-y-auto bg-white/60">
                  <div className="space-y-1.5">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-md transition-colors"
                      >
                        <Checkbox
                          id={`member-${member.id}`}
                          checked={formData.team_members.includes(member.email)}
                          onCheckedChange={() => toggleTeamMember(member.email)}
                          disabled={loading || member.email === currentUser?.email}
                        />
                        <label
                          htmlFor={`member-${member.id}`}
                          className="flex-1 cursor-pointer text-sm flex flex-col"
                        >
                          <div className="font-medium">{member.full_name}</div>
                          <div className="text-xs text-slate-500">{member.email}</div>
                        </label>
                        {member.email === currentUser?.email && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {formData.team_members.length} member{formData.team_members.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50/70 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || generatingDescription || uploadingLogo || accessibleWorkspaces.length === 0}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}