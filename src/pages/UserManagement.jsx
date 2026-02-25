import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Edit,
  Trash2,
  Crown,
  Loader2,
  AlertCircle,
  CheckCircle,
  Settings,
  Building2,
  ShieldOff,
  Briefcase
} from "lucide-react";
import InviteUserDialog from "../components/user-management/InviteUserDialog";
import EditUserDialog from "../components/user-management/EditUserDialog";
import UserPermissionsDialog from "../components/user-management/UserPermissionsDialog";
import UserGroupManager from "../components/user-management/UserGroupManager";
import PresenceIndicator from "../components/shared/PresenceIndicator";
import ClientManagement from "../components/client/ClientManagement";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHasPermission } from "../components/shared/usePermissions";
import { useUser } from "../components/shared/UserContext";
import ConfirmationDialog from "../components/shared/ConfirmationDialog";

export default function UserManagement() {
  // Use global user context to prevent loading spinner on navigation
  const { user: currentUser, effectiveTenantId } = useUser();

  const canInviteUser = useHasPermission('can_invite_user');
  const canEditUser = useHasPermission('can_edit_user');
  const canDeleteUser = useHasPermission('can_delete_user');
  const canManagePermissions = useHasPermission('can_manage_permissions');

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [managingPermissions, setManagingPermissions] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [deletingUser, setDeletingUser] = useState(null);
  const queryClient = useQueryClient();

  // Determine platform mode based on context
  const isInPlatformMode = currentUser?.is_super_admin && !effectiveTenantId;

  // Fetch Tenants (Only for Super Admin Platform Mode to show tenant names)
  const { data: tenants = [] } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: () => groonabackend.entities.Tenant.list(),
    enabled: !!isInPlatformMode,
    staleTime: 5 * 60 * 1000,
  });

  const getTenantName = (tenantId) => {
    if (!tenantId) return 'N/A';
    const tenant = tenants.find(t => t.id === tenantId || t._id === tenantId);
    return tenant ? tenant.name : 'Unknown Tenant';
  };

  // Fetch users with real-time updates
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      if (currentUser?.is_super_admin && !effectiveTenantId) {
        return groonabackend.entities.User.list();
      }
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!currentUser,
    refetchInterval: 5000, // Poll every 5s for real-time updates
  });

  // Filter out Super Admin users from display when NOT in platform mode
  const users = allUsers.filter(user => {
    if (isInPlatformMode) return true;
    return !user.is_super_admin;
  });

  // Fetch user groups with real-time updates
  const { data: groups = [] } = useQuery({
    queryKey: ['user-groups', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.UserGroup.list();
      return groonabackend.entities.UserGroup.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  // Fetch group memberships with real-time updates
  const { data: memberships = [] } = useQuery({
    queryKey: ['group-memberships', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.UserGroupMembership.list();
      return groonabackend.entities.UserGroupMembership.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => groonabackend.entities.User.update(userId, data),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
    },
    onError: (error) => {
      console.error('[Aivora UserManagement] Failed to update user:', error);
      toast.error('Failed to update user');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId) => groonabackend.entities.User.delete(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
    onError: (error) => {
      console.error('[Aivora UserManagement] Failed to delete user:', error);
      toast.error('Failed to delete user');
    },
  });

  // Filter users
  const filteredUsers = users.filter(user =>
    (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.role?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // Categorize users - separate clients and project managers
  const superAdmins = filteredUsers.filter(u => u.is_super_admin);
  const admins = filteredUsers.filter(u => !u.is_super_admin && u.role === 'admin' && u.custom_role !== 'client' && u.custom_role !== 'project_manager');
  const clients = filteredUsers.filter(u => u.custom_role === 'client');
  const projectManagers = filteredUsers.filter(u => u.custom_role === 'project_manager');
  const generalUsers = filteredUsers.filter(u => !u.is_super_admin && u.role !== 'admin' && u.custom_role !== 'client' && u.custom_role !== 'project_manager');

  const handlePromoteToAdmin = (user) => {
    if (confirm(`Promote ${user.full_name} to Admin?`)) {
      updateUserMutation.mutate({ userId: user.id, data: { role: 'admin' } });
    }
  };

  const handleDemoteToUser = (user) => {
    if (confirm(`Demote ${user.full_name} to Regular User?`)) {
      updateUserMutation.mutate({ userId: user.id, data: { role: 'user' } });
    }
  };

  const handleDeleteUser = (user) => {
    setDeletingUser(user);
  };

  const confirmDeleteUser = () => {
    if (deletingUser) {
      deleteUserMutation.mutate(deletingUser.id);
      setDeletingUser(null);
    }
  };

  const getUserGroups = (userEmail) => {
    const userMemberships = memberships.filter(m => m.user_email === userEmail);
    return userMemberships
      .map(m => groups.find(g => g.id === m.group_id))
      .filter(Boolean);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Admins and super admins can access user management
  // Project managers can view but cannot edit/manage/invite users
  const isAllowed = currentUser && (
    currentUser.is_super_admin ||
    currentUser.role === 'admin'
  );

  // Don't show loader if user is already in context
  if (!currentUser) {
    return null;
  }

  // Allow project managers to view, but restrict their actions
  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative z-0 h-[calc(100vh-5rem)] overflow-hidden">
      <div className="max-w-[1800px] mx-auto w-full flex flex-col h-full relative" style={{ maxWidth: '100%' }}>
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200/60 shadow-sm flex-shrink-0">
          <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
            {/* Header */}
            <div className="flex flex-row justify-between items-start gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${isInPlatformMode
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20'
                    }`}>
                    <Users className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-4xl font-bold text-slate-900">User Management</h1>
                    <p className="text-xs md:text-base text-slate-600 hidden sm:block">
                      {isInPlatformMode
                        ? 'Manage users across all tenants'
                        : 'Manage users, roles, and permissions for your organization'
                      }
                    </p>
                  </div>
                </div>
              </div>
              {(currentUser.is_super_admin || (currentUser.role === 'admin' && currentUser.custom_role !== 'project_manager')) && (
                <Button
                  onClick={() => setShowInviteDialog(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md transition-all hover:shadow-lg flex-shrink-0"
                >
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Invite User</span>
                </Button>
              )}
            </div>

            {/* Viewing Context Alert */}
            {currentUser.is_super_admin && effectiveTenantId && (
              <Alert className="border-blue-200 bg-blue-50 mb-4">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 text-sm">
                  Viewing users for the selected tenant. Super Admin users are hidden from this view.
                </AlertDescription>
              </Alert>
            )}

            {/* Tabs with Search Bar */}
            <div className="flex items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 inline-flex justify-start overflow-x-auto h-auto gap-1 hide-scrollbar snap-x p-1 w-fit">
                  <TabsTrigger value="users" className="gap-2 whitespace-nowrap snap-start flex-shrink-0">
                    <Users className="h-4 w-4" />
                    Users ({filteredUsers.length})
                  </TabsTrigger>
                  <TabsTrigger value="groups" className="gap-2 whitespace-nowrap snap-start flex-shrink-0">
                    <Shield className="h-4 w-4" />
                    Groups ({groups.length})
                  </TabsTrigger>
                  <TabsTrigger value="clients" className="gap-2 whitespace-nowrap snap-start flex-shrink-0">
                    <UserPlus className="h-4 w-4" />
                    Client Users
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {/* Search Bar - Beside Clients button */}
              {activeTab === 'users' && (
                <div className="relative flex-1 max-w-md ml-auto">
                  <Input
                    placeholder="Search users by name, email, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/80 backdrop-blur-xl h-9"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-3 pb-24 md:pb-32 pt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>

              {/* Users Tab */}
              <TabsContent value="users" className="space-y-6 mt-4">
                {usersLoading && users.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Super Administrators */}
                    {isInPlatformMode && superAdmins.length > 0 && (
                      <Card className="bg-white/80 backdrop-blur-xl border-amber-200/60">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-amber-700">
                            <Crown className="h-5 w-5" />
                            Super Administrators ({superAdmins.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {superAdmins.map(user => (
                            <UserCard
                              key={user.id}
                              user={user}
                              currentUser={currentUser}
                              groups={getUserGroups(user.email)}
                              onEdit={() => setEditingUser(user)}
                              onManagePermissions={() => setManagingPermissions(user)}
                              onPromote={handlePromoteToAdmin}
                              onDemote={handleDemoteToUser}
                              onDelete={handleDeleteUser}
                              getInitials={getInitials}
                              isSuperAdmin={true}
                              tenantName={getTenantName(user.tenant_id)}
                              showTenant={false}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Administrators */}
                    {admins.length > 0 && (
                      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-blue-700">
                            <Shield className="h-5 w-5" />
                            Administrators ({admins.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {admins.map(user => (
                            <UserCard
                              key={user.id}
                              user={user}
                              currentUser={currentUser}
                              groups={getUserGroups(user.email)}
                              onEdit={() => setEditingUser(user)}
                              onManagePermissions={() => setManagingPermissions(user)}
                              onPromote={handlePromoteToAdmin}
                              onDemote={handleDemoteToUser}
                              onDelete={handleDeleteUser}
                              getInitials={getInitials}
                              tenantName={getTenantName(user.tenant_id)}
                              showTenant={isInPlatformMode}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Project Managers Section */}
                    {projectManagers.length > 0 && (
                      <Card className="bg-white/80 backdrop-blur-xl border-indigo-200/60">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-indigo-700">
                            <Briefcase className="h-5 w-5" />
                            Project Managers ({projectManagers.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {projectManagers.map(user => (
                            <UserCard
                              key={user.id}
                              user={user}
                              currentUser={currentUser}
                              groups={getUserGroups(user.email)}
                              onEdit={() => setEditingUser(user)}
                              onManagePermissions={() => setManagingPermissions(user)}
                              onPromote={handlePromoteToAdmin}
                              onDemote={handleDemoteToUser}
                              onDelete={handleDeleteUser}
                              getInitials={getInitials}
                              tenantName={getTenantName(user.tenant_id)}
                              showTenant={isInPlatformMode}
                              isProjectManager={true}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Clients Section */}
                    {clients.length > 0 && (
                      <Card className="bg-white/80 backdrop-blur-xl border-purple-200/60">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-purple-700">
                            <UserPlus className="h-5 w-5" />
                            Client Users ({clients.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {clients.map(user => (
                            <UserCard
                              key={user.id}
                              user={user}
                              currentUser={currentUser}
                              groups={getUserGroups(user.email)}
                              onEdit={() => setEditingUser(user)}
                              onManagePermissions={() => setManagingPermissions(user)}
                              onPromote={handlePromoteToAdmin}
                              onDemote={handleDemoteToUser}
                              onDelete={handleDeleteUser}
                              getInitials={getInitials}
                              tenantName={getTenantName(user.tenant_id)}
                              showTenant={isInPlatformMode}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* General Users */}
                    {generalUsers.length > 0 && (
                      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            All Users ({generalUsers.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {generalUsers.map(user => (
                            <UserCard
                              key={user.id}
                              user={user}
                              currentUser={currentUser}
                              groups={getUserGroups(user.email)}
                              onEdit={() => setEditingUser(user)}
                              onManagePermissions={() => setManagingPermissions(user)}
                              onPromote={handlePromoteToAdmin}
                              onDemote={handleDemoteToUser}
                              onDelete={handleDeleteUser}
                              getInitials={getInitials}
                              tenantName={getTenantName(user.tenant_id)}
                              showTenant={isInPlatformMode}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {filteredUsers.length === 0 && (
                      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                        <CardContent className="py-12 text-center text-slate-500">
                          <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                          <p>No users found</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups" className="mt-4">
                <UserGroupManager currentUser={currentUser} effectiveTenantId={effectiveTenantId} />
              </TabsContent>

              <TabsContent value="clients" className="mt-4">
                <ClientManagement tenantId={effectiveTenantId} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showInviteDialog && (
        <InviteUserDialog
          open={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          currentUser={currentUser}
          effectiveTenantId={effectiveTenantId}
        />
      )}

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
          currentUser={currentUser}
          effectiveTenantId={effectiveTenantId}
        />
      )}

      {managingPermissions && (
        <UserPermissionsDialog
          open={!!managingPermissions}
          onClose={() => setManagingPermissions(null)}
          user={managingPermissions}
          currentUser={currentUser}
          effectiveTenantId={effectiveTenantId}
          groups={groups}
          memberships={memberships}
        />
      )}

      <ConfirmationDialog
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={confirmDeleteUser}
        title="Delete User?"
        description={`Are you sure you want to delete ${deletingUser?.full_name}?`}
        confirmLabel="Delete User"
        confirmType="danger"
        loading={deleteUserMutation.isPending}
      />
    </div>
  );
}

// Updated User Card Component to show Tenant Name & Correct Badges
function UserCard({ user, currentUser, groups, onEdit, onManagePermissions, onPromote, onDemote, onDelete, getInitials, isSuperAdmin = false, tenantName, showTenant, isProjectManager = false }) {
  const isCurrentUser = user.id === currentUser.id;
  const isOwner = currentUser.role === 'admin' && currentUser.custom_role === 'owner';
  // Project managers can invite users/clients but cannot edit/delete users in user management
  const isCurrentUserProjectManager = currentUser.custom_role === 'project_manager';

  // Owners (admin + owner custom_role) can edit/delete ANY user in their tenant
  // Super admins can edit/delete any user (except other super admins)
  // Project managers cannot edit/delete users
  const canModify = (currentUser.is_super_admin || isOwner) && !user.is_super_admin;
  const canChangeRole = (currentUser.is_super_admin || isOwner) && !user.is_super_admin && !isCurrentUser;
  // Project managers cannot edit or delete users
  const canEdit = canModify && !isCurrentUserProjectManager;
  const canDelete = canModify && !isCurrentUser && !isSuperAdmin && !isCurrentUserProjectManager;
  const displayName = user.full_name || 'Unknown User';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:shadow-md transition-all gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative">
          <Avatar className="h-12 w-12 border-2 border-slate-200">
            <AvatarImage src={user.profile_image_url} alt={displayName} />
            <AvatarFallback className={`font-bold ${isSuperAdmin
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
              : user.role === 'admin'
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                : 'bg-gradient-to-br from-slate-500 to-slate-600 text-white'
              }`}>
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1">
            <PresenceIndicator status={user.presence_status || 'offline'} size="sm" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-slate-900 truncate">{displayName}</p>

            {showTenant && (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {tenantName}
              </Badge>
            )}

            {isCurrentUser && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">You</Badge>
            )}

            {/* --- BADGE LOGIC START --- */}
            {isSuperAdmin ? (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                <Crown className="h-3 w-3 mr-1" />
                Super Admin
              </Badge>
            ) : (
              <>
                {/* Owner Badge */}
                {user.custom_role === 'owner' && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                    <Crown className="h-3 w-3 mr-1" />
                    Owner
                  </Badge>
                )}

                {/* Admin Badge - Show for admins but not for project managers. Show for owners too */}
                {user.role === 'admin' && user.custom_role !== 'project_manager' && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">Admin</Badge>
                )}

                {/* Client Badge - Prioritize custom_role */}
                {user.custom_role === 'client' && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    <Building2 className="h-3 w-3 mr-1" />
                    Client User
                  </Badge>
                )}

                {/* Project Manager Badge - Only show this, not Admin badge */}
                {user.custom_role === 'project_manager' && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    <Briefcase className="h-3 w-3 mr-1" />
                    Project Manager
                  </Badge>
                )}

                {/* Manager Badge */}
                {user.role === 'manager' && user.custom_role !== 'project_manager' && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Manager</Badge>
                )}

                {/* Member Badge (Fallback for regular users) */}
                {user.role !== 'admin' && user.role !== 'manager' && user.custom_role !== 'client' && user.custom_role !== 'project_manager' && user.custom_role !== 'owner' && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">Member</Badge>
                )}

                {/* NEW: Custom Role Badge - Displays any other custom role beside the standard badges */}
                {user.custom_role && user.custom_role !== 'client' && user.custom_role !== 'project_manager' && user.custom_role !== 'owner' && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 capitalize">
                    {user.custom_role.replace(/_/g, ' ')}
                  </Badge>
                )}
              </>
            )}
            {/* --- BADGE LOGIC END --- */}

          </div>
          <p className="text-sm text-slate-600 truncate">{user.email}</p>

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {groups.map(group => (
                <Badge key={group.id} variant="outline" className="text-xs">
                  {group.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {canModify && (
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">

          {/* Admin Toggle Button - Only for owners/super admins, not for project managers */}
          {canChangeRole && !isSuperAdmin && (
            user.role === 'admin' && user.custom_role !== 'owner' ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex items-center gap-1 text-orange-600 hover:bg-orange-50"
                onClick={() => onDemote(user)}
                title="Remove Admin Rights"
              >
                <ShieldOff className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Remove Admin</span>
              </Button>
            ) : user.custom_role !== 'owner' && user.custom_role !== 'client' ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex items-center gap-1 text-blue-600 hover:bg-blue-50"
                onClick={() => onPromote(user)}
                title="Promote to Admin"
              >
                <Shield className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Make Admin</span>
              </Button>
            ) : null
          )}

          {/* Edit button - Owners and super admins can edit any user */}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(user)}
              title="Edit User"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}

          {/* Manage Permissions button - Owners and super admins can manage permissions */}
          {(isOwner || currentUser.is_super_admin) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onManagePermissions(user)}
              title="Manage Permissions"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          {/* Delete button - Owners and super admins can delete any user */}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50"
              onClick={() => onDelete(user)}
              title="Delete User"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}