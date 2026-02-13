import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus, Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function InviteClientDialog({ open, onClose, onSuccess, tenantId, organizations = [] }) {
  const activeOrganizations = organizations.filter(org => !org.status || org.status === 'active');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('invite');
  const [credentials, setCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    email: '',
    name: '',
    project_ids: [],
    can_comment: true
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', tenantId],
    queryFn: () => groonabackend.entities.Project.filter({ tenant_id: tenantId }),
    enabled: open && !!tenantId,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Please select a client organization");
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post(`${API_BASE}/api/clients/invite`, {
        ...formData,
        tenant_id: tenantId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.credentials) {
        setCredentials(res.data.credentials);
        setStep('success');
      } else {
        toast.success("Client user updated and notified!");
        handleClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to invite client user");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('invite');
    setFormData({ client_id: '', email: '', name: '', project_ids: [], can_comment: true });
    setCredentials(null);
    onClose();
    if (step === 'success') onSuccess?.();
  };

  if (step === 'success' && credentials) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600 flex items-center gap-2">
              <Check className="h-5 w-5" /> Client User Created
            </DialogTitle>
            <DialogDescription>Credentials sent via email. You can also copy them below.</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-4 rounded-lg space-y-4 border">
            <div>
              <Label className="text-xs uppercase text-slate-500">Password</Label>
              <div className="flex gap-2">
                <code className="bg-white border p-2 rounded w-full font-mono font-bold text-blue-600">
                  {showPassword ? credentials.password : '••••••••'}
                </code>
                <Button size="icon" variant="ghost" type="button" onClick={() => setShowPassword(s => !s)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" type="button" onClick={() => { navigator.clipboard.writeText(credentials.password); toast.success('Copied') }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleClose}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite Client Users</DialogTitle>
          <DialogDescription>Create a client user account and trigger an email invitation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Client Organization</Label>
            <Select
              value={formData.client_id}
              onValueChange={(val) => setFormData({ ...formData, client_id: val })}
              required
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select client...">
                  {formData.client_id ? (
                    (() => {
                      const selectedOrg = organizations.find(o => o.id === formData.client_id);
                      if (!selectedOrg) return "Select client...";
                      return (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-slate-200">
                            <AvatarImage src={selectedOrg.logo_url} className="object-cover" />
                            <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">
                              {selectedOrg.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{selectedOrg.name}</span>
                        </div>
                      );
                    })()
                  ) : "Select client..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {activeOrganizations.map(org => (
                  <SelectItem key={org.id} value={org.id} className="py-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-slate-200">
                        <AvatarImage src={org.logo_url} className="object-cover" />
                        <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">
                          {org.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{org.name}</span>
                    </div>
                  </SelectItem>
                ))}
                {activeOrganizations.length === 0 && <div className="p-3 text-sm text-center text-slate-500">No active clients found</div>}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required type="email" placeholder="user@client.com" />
            </div>
            <div className="space-y-2">
              <Label>User Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="John Doe" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Projects</Label>
            <div className="border rounded-md p-3 h-40 overflow-y-auto bg-slate-50/50">
              {projects.filter(p => formData.client_id && String(p.client) === String(formData.client_id)).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  {!formData.client_id ? "Select a client organization first" : "No projects associated with this client"}
                </p>
              ) : (
                projects
                  .filter(p => formData.client_id && String(p.client) === String(formData.client_id))
                  .map(p => (
                    <div key={p.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={p.id}
                        checked={formData.project_ids.includes(p.id)}
                        onCheckedChange={(c) => {
                          setFormData(prev => ({
                            ...prev,
                            project_ids: c ? [...prev.project_ids, p.id] : prev.project_ids.filter(id => id !== p.id)
                          }))
                        }}
                      />
                      <label htmlFor={p.id} className="text-sm cursor-pointer select-none">{p.name}</label>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Send Email"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

