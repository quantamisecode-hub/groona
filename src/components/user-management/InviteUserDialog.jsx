import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, User as UserIcon, AlertCircle, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function InviteUserDialog({ open, onClose, currentUser, effectiveTenantId }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("user");
  const [customRole, setCustomRole] = useState("viewer");
  const [selectedTenantId, setSelectedTenantId] = useState(effectiveTenantId || "");

  // Working Hours & Days
  const [workingFrom, setWorkingFrom] = useState("09:00");
  const [workingTo, setWorkingTo] = useState("17:00");
  const [workingDays, setWorkingDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  const queryClient = useQueryClient();

  console.log('[Aivora InviteUserDialog] Current tenant context:', effectiveTenantId);

  // Fetch all tenants (for Super Admin) or just the current tenant
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants-for-invite', effectiveTenantId],
    queryFn: async () => {
      if (currentUser?.is_super_admin) {
        // Super Admin can see all tenants
        console.log('[Aivora InviteUserDialog] Fetching all tenants for Super Admin');
        const allTenants = await groonabackend.entities.Tenant.list();
        return Array.isArray(allTenants) ? allTenants : [];
      } else if (effectiveTenantId) {
        // Regular admin can only see their tenant
        console.log('[Aivora InviteUserDialog] Fetching single tenant for Admin:', effectiveTenantId);

        // Try filtering by _id first (standard database ID)
        let tenantList = await groonabackend.entities.Tenant.filter({ _id: effectiveTenantId });

        // Fallback: If empty, try filtering by id
        if (!tenantList || tenantList.length === 0) {
          tenantList = await groonabackend.entities.Tenant.filter({ id: effectiveTenantId });
        }

        return Array.isArray(tenantList) ? tenantList : [];
      }
      return [];
    },
    enabled: open && !!currentUser,
  });

  // Auto-select tenant if only one available
  React.useEffect(() => {
    if (tenants.length === 1 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id);
    } else if (effectiveTenantId && !selectedTenantId) {
      setSelectedTenantId(effectiveTenantId);
    }
  }, [tenants, effectiveTenantId, selectedTenantId]);

  const inviteUserMutation = useMutation({
    mutationFn: async () => {
      // Validate tenant selection
      if (!selectedTenantId) {
        throw new Error('Please select a tenant for this user');
      }

      // Project managers have role='admin' and custom_role='project_manager'
      // Auto-set role to admin when custom_role is project_manager
      let finalRole = role;
      let finalCustomRole = customRole;

      if (customRole === 'project_manager') {
        finalRole = 'admin'; // Project managers have admin role
      }

      // Construct link with BOTH role (system) and custom_role (app) plus working hours
      const invitationLink = `${window.location.origin}/accept-invitation?email=${encodeURIComponent(email)}&tenant_id=${selectedTenantId}&role=${finalRole}&custom_role=${finalCustomRole}&full_name=${encodeURIComponent(fullName)}&working_from=${encodeURIComponent(workingFrom)}&working_to=${encodeURIComponent(workingTo)}&working_days=${encodeURIComponent(workingDays.join(','))}`;

      try {
        const tenantName = tenants.find(t => t.id === selectedTenantId)?.name || 'the organization';

        // Format role and custom_role for display
        const displayRole = finalRole === 'admin' ? 'Administrator' : 'User';
        const displayCustomRole = finalCustomRole.charAt(0).toUpperCase() + finalCustomRole.slice(1).replace('_', ' ');

        // Send invitation email using groonabackend's email integration
        await groonabackend.integrations.Core.SendEmail({
          to: email,
          subject: `You've been invited to join GROONA`,
          body: `
            <h2>Welcome to GROONA!</h2>
            <p>Hi ${fullName || 'there'},</p>
            <p>You've been invited by ${currentUser.full_name} (${currentUser.email}) to join their organization on GROONA.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Your Account Details:</strong></p>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Organization:</strong> ${tenantName}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>System Role:</strong> ${displayRole}</li>
                <li><strong>App Role:</strong> ${displayCustomRole}</li>
              </ul>
            </div>

            <p>To accept this invitation and set up your password, please click the button below:</p>
            <p><a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a></p>
            
            <p>Or copy this link into your browser:</p>
            <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${invitationLink}</p>
            
            <p>Best regards,<br/>The GROONA AI Team</p>
          `
        });

        console.log('[GROONA InviteUserDialog] Invitation email sent to:', email);

        // Log audit entry for the invitation
        try {
          await groonabackend.entities.AuditLog.create({
            tenant_id: selectedTenantId,
            action: 'invite',
            entity_type: 'user',
            entity_name: fullName || email,
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            user_role: currentUser.role,
            description: `Invited ${email} as ${finalRole} (${finalCustomRole}) to tenant ${tenantName}`,
            severity: 'medium',
            metadata: {
              invited_email: email,
              invited_name: fullName,
              invited_role: finalRole,
              invited_custom_role: finalCustomRole,
              invited_tenant_id: selectedTenantId,
              invitation_sent_at: new Date().toISOString(),
            }
          });
        } catch (error) {
          console.error('[Aivora InviteUserDialog] Failed to log audit entry:', error);
        }

        return { email, fullName, role: finalRole, customRole: finalCustomRole, tenant_id: selectedTenantId };
      } catch (error) {
        console.error('[Aivora InviteUserDialog] Failed to send invitation email:', error);
        throw new Error('Failed to send invitation email');
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Invitation sent to ${data.email}!`);
      console.log('[Aivora InviteUserDialog] User invited:', data.email);

      // Reset form
      setEmail("");
      setFullName("");
      setRole("user");
      setCustomRole("viewer");
      // Don't reset tenant if we have an effective one
      if (!effectiveTenantId) setSelectedTenantId("");

      onClose();
    },
    onError: (error) => {
      console.error('[Aivora InviteUserDialog] Failed to invite user:', error);
      toast.error(error.message || 'Failed to invite user. Please try again.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!selectedTenantId) {
      toast.error('Please select a tenant for this user');
      return;
    }

    inviteUserMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new user to the platform
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 text-sm">
            An invitation email will be sent to the user with instructions to set up their account.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="h-4 w-4 inline mr-2" />
              Email Address *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={inviteUserMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">
              <UserIcon className="h-4 w-4 inline mr-2" />
              Full Name *
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={inviteUserMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant">
              <Building2 className="h-4 w-4 inline mr-2" />
              Organization/Tenant *
            </Label>
            {tenantsLoading ? (
              <div className="flex items-center justify-center p-3 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-2" />
                <span className="text-sm text-slate-600">Loading tenants...</span>
              </div>
            ) : (
              <Select
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
                disabled={inviteUserMutation.isPending || (tenants.length === 1 && !currentUser?.is_super_admin)}
              >
                <SelectTrigger id="tenant">
                  <SelectValue placeholder="Select tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      <div className="flex items-center gap-2">
                        {tenant.branding?.logo_url && (
                          <img
                            src={tenant.branding.logo_url}
                            alt={tenant.name}
                            className="h-4 w-4 object-contain rounded"
                          />
                        )}
                        <span>{tenant.name}</span>
                        <span className="text-xs text-slate-500">
                          ({tenant.subscription_plan})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Show message if no tenants found */}
            {!tenantsLoading && tenants.length === 0 && (
              <p className="text-xs text-red-500">
                No tenant found. Please contact support.
              </p>
            )}

            {tenants.length === 1 && (
              <p className="text-xs text-slate-500">
                User will be added to: <strong>{tenants[0].name}</strong>
              </p>
            )}
            {currentUser?.is_super_admin && tenants.length > 1 && (
              <p className="text-xs text-slate-500">
                Select which tenant this user should belong to
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">System Role</Label>
              <Select value={role} onValueChange={(val) => {
                setRole(val);
                // If deselecting admin role while custom_role is project_manager, reset custom_role
                if (customRole === 'project_manager' && val !== 'admin') {
                  setCustomRole('viewer');
                }
              }} disabled={inviteUserMutation.isPending || customRole === 'project_manager'}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  {(currentUser?.role === 'admin' || currentUser?.custom_role === 'owner') && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customRole">App Role</Label>
              <Select value={customRole} onValueChange={(val) => {
                setCustomRole(val);
                // If selecting project_manager, auto-set role to admin
                if (val === 'project_manager') {
                  setRole('admin');
                }
              }} disabled={inviteUserMutation.isPending}>
                <SelectTrigger id="customRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(currentUser?.role === 'admin' || currentUser?.custom_role === 'owner') && (
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                  )}
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Working From</Label>
              <Input
                type="time"
                value={workingFrom}
                onChange={(e) => setWorkingFrom(e.target.value)}
                disabled={inviteUserMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Working To</Label>
              <Input
                type="time"
                value={workingTo}
                onChange={(e) => setWorkingTo(e.target.value)}
                disabled={inviteUserMutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div
                  key={day}
                  onClick={() => {
                    if (inviteUserMutation.isPending) return;
                    setWorkingDays(prev =>
                      prev.includes(day)
                        ? prev.filter(d => d !== day)
                        : [...prev, day]
                    );
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer border transition-colors ${workingDays.includes(day)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                    } ${inviteUserMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            <strong>System Role:</strong> Admins can manage users/settings. <br />
            <strong>App Role:</strong> Project Manager will automatically get Admin system role. Owners can invite project managers.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={inviteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={inviteUserMutation.isPending || !selectedTenantId}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              {inviteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-600">
            <strong>Note:</strong> Users must be invited via email and accept the invitation to join. The user will be assigned to the selected tenant.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

