import React, { useState } from "react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Groups</h2>
          <p className="text-sm text-slate-600">
            Organize users and manage permissions at scale
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md transition-all hover:shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="py-12 text-center text-slate-500">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <p className="mb-4">No user groups yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {groups.map(group => (
            <Card key={group.id} className="bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <div className={`h-3 w-3 rounded-full bg-${group.color}-500`}></div>
                      {group.name}
                      {!group.is_active && (
                        <Badge variant="outline" className="text-xs">Inactive</Badge>
                      )}
                    </CardTitle>
                    {group.description && (
                      <p className="text-sm text-slate-600">{group.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Members:</span>
                  <Badge className="bg-blue-100 text-blue-700">
                    {getMemberCount(group.id)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setManagingMembersGroup(group)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Members
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setEditingGroup(group)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteGroup(group)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
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

