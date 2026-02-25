import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProjectTeamManagement({ open, onClose, project, currentUser }) {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  // Fetch users for the dropdown (exclude clients)
  const { data: users = [] } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => 
        u.tenant_id === effectiveTenantId && 
        u.custom_role !== 'client'
      );
    },
    enabled: !!open && !!effectiveTenantId,
  });

  // Fetch UserGroups (Roles)
  const { data: roles = [] } = useQuery({
    queryKey: ['user-groups', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.UserGroup.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!open && !!effectiveTenantId,
  });

  // Only member and project_manager roles allowed
  const isTenantAdmin = currentUser?.role === 'admin' || currentUser?.is_super_admin || currentUser?.custom_role === 'owner';
  const projectManagerRole = isTenantAdmin ? [{ id: 'project_manager', name: 'Project Manager', isPM: true }] : [];

  const allRoleOptions = [
    { id: 'member', name: 'Member' },
    ...projectManagerRole
  ];

  const updateProjectMutation = useMutation({
    mutationFn: async (data) => {
      await groonabackend.entities.Project.update(project.id, data);
      
      // If adding a project_manager role, create ProjectUserRole entry
      if (data.team_members) {
        const newMembers = data.team_members.filter(m => 
          !project.team_members?.find(pm => pm.email === m.email)
        );
        
        for (const member of newMembers) {
          if (member.role === 'project_manager') {
            await groonabackend.entities.ProjectUserRole.create({
              tenant_id: effectiveTenantId,
              project_id: project.id,
              user_id: users.find(u => u.email === member.email)?.id,
              user_email: member.email,
              user_name: users.find(u => u.email === member.email)?.full_name,
              role: 'project_manager',
              assigned_by: currentUser.email,
              assigned_at: new Date().toISOString(),
              permissions: {
                can_manage_tasks: true,
                can_manage_sprints: true,
                can_manage_milestones: true,
                can_assign_users: true,
                can_view_reports: true,
                can_export_reports: true,
                can_edit_project: false,
                can_delete_project: false
              }
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project-manager-roles'] });
      toast.success('Team updated successfully');
    },
    onError: () => toast.error('Failed to update team')
  });

  const handleAddMember = () => {
    if (!selectedUser) return;

    const currentMembers = project.team_members || [];
    if (currentMembers.find(m => m.email === selectedUser)) {
      toast.error('User is already a member');
      return;
    }

    const newMember = {
      email: selectedUser,
      role: selectedRole
    };

    updateProjectMutation.mutate({
      team_members: [...currentMembers, newMember]
    });
    setSelectedUser("");
  };

  const handleRemoveMember = async (email) => {
    if (confirm('Are you sure you want to remove this member?')) {
      const currentMembers = project.team_members || [];
      const member = currentMembers.find(m => m.email === email);
      
      // If removing a project_manager, also delete ProjectUserRole
      if (member?.role === 'project_manager') {
        const projectRoles = await groonabackend.entities.ProjectUserRole.filter({
          project_id: project.id,
          user_email: email,
          role: 'project_manager'
        });
        
        for (const role of projectRoles) {
          await groonabackend.entities.ProjectUserRole.delete(role.id);
        }
      }
      
      updateProjectMutation.mutate({
        team_members: currentMembers.filter(m => m.email !== email)
      });
    }
  };

  const handleUpdateRole = (email, newRole) => {
    const currentMembers = project.team_members || [];
    const updatedMembers = currentMembers.map(m => 
      m.email === email ? { ...m, role: newRole } : m
    );
    updateProjectMutation.mutate({
      team_members: updatedMembers
    });
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // Filter users not already in team
  const availableUsers = users.filter(u => 
    !project.team_members?.find(m => m.email === u.email)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Project Team</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Add Member */}
          <div className="flex gap-3 items-end p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.email}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                        </Avatar>
                        {user.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40 space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allRoleOptions.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} {role.isPM && '(Project Manager)'} {role.isCustom && '(Custom)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleAddMember} 
              disabled={!selectedUser || updateProjectMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Team Members ({project.team_members?.length || 0})</h3>
            <div className="border rounded-lg divide-y">
              {project.team_members?.map((member, idx) => {
                const user = users.find(u => u.email === member.email);
                const isOwner = member.role === 'owner';
                
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user?.profile_image_url} />
                        <AvatarFallback>{getInitials(user?.full_name || member.email)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900">{user?.full_name || member.email}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select 
                        value={member.role} 
                        onValueChange={(val) => handleUpdateRole(member.email, val)}
                        disabled={isOwner || updateProjectMutation.isPending}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allRoleOptions.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name} {role.isPM && <Badge className="ml-1 text-xs">PM</Badge>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50 h-8 w-8"
                        onClick={() => handleRemoveMember(member.email)}
                        disabled={isOwner || updateProjectMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {(!project.team_members || project.team_members.length === 0) && (
                <div className="p-4 text-center text-slate-500">
                  No team members assigned yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

