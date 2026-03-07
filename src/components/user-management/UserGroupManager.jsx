import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Edit, Trash2, Loader2 } from "lucide-react";
import CreateGroupDialog from "./CreateGroupDialog";
import EditGroupDialog from "./EditGroupDialog";
import ManageGroupMembersDialog from "./ManageGroupMembersDialog";
import { toast } from "sonner";

export default function UserGroupManager({ currentUser, effectiveTenantId }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [managingMembersGroup, setManagingMembersGroup] = useState(null);
  const queryClient = useQueryClient();

  console.log('[Aivora UserGroupManager] Managing groups for tenant:', effectiveTenantId);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['user-groups', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        return groonabackend.entities.UserGroup.list();
      }
      return groonabackend.entities.UserGroup.filter({ tenant_id: effectiveTenantId });
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['group-memberships', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        return groonabackend.entities.UserGroupMembership.list();
      }
      return groonabackend.entities.UserGroupMembership.filter({ tenant_id: effectiveTenantId });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId) => {
      // Delete all memberships first
      const groupMemberships = memberships.filter(m => m.group_id === groupId);
      await Promise.all(groupMemberships.map(m => groonabackend.entities.UserGroupMembership.delete(m.id)));

      // Delete the group
      await groonabackend.entities.UserGroup.delete(groupId);

      // Log audit entry
      try {
        await groonabackend.entities.AuditLog.create({
          tenant_id: effectiveTenantId,
          action: 'delete',
          entity_type: 'group',
          entity_id: groupId,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          description: 'Deleted user group',
          severity: 'medium',
        });
      } catch (error) {
        console.error('[Aivora UserGroupManager] Failed to log audit entry:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-memberships'] });
      toast.success('Group deleted successfully');
      console.log('[Aivora UserGroupManager] Group deleted');
    },
    onError: (error) => {
      console.error('[Aivora UserGroupManager] Failed to delete group:', error);
      toast.error('Failed to delete group');
    },
  });

  const handleDeleteGroup = (group) => {
    if (confirm(`Delete group "${group.name}"? This will remove all user assignments from this group.`)) {
      deleteGroupMutation.mutate(group.id);
    }
  };

  const getMemberCount = (groupId) => {
    return memberships.filter(m => m.group_id === groupId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">User Groups</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Organize users and manage organizational permissions at scale.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-11 rounded-lg px-6 font-bold transition-all active:scale-[0.98] w-full sm:w-auto flex items-center gap-2"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Create Group</span>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-6 group-hover:scale-110 transition-transform duration-500">
            <Users className="h-10 w-10" />
          </div>
          <div className="text-center max-w-xs mx-auto space-y-2 mb-8">
            <h3 className="text-[17px] font-bold text-slate-900 tracking-tight">Build your first group</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Groups help you manage permissions for multiple users at once. Start by creating a team group.</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            className="rounded-xl border-slate-200 text-slate-600 font-bold h-11 px-6 hover:bg-slate-50 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <div key={group.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-100 transition-all duration-500 p-6 flex flex-col gap-6 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-500 group-hover:scale-110",
                    group.color ? `bg-${group.color}-50 text-${group.color}-600` : "bg-blue-50 text-blue-600"
                  )}>
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-bold text-slate-900 truncate tracking-tight flex items-center gap-2">
                      {group.name}
                      {!group.is_active && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none rounded-md px-1.5 py-0 text-[9px] font-black uppercase tracking-widest">Inactive</Badge>
                      )}
                    </h4>
                    <p className="text-xs font-medium text-slate-400 mt-0.5 uppercase tracking-widest">
                      {getMemberCount(group.id)} {getMemberCount(group.id) === 1 ? 'Member' : 'Members'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900" onClick={() => setEditingGroup(group)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600" onClick={() => handleDeleteGroup(group)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed font-medium">
                  {group.description}
                </p>
              )}

              <div className="mt-auto pt-2">
                <Button
                  onClick={() => setManagingMembersGroup(group)}
                  className="w-full h-10 rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-600 font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] border-0"
                >
                  Manage Group Members
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {showCreateDialog && (
        <CreateGroupDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          currentUser={currentUser}
          effectiveTenantId={effectiveTenantId}
        />
      )}

      {editingGroup && (
        <EditGroupDialog
          open={!!editingGroup}
          onClose={() => setEditingGroup(null)}
          group={editingGroup}
          currentUser={currentUser}
          effectiveTenantId={effectiveTenantId}
        />
      )}

      {managingMembersGroup && (
        <ManageGroupMembersDialog
          open={!!managingMembersGroup}
          onClose={() => setManagingMembersGroup(null)}
          group={managingMembersGroup}
          currentUser={currentUser}
          effectiveTenantId={effectiveTenantId}
        />
      )}
    </div>
  );
}

