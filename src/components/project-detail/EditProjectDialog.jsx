import React, { useState, useEffect } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Upload, X, Loader2 } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { useUser } from "../shared/UserContext";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function EditProjectDialog({ open, onClose, onSubmit, project, loading }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    deadline: "",
    budget: "",
    currency: "USD",
    logo_url: "",
    client: "",
    client_user_id: "",
    billing_model: "time_and_materials",
    contract_start_date: "",
    contract_end_date: "",
    estimated_duration: 0,
    non_billable_reason: "",
    retainer_period: "month",
    retainer_amount: 0,
    default_bill_rate_per_hour: 0,
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { user: currentUser, effectiveTenantId } = useUser();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return await groonabackend.entities.Client.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!effectiveTenantId,
  });

  const { data: clientUsers = [] } = useQuery({
    queryKey: ['client-users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId && u.custom_role === 'client');
    },
    enabled: !!effectiveTenantId,
  });

  const activeClientsMap = clients.reduce((acc, client) => {
    // Allow current client even if inactive
    if (client.status === 'active' || !client.status || client.id === formData.client) {
      acc[client.id] = client;
    }
    return acc;
  }, {});

  const availableClientUsers = clientUsers.filter(u => u.client_id && activeClientsMap[u.client_id]);

  // Ensure the CURRENTLY selected user is in the list, even if their org is inactive or they are filtered out
  const availableUsersWithCurrent = [...availableClientUsers];
  if (formData.client_user_id) {
    const currentUserInList = availableUsersWithCurrent.find(u => u.id === formData.client_user_id);
    if (!currentUserInList) {
      // We need to find this user from the raw 'clientUsers' list, or even fetch them if missing (though clientUsers should have all tenant users)
      const missingUser = clientUsers.find(u => u.id === formData.client_user_id);
      if (missingUser) {
        availableUsersWithCurrent.push(missingUser);
        // Ensure their client is also in the map for display purposes
        if (missingUser.client_id && !activeClientsMap[missingUser.client_id]) {
          const missingClient = clients.find(c => c.id === missingUser.client_id);
          if (missingClient) {
            activeClientsMap[missingUser.client_id] = missingClient;
          }
        }
      }
    }
  }

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        status: project.status || "planning",
        priority: project.priority || "medium",
        deadline: project.deadline ? project.deadline.split('T')[0] : "",
        budget: project.contract_amount || project.budget || project.budget_amount || "",
        currency: project.currency || project.budget_currency || "USD",
        logo_url: project.logo_url || "",
        client: project.client || "",
        client_user_id: project.client_user_id || "",
        billing_model: project.billing_model || "time_and_materials",
        contract_start_date: project.contract_start_date ? project.contract_start_date.split('T')[0] : "",
        contract_end_date: project.contract_end_date ? project.contract_end_date.split('T')[0] : "",
        estimated_duration: project.estimated_duration || 0,
        non_billable_reason: project.non_billable_reason || "",
        retainer_period: project.retainer_period || "month",
        retainer_amount: project.retainer_amount || 0,
        default_bill_rate_per_hour: project.default_bill_rate_per_hour || 0,
      });
    }
  }, [project]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo_url: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    // Clean and prepare data
    // Exclusivity Logic: Only save fields relevant to the selected billing model
    let billingFields = {};

    switch (formData.billing_model) {
      case 'time_and_materials':
        billingFields = {
          estimated_duration: Number(formData.estimated_duration) || 0,
          default_bill_rate_per_hour: Number(formData.default_bill_rate_per_hour) || 0,
          // Clear others
          contract_amount: 0,
          budget_amount: 0,
          retainer_amount: 0,
          retainer_period: null,
          non_billable_reason: null,
          contract_start_date: null,
          contract_end_date: null
        };
        break;

      case 'fixed_price':
        billingFields = {
          contract_amount: formData.budget ? Number(formData.budget) : 0,
          budget_amount: formData.budget ? Number(formData.budget) : 0,
          contract_start_date: formData.contract_start_date || null,
          contract_end_date: formData.contract_end_date || null,
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
          contract_start_date: formData.contract_start_date || null,
          contract_end_date: formData.contract_end_date || null,
          // Clear others
          contract_amount: 0,
          budget_amount: 0,
          estimated_duration: 0,
          default_bill_rate_per_hour: 0,
          non_billable_reason: null
        };
        break;

      case 'non_billable':
        billingFields = {
          non_billable_reason: formData.non_billable_reason || "",
          // Clear others
          contract_amount: 0,
          budget_amount: 0,
          estimated_duration: 0,
          default_bill_rate_per_hour: 0,
          retainer_amount: 0,
          retainer_period: null,
          contract_start_date: null,
          contract_end_date: null
        };
        break;

      default:
        // Fallback if somehow empty
        billingFields = {};
    }

    const cleanData = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      currency: formData.currency,
      client: formData.client || undefined,
      client_user_id: formData.client_user_id || undefined,
      billing_model: formData.billing_model,
      ...billingFields
    };

    onSubmit(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Column 1: Project Logo */}
            <div className="space-y-2">
              <Label htmlFor="logo">Project Logo</Label>
              {formData.logo_url ? (
                <div className="relative inline-block">
                  <img
                    src={formData.logo_url}
                    alt="Project logo"
                    className="h-24 w-24 object-cover rounded-lg border-2 border-slate-200"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('logo').click()}
                    disabled={uploadingLogo}
                    className="flex items-center gap-2"
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                </div>
              )}
              {!formData.logo_url && <span className="text-xs text-slate-500 block pt-1">Max 5MB (PNG, JPG, SVG)</span>}
            </div>

            {/* Column 2: Client Organization */}
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

            {/* Column 3: Client User */}
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
                disabled={!formData.client}
              >
                <SelectTrigger id="client_user">
                  <SelectValue placeholder="Select a user...">
                    {formData.client_user_id ? (
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col text-left">
                          <span className="font-medium text-sm leading-tight">
                            {availableUsersWithCurrent.find(u => u.id === formData.client_user_id)?.full_name || "Unknown User"}
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
                  {availableUsersWithCurrent
                    .filter(u => u.client_id === formData.client)
                    .map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span>{user.full_name}</span>
                          <span className="text-xs text-slate-400">({user.email})</span>
                        </div>
                      </SelectItem>
                    ))
                  }
                  {availableUsersWithCurrent.filter(u => u.client_id === formData.client).length === 0 && (
                    <div className="p-2 text-sm text-slate-500 text-center">No users found for this client</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
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
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>



          {currentUser?.custom_role !== 'project_manager' && (
            <div className="col-span-2 space-y-4 border rounded p-4 bg-slate-50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Model</Label>
                  <Select value={formData.billing_model} onValueChange={v => setFormData({ ...formData, billing_model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                      <SelectItem value="fixed_price">Fixed Price</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                      <SelectItem value="non_billable">Non-Billable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.billing_model !== 'non_billable' && formData.billing_model !== 'retainer' && !project && (
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                        {/* Add others as needed */}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Fixed Price Fields */}
              {formData.billing_model === 'fixed_price' && (
                <>
                  <div className="space-y-2">
                    <Label>Fixed Price Amount</Label>
                    <Input type="number" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} placeholder="Amount" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contract Start Date</Label>
                      <Input type="date" value={formData.contract_start_date} onChange={e => setFormData({ ...formData, contract_start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contract End Date</Label>
                      <Input type="date" value={formData.contract_end_date} onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {/* Time & Materials Fields */}
              {formData.billing_model === 'time_and_materials' && (
                <>
                  <div className="space-y-2">
                    <Label>Estimated Duration (Hours)</Label>
                    <Input type="number" min="0" value={formData.estimated_duration} onChange={e => setFormData({ ...formData, estimated_duration: e.target.value })} />
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
                    />
                  </div>
                </>
              )}

              {/* Retainer Fields */}
              {formData.billing_model === 'retainer' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Retainer Amount</Label>
                      <Input type="number" min="0" value={formData.retainer_amount} onChange={e => setFormData({ ...formData, retainer_amount: e.target.value })} placeholder="3000" />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contract Start Date</Label>
                      <Input type="date" value={formData.contract_start_date} onChange={e => setFormData({ ...formData, contract_start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contract End Date</Label>
                      <Input type="date" value={formData.contract_end_date} onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {/* Non-Billable Fields */}
              {formData.billing_model === 'non_billable' && (
                <div className="space-y-2">
                  <Label>Reason for Non-Billable</Label>
                  <Input value={formData.non_billable_reason} onChange={e => setFormData({ ...formData, non_billable_reason: e.target.value })} placeholder="e.g. Internal Training" />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form >
      </DialogContent >
    </Dialog >
  );
}

