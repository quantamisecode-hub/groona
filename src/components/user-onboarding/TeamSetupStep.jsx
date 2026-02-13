import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { groonabackend } from "@/api/groonabackend";

export default function TeamSetupStep({ data, tenant, user, onNext }) {
  const [invites, setInvites] = useState(data.team_setup?.invites || []);
  const [newInvite, setNewInvite] = useState({ email: '', role: 'team_member' });
  const [sendingInvite, setSendingInvite] = useState(false);

  const addInvite = async () => {
    if (!newInvite.email) {
      toast.error('Please enter an email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newInvite.email)) {
      toast.error('Please enter a valid email');
      return;
    }

    if (invites.some(inv => inv.email === newInvite.email)) {
      toast.error('This email is already invited');
      return;
    }

    setSendingInvite(true);
    try {
      // Determine system role based on custom role
      const systemRole = newInvite.role === 'project_manager' ? 'admin' : 'member';
      const customRole = newInvite.role === 'project_manager' ? 'project_manager' : 'team_member';
      
      // Create invitation link
      const invitationLink = `${window.location.origin}/accept-invitation?email=${encodeURIComponent(newInvite.email)}&tenant_id=${tenant.id}&role=${systemRole}&custom_role=${customRole}`;
      
      // Send invitation email
      await groonabackend.integrations.Core.SendEmail({
        to: newInvite.email,
        subject: `You've been invited to join ${tenant.name || 'GROONA'}`,
        body: `
          <h2>Welcome to GROONA!</h2>
          <p>Hi there,</p>
          <p>You've been invited by ${user?.full_name || user?.email} to join ${tenant.name || 'their organization'} on GROONA.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Your Account Details:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Organization:</strong> ${tenant.name || 'N/A'}</li>
              <li><strong>Email:</strong> ${newInvite.email}</li>
              <li><strong>Role:</strong> ${newInvite.role === 'project_manager' ? 'Project Manager' : 'Team Member'}</li>
            </ul>
          </div>

          <p>To accept this invitation and set up your account, please click the button below:</p>
          <p><a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a></p>
          
          <p>Or copy this link into your browser:</p>
          <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${invitationLink}</p>
          
          <p>Best regards,<br/>The GROONA Team</p>
        `
      });

      // Add to invites list
      setInvites([...invites, { ...newInvite, status: 'pending', invited_at: new Date().toISOString() }]);
      setNewInvite({ email: '', role: 'team_member' });
      toast.success(`Invitation sent to ${newInvite.email}`);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  const removeInvite = (email) => {
    setInvites(invites.filter(inv => inv.email !== email));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext({ invites });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="text-center mb-8">
        <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Invite your team
        </h2>
        <p className="text-slate-600">
          Add team members now, or skip and do it later
        </p>
      </div>

      {/* Add Invite Form */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newInvite.email}
                onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                placeholder="colleague@company.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addInvite();
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={newInvite.role}
                onValueChange={(value) => setNewInvite({ ...newInvite, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_manager">Project Manager</SelectItem>
                  <SelectItem value="team_member">Team Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addInvite}
            className="w-full"
            disabled={sendingInvite}
          >
            {sendingInvite ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Team Member
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Invited Members List */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <Label>Team Members ({invites.length})</Label>
          <div className="space-y-2">
            {invites.map((invite, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{invite.email}</p>
                    <Badge variant="outline" className="mt-1">
                      {invite.role === 'project_manager' ? 'Project Manager' : 'Team Member'}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInvite(invite.email)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          size="lg"
        >
          {invites.length > 0 ? `Continue with ${invites.length} invite${invites.length > 1 ? 's' : ''}` : 'Skip for now'}
        </Button>
        {invites.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            You can always invite team members later from settings
          </p>
        )}
      </div>
    </form>
  );
}

