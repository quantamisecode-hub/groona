import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ManageGroupMembersDialog({ open, onClose, group, currentUser, effectiveTenantId }) {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  console.log('[Aivora ManageGroupMembersDialog] Managing members for group:', group.name);

  // Fetch all users in the tenant
  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        return groonabackend.entities.User.list();
      }
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
  });

  // Fetch group memberships
  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['group-memberships', group.id],
    queryFn: () => groonabackend.entities.UserGroupMembership.filter({ group_id: group.id }),
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (user) => {
      const membershipData = {
        tenant_id: effectiveTenantId,
        user_email: user.email,
        user_name: user.full_name,
        group_id: group.id,
        group_name: group.name,
        assigned_by: currentUser.email,
        assigned_date: new Date().toISOString(),
      };

      console.log('[Aivora ManageGroupMembersDialog] Adding member:', membershipData);
      const newMembership = await groonabackend.entities.UserGroupMembership.create(membershipData);

      // Log audit entry
      try {
        await groonabackend.entities.AuditLog.create({
          tenant_id: effectiveTenantId,
          action: 'update',
          entity_type: 'group',
          entity_id: group.id,
          entity_name: group.name,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          description: `Added ${user.full_name} to group ${group.name}`,
          severity: 'low',
        });
      } catch (error) {
        console.error('[Aivora ManageGroupMembersDialog] Failed to log audit entry:', error);
      }

      return newMembership;
    },
    onSuccess: (_, user) => {
      queryClient.invalidateQueries({ queryKey: ['group-memberships'] });
      toast.success(`${user.full_name} added to group`);
      console.log('[Aivora ManageGroupMembersDialog] Member added:', user.email);
    },
    onError: (error) => {
      console.error('[Aivora ManageGroupMembersDialog] Failed to add member:', error);
      toast.error('Failed to add member');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (membership) => {
      console.log('[Aivora ManageGroupMembersDialog] Removing member:', membership.user_email);
      await groonabackend.entities.UserGroupMembership.delete(membership.id);

      // Log audit entry
      try {
        await groonabackend.entities.AuditLog.create({
          tenant_id: effectiveTenantId,
          action: 'update',
          entity_type: 'group',
          entity_id: group.id,
          entity_name: group.name,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          description: `Removed ${membership.user_name} from group ${group.name}`,
          severity: 'low',
        });
      } catch (error) {
        console.error('[Aivora ManageGroupMembersDialog] Failed to log audit entry:', error);
      }
    },
    onSuccess: (_, membership) => {
      queryClient.invalidateQueries({ queryKey: ['group-memberships'] });
      toast.success(`${membership.user_name} removed from group`);
      console.log('[Aivora ManageGroupMembersDialog] Member removed:', membership.user_email);
    },
    onError: (error) => {
      console.error('[Aivora ManageGroupMembersDialog] Failed to remove member:', error);
      toast.error('Failed to remove member');
    },
  });

  const memberEmails = memberships.map(m => m.user_email);
  const members = users.filter(u => memberEmails.includes(u.email));
  const nonMembers = users.filter(u => !memberEmails.includes(u.email));

  const filteredNonMembers = nonMembers.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Group Members</DialogTitle>
          <DialogDescription>
            Add or remove members from <strong>{group.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Members */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-slate-900">
                Current Members ({members.length})
              </h3>
              
              {members.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No members yet. Add users below.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map(user => {
                    const membership = memberships.find(m => m.user_email === user.email);
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-slate-200">
                            <AvatarImage src={user.profile_image_url} alt={user.full_name} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-600">{user.email}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => removeMemberMutation.mutate(membership)}
                          disabled={removeMemberMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Members */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-slate-900">
                Add Members
              </h3>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {filteredNonMembers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  {searchQuery ? 'No users found' : 'All users are already members'}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredNonMembers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-slate-200">
                          <AvatarImage src={user.profile_image_url} alt={user.full_name} />
                          <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white font-bold text-sm">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm text-slate-900">{user.full_name}</p>
                          <p className="text-xs text-slate-600">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:bg-blue-50"
                        onClick={() => addMemberMutation.mutate(user)}
                        disabled={addMemberMutation.isPending}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

