import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ManageWorkspaceMembersDialog({ open, onClose, workspace, onUpdate }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [isAdding, setIsAdding] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-workspace'],
    queryFn: () => groonabackend.entities.User.list(),
    enabled: open,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedUser("");
      setSelectedRole("member");
    }
  }, [open]);

  const currentMembers = workspace?.members || [];
  const currentMemberEmails = currentMembers.map(m => m.user_email);

  // Filter available users (not already members)
  const availableUsers = users.filter(u =>
    !currentMemberEmails.includes(u.email) &&
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMember = async () => {
    if (!selectedUser) return;

    setIsAdding(true);
    try {
      const userToAdd = users.find(u => u.email === selectedUser);
      const newMembers = [
        ...currentMembers,
        {
          user_email: userToAdd.email,
          user_name: userToAdd.full_name,
          role: selectedRole,
        }
      ];

      await onUpdate(workspace.id, { members: newMembers });

      setSelectedUser("");
      setSelectedRole("member");
      setSearchQuery("");
      toast.success(`${userToAdd.full_name} added to workspace`);
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (memberEmail) => {
    try {
      const newMembers = currentMembers.filter(m => m.user_email !== memberEmail);
      await onUpdate(workspace.id, { members: newMembers });
      toast.success('Member removed from workspace');
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleChangeRole = async (memberEmail, newRole) => {
    try {
      const newMembers = currentMembers.map(m =>
        m.user_email === memberEmail ? { ...m, role: newRole } : m
      );
      await onUpdate(workspace.id, { members: newMembers });
      toast.success('Member role updated');
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getRoleBadge = (role) => {
    const variants = {
      admin: "bg-amber-100 text-amber-700 border-amber-200",
      member: "bg-blue-100 text-blue-700 border-blue-200",
      viewer: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return <Badge className={`${variants[role]} border text-xs capitalize`}>{role}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
            </div>
            Manage Workspace Members
          </DialogTitle>
          <DialogDescription className="text-zinc-500 mt-1">
            Add or remove members and manage their roles in "{workspace?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto">
          {/* Add Member Section */}
          <div className="p-4 bg-zinc-50/50 border border-zinc-200/80 rounded-xl space-y-4">
            <Label className="text-sm font-semibold text-zinc-900">Add New Member</Label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 border-zinc-200 focus-visible:ring-zinc-900"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {availableUsers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-600">
                        {searchQuery ? 'No users found' : 'All users are already members'}
                      </div>
                    ) : (
                      availableUsers.map(user => (
                        <SelectItem key={user.id} value={user.email}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                {getInitials(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{user.full_name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAddMember}
              disabled={!selectedUser || isAdding}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-sm"
              size="sm"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </div>

          {/* Current Members List */}
          <div>
            <Label className="text-sm font-semibold mb-3 block text-zinc-900">
              Current Members ({currentMembers.length})
            </Label>

            {currentMembers.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <Users className="h-12 w-12 mx-auto mb-2 text-zinc-200" />
                <p className="text-sm">No members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentMembers.map((member) => (
                  <div
                    key={member.user_email}
                    className="flex items-center justify-between p-3 bg-white border border-zinc-200/80 rounded-xl hover:shadow-sm transition-shadow shadow-sm"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-zinc-100 text-zinc-700 font-medium">
                          {getInitials(member.user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-900 truncate text-sm tracking-tight">{member.user_name}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{member.user_email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {member.user_email === workspace?.owner_email ? (
                        <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 border text-xs shadow-none">
                          Owner
                        </Badge>
                      ) : (
                        <>
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleChangeRole(member.user_email, value)}
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveMember(member.user_email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role Descriptions */}
          <div className="p-4 bg-zinc-50/50 border border-zinc-200 rounded-xl">
            <p className="text-xs font-semibold text-zinc-900 mb-2">Role Permissions:</p>
            <ul className="text-xs text-zinc-500 space-y-1.5">
              <li><strong className="text-zinc-700">Admin:</strong> Full workspace access, can manage members and settings</li>
              <li><strong className="text-zinc-700">Member:</strong> Can create and edit projects within the workspace</li>
              <li><strong className="text-zinc-700">Viewer:</strong> Read-only access to workspace projects</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-100">
          <Button onClick={onClose} className="rounded-lg shadow-sm border-zinc-200 bg-zinc-900 hover:bg-zinc-800 text-white">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

