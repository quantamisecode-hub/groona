import React, { useState, useEffect, useRef } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Folder, Plus, Shield, AlertCircle, Info, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import WorkspaceCard from "../components/workspaces/WorkspaceCard";
import CreateWorkspaceDialog from "../components/workspaces/CreateWorkspaceDialog";
import EditWorkspaceDialog from "../components/workspaces/EditWorkspaceDialog";
import ManageWorkspaceMembersDialog from "../components/workspaces/ManageWorkspaceMembersDialog";
import { useHasPermission } from "../components/shared/usePermissions";
import { createAuditLog, getSeverityForAction } from "../components/audit/createAuditLog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import { useUser } from "../components/shared/UserContext"; // Use Global User Context
import { io } from "socket.io-client";

export default function Workspaces() {
  // 1. Use Global User Context (Instant Access)
  const { user: currentUser, loading: userLoading, tenant } = useUser();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const [managingMembers, setManagingMembers] = useState(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    workspace: null,
    type: null,
    message: ''
  });
  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  const canCreateWorkspace = useHasPermission('can_create_workspace');

  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  // 2. WebSocket Connection for Real-Time Updates
  useEffect(() => {
    if (!effectiveTenantId) return;

    const socketUrl = API_BASE;
    socketRef.current = io(socketUrl);

    socketRef.current.on("connect", () => {
      console.log("[Workspaces] Socket connected");
      socketRef.current.emit("join_room", effectiveTenantId);
    });

    // Listen for workspace changes from other users
    socketRef.current.on("workspace_change", (data) => {
      console.log("[Workspaces] Real-time update received:", data);
      queryClient.invalidateQueries(['workspaces']);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [effectiveTenantId, queryClient]);

  // 3. Workspaces Query (Optimized)
  const {
    data: workspaces = [],
    isLoading: isWorkspacesLoading,
    isRefetching
  } = useQuery({
    queryKey: ['workspaces', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Workspace.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser && !!effectiveTenantId,
    // Cache Settings for Instant Load
    staleTime: 60 * 1000, // 1 minute fresh
    refetchInterval: 10000, // Poll every 10s as backup
  });

  // Fetch projects to calculate counts per workspace
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser && !!effectiveTenantId,
    staleTime: 60 * 1000,
  });

  // Helper function to get project count for a workspace
  const getProjectCount = (workspaceId) => {
    if (!workspaceId) return 0;
    return projects.filter(p => p.workspace_id === workspaceId).length;
  };

  const accessibleWorkspaces = workspaces.filter(ws => {
    if (currentUser?.is_super_admin) return true;
    if (currentUser?.role === 'admin') return true;
    if (ws.owner_email === currentUser?.email) return true;
    return ws.members?.some(m => m.user_email === currentUser?.email);
  });

  const activeWorkspaces = accessibleWorkspaces.filter(ws => ws.status === 'active' || !ws.status);
  const archivedWorkspaces = accessibleWorkspaces.filter(ws => ws.status === 'archived');

  const createWorkspaceMutation = useMutation({
    mutationFn: async (data) => {
      const workspace = await groonabackend.entities.Workspace.create({
        ...data,
        tenant_id: effectiveTenantId,
        owner_email: currentUser.email,
        owner_name: currentUser.full_name,
        status: 'active',
        members: [{
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          role: 'admin',
        }],
      });

      await createAuditLog({
        action: 'create',
        entity_type: 'workspace',
        entity_id: workspace.id,
        entity_name: workspace.name,
        user: currentUser,
        severity: getSeverityForAction('create', 'workspace'),
        description: `Created workspace: ${workspace.name}`,
      });

      return workspace;
    },
    onSuccess: (newWorkspace) => {
      // Optimistic Update
      queryClient.setQueryData(['workspaces', effectiveTenantId], (old) => {
        return old ? [...old, newWorkspace] : [newWorkspace];
      });

      // Notify others via Socket
      if (socketRef.current) {
        socketRef.current.emit("notify_workspace_change", {
          tenant_id: effectiveTenantId,
          action: "created",
          workspace: newWorkspace
        });
      }

      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setShowCreateDialog(false);
      toast.success('Workspace created successfully!');
    },
    onError: (error) => {
      console.error('Failed to create workspace:', error);
      toast.error('Failed to create workspace');
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updated = await groonabackend.entities.Workspace.update(id, data);
      await createAuditLog({
        action: 'update',
        entity_type: 'workspace',
        entity_id: id,
        entity_name: updated.name,
        user: currentUser,
        severity: getSeverityForAction('update', 'workspace'),
        description: `Updated workspace: ${updated.name}`,
      });
      return updated;
    },
    onSuccess: (updatedWorkspace) => {
      queryClient.setQueryData(['workspaces', effectiveTenantId], (old) => {
        return old ? old.map(ws => ws.id === updatedWorkspace.id ? updatedWorkspace : ws) : [];
      });

      queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      if (socketRef.current) {
        socketRef.current.emit("notify_workspace_change", {
          tenant_id: effectiveTenantId,
          action: "updated"
        });
      }

      setEditingWorkspace(null);
      setManagingMembers(null);
      toast.success('Workspace updated successfully!');
    },
    onError: (error) => {
      console.error('Failed to update workspace:', error);
      toast.error('Failed to update workspace');
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async ({ workspace, type }) => {
      if (type === 'archive') {
        await groonabackend.entities.Workspace.update(workspace.id, { status: 'archived' });
      } else if (type === 'restore') {
        await groonabackend.entities.Workspace.update(workspace.id, { status: 'active' });
      } else {
        await groonabackend.entities.Workspace.delete(workspace.id);
      }

      const actionType = type === 'restore' ? 'restore' : (type === 'archive' ? 'archive' : 'delete');
      await createAuditLog({
        action: actionType,
        entity_type: 'workspace',
        entity_id: workspace.id,
        entity_name: workspace.name,
        user: currentUser,
        severity: getSeverityForAction(actionType, 'workspace'),
        description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}d workspace: ${workspace.name}`,
      });
      return { id: workspace.id, type };
    },
    onSuccess: ({ id, type }) => {
      // Optimistic Remove/Update
      if (type === 'delete') {
        queryClient.setQueryData(['workspaces', effectiveTenantId], (old) => old.filter(w => w.id !== id));
      } else {
        queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      }

      if (socketRef.current) {
        socketRef.current.emit("notify_workspace_change", {
          tenant_id: effectiveTenantId,
          action: type
        });
      }

      let message = 'Workspace deleted successfully!';
      if (type === 'archive') message = 'Workspace archived successfully!';
      if (type === 'restore') message = 'Workspace restored successfully!';
      toast.success(message);
    },
    onError: (error) => {
      console.error('Failed to modify workspace:', error);
      toast.error('Failed to modify workspace');
    },
  });

  const handleDelete = (workspace, type) => {
    let title = '';
    let message = '';
    if (type === 'archive') {
      title = 'Archive Workspace';
      message = `Archive workspace "${workspace.name}"? You can restore it later.`;
    } else if (type === 'restore') {
      title = 'Restore Workspace';
      message = `Restore workspace "${workspace.name}"? It will become active again.`;
    } else {
      title = 'Delete Workspace';
      message = `Delete workspace "${workspace.name}"? This action cannot be undone.`;
    }

    setDeleteConfirmation({
      isOpen: true,
      workspace,
      type,
      title,
      message
    });
  };

  const workspaceLimit = tenant?.max_workspaces;
  const currentCount = workspaces.length;
  const userRole = currentUser?.is_super_admin || currentUser?.role === 'admin' ? 'admin' : 'user';

  // 4. Loading State Logic (Smart)
  // Only show skeletons if no user AND no cached data
  const isPageLoading = (userLoading && !currentUser) || (!workspaces.length && isWorkspacesLoading);

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="workspaces">
      <FeatureOnboarding currentUser={currentUser} featureArea="workspaces" userRole={userRole} />
      <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
        <div className="max-w-7xl mx-auto w-full flex flex-col relative" style={{ maxWidth: '100%' }}>
          {/* Sticky Header Section */}
          <div className="sticky top-0 z-30 bg-white border-b border-slate-200/60 pb-4 pt-6">
            <div className="px-4 md:px-6 lg:px-8 pt-0 pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Folder className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Workspaces</h1>
                      <p className="text-slate-600">
                        Organize your projects into dedicated workspaces
                        {isRefetching && !isPageLoading && <span className="ml-2 text-xs text-blue-500 animate-pulse font-medium">Syncing...</span>}
                      </p>
                    </div>
                  </div>
                </div>
                {canCreateWorkspace && currentUser?.custom_role !== 'project_manager' && (
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    disabled={isPageLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                )}
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 text-sm">
                  <strong>About Workspaces:</strong> Organize projects by team, department, or client.
                  Each workspace can have its own members with specific roles.
                  {workspaceLimit && !isPageLoading && (
                    <span className="ml-2">
                      You can create up to <strong>{workspaceLimit} workspaces</strong> on your current plan
                      ({currentCount}/{workspaceLimit} used).
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1">
            <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-4">
              {/* SKELETON LOADING STATE */}
              {isPageLoading ? (
                <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                          <div className="flex justify-between items-start">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                          </div>
                          <div className="space-y-2 pt-2">
                            <Skeleton className="h-5 w-3/4 rounded" />
                            <Skeleton className="h-4 w-full rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 transition-opacity duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Active Workspaces ({activeWorkspaces.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeWorkspaces.length === 0 ? (
                      <div className="text-center py-12">
                        <Folder className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-600 mb-2">No workspaces yet</p>
                        {canCreateWorkspace && currentUser?.custom_role !== 'project_manager' && (
                          <Button
                            onClick={() => setShowCreateDialog(true)}
                            variant="outline"
                            className="mt-2"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Your First Workspace
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeWorkspaces.map((workspace) => (
                          <WorkspaceCard
                            key={workspace.id}
                            workspace={workspace}
                            currentUser={currentUser}
                            projectCount={getProjectCount(workspace.id)}
                            onEdit={setEditingWorkspace}
                            onDelete={handleDelete}
                            onManageMembers={setManagingMembers}
                            onSelect={() => setSelectedWorkspace(workspace)}
                            isSelected={selectedWorkspace?.id === workspace.id}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Archived Section */}
              {!isPageLoading && archivedWorkspaces.length > 0 && (
                <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-600">
                      <Shield className="h-5 w-5" />
                      Archived Workspaces ({archivedWorkspaces.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedWorkspaces.map((workspace) => (
                        <WorkspaceCard
                          key={workspace.id}
                          workspace={workspace}
                          currentUser={currentUser}
                          projectCount={getProjectCount(workspace.id)}
                          onEdit={setEditingWorkspace}
                          onDelete={handleDelete}
                          onManageMembers={setManagingMembers}
                          onSelect={() => setSelectedWorkspace(workspace)}
                          isSelected={selectedWorkspace?.id === workspace.id}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(data) => createWorkspaceMutation.mutate(data)}
        loading={createWorkspaceMutation.isPending}
        workspaceLimit={workspaceLimit}
        currentCount={currentCount}
      />

      {editingWorkspace && (
        <EditWorkspaceDialog
          open={!!editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onSubmit={(data) => updateWorkspaceMutation.mutate({ id: editingWorkspace.id, data })}
          loading={updateWorkspaceMutation.isPending}
          workspace={editingWorkspace}
        />
      )}

      {managingMembers && (
        <ManageWorkspaceMembersDialog
          open={!!managingMembers}
          onClose={() => setManagingMembers(null)}
          workspace={managingMembers}
          onUpdate={(id, data) => updateWorkspaceMutation.mutate({ id, data })}
        />
      )}

      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmation.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmation.workspace) {
                  deleteWorkspaceMutation.mutate({
                    workspace: deleteConfirmation.workspace,
                    type: deleteConfirmation.type
                  });
                }
              }}
              className={deleteConfirmation.type === 'restore' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {deleteConfirmation.type === 'restore' ? 'Restore' : (deleteConfirmation.type === 'archive' ? 'Archive' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OnboardingProvider>
  );
}

