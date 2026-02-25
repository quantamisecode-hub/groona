import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function TeamInviteStep({ tenant, onNext, onSkip, onBack }) {
  const [invites, setInvites] = useState([
    { email: "", role: "user" },
  ]);

  const addInvite = () => {
    if (invites.length < tenant.max_users - 1) {
      setInvites([...invites, { email: "", role: "user" }]);
    } else {
      toast.error(`Maximum ${tenant.max_users - 1} users can be invited on your plan`);
    }
  };

  const removeInvite = (index) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const updateInvite = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    setInvites(updated);
  };

  const handleNext = () => {
    const validInvites = invites.filter(i => i.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email));
    
    if (validInvites.length > 0) {
      toast.success(`${validInvites.length} invitation(s) will be sent!`);
    }
    
    onNext({ invites: validInvites });
  };

  const currentUserCount = 1; // Owner
  const potentialUserCount = currentUserCount + invites.filter(i => i.email.trim()).length;

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-3">
          <Users className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Invite Your Team</h2>
        <p className="text-slate-600">
          Collaboration is better with a team. Invite members to join your workspace.
        </p>
      </div>

      {/* User Limit Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">
            <span className="font-semibold">{potentialUserCount}</span> / {tenant.max_users} users
          </span>
          <span className="text-blue-600 font-medium">
            {tenant.max_users - potentialUserCount} slots remaining
          </span>
        </div>
      </div>

      {/* Invite Forms */}
      <div className="space-y-3">
        {invites.map((invite, index) => (
          <div key={index} className="flex gap-3 items-end p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <div className="flex-1 space-y-2">
              <Label className="text-sm">Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={invite.email}
                onChange={(e) => updateInvite(index, 'email', e.target.value)}
              />
            </div>

            <div className="w-32 space-y-2">
              <Label className="text-sm">Role</Label>
              <Select
                value={invite.role}
                onValueChange={(value) => updateInvite(index, 'role', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {invites.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeInvite(index)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {potentialUserCount < tenant.max_users && (
          <Button
            onClick={addInvite}
            variant="outline"
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Team Member
          </Button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-medium mb-1">Invitation emails will be sent automatically</p>
            <p className="text-slate-600">
              Team members will receive an email with instructions to join your workspace. 
              You can always invite more people later from the Team page.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}