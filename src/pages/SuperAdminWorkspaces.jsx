import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Folder, Shield, Search, Building2, Users, Loader2, Trash2, Eye, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { format, isValid } from "date-fns";

export default function SuperAdminWorkspaces() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTenant, setFilterTenant] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    workspace: null
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      if (!user.is_super_admin) {
        window.location.href = "/";
      }
      setCurrentUser(user);

      // CRITICAL FIX: If viewing as a tenant, auto-set the tenant filter
      if (user.active_tenant_id) {
        setFilterTenant(user.active_tenant_id);
      }
    }).catch(() => { });
  }, []);

  // CRITICAL FIX: Determine if Super Admin is viewing as a specific tenant
  const isViewingAsTenant = currentUser?.is_super_admin && currentUser?.active_tenant_id;
  const effectiveTenantId = isViewingAsTenant ? currentUser.active_tenant_id : null;

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['all-workspaces', effectiveTenantId],
    queryFn: async () => {
      if (effectiveTenantId) {
        // Super Admin viewing as specific tenant - filter by that tenant
        console.log('[SuperAdminWorkspaces] Filtering workspaces by tenant:', effectiveTenantId);
        return groonabackend.entities.Workspace.filter({ tenant_id: effectiveTenantId }, '-created_date');
      }
      // Super Admin in global view - show all workspaces
      return groonabackend.entities.Workspace.list('-created_date');
    },
    enabled: !!currentUser,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['all-projects', effectiveTenantId],
    queryFn: async () => {
      if (effectiveTenantId) {
        // Filter projects by tenant when viewing as tenant
        const allProjects = await groonabackend.entities.Project.list();
        return allProjects.filter(p => p.tenant_id === effectiveTenantId);
      }
      return groonabackend.entities.Project.list();
    },
    enabled: !!currentUser,
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.Workspace.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-workspaces'] });
      toast.success('Workspace deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete workspace:', error);
      toast.error('Failed to delete workspace');
    },
  });

  // Filter workspaces
  const filteredWorkspaces = workspaces.filter(ws => {
    const matchesSearch =
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.owner_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTenant = filterTenant === 'all' || ws.tenant_id === filterTenant;
    const matchesStatus = filterStatus === 'all' || ws.status === filterStatus;

    return matchesSearch && matchesTenant && matchesStatus;
  });

  const getTenantName = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.name || 'Unknown Tenant';
  };

  const getProjectCount = (workspaceId) => {
    return projects.filter(p => p.workspace_id === workspaceId).length;
  };

  const handleDeleteWorkspace = (workspace) => {
    setDeleteConfirmation({
      isOpen: true,
      workspace
    });
  };

  // Helper to safely format dates
  const formatDateSafe = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy') : 'Invalid Date';
    } catch (error) {
      return 'N/A';
    }
  };

  if (!currentUser?.is_super_admin) {
    return null;
  }

  const stats = {
    total: filteredWorkspaces.length,
    active: filteredWorkspaces.filter(ws => ws.status === 'active').length,
    archived: filteredWorkspaces.filter(ws => ws.status === 'archived').length,
    totalProjects: projects.filter(p => filteredWorkspaces.some(ws => ws.id === p.workspace_id)).length,
  };

  // Get the current tenant being viewed
  const viewingTenant = isViewingAsTenant ? tenants.find(t => t.id === effectiveTenantId) : null;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Workspace Management</h1>
              <p className="text-slate-600">
                {isViewingAsTenant
                  ? `Managing workspaces for ${viewingTenant?.name || 'tenant'}`
                  : 'Manage workspaces across all tenants'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Viewing As Tenant Alert */}
      {isViewingAsTenant && viewingTenant && (
        <Alert className="border-amber-200 bg-amber-50">
          <Eye className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 text-sm">
            <strong>Viewing as Tenant:</strong> {viewingTenant.name} -
            Showing only workspaces and projects belonging to this tenant.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">
                  {isViewingAsTenant ? 'Tenant Workspaces' : 'Total Workspaces'}
                </p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Folder className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Folder className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Archived</p>
                <p className="text-3xl font-bold text-amber-600">{stats.archived}</p>
              </div>
              <Folder className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">
                  {isViewingAsTenant ? 'Tenant Projects' : 'Total Projects'}
                </p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalProjects}</p>
              </div>
              <Building2 className="h-10 w-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by workspace name or owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Only show tenant filter if NOT viewing as a specific tenant */}
            {!isViewingAsTenant && (
              <Select value={filterTenant} onValueChange={setFilterTenant}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workspaces Table */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardHeader>
          <CardTitle>
            Workspaces ({filteredWorkspaces.length})
            {isViewingAsTenant && (
              <Badge className="ml-3 bg-amber-100 text-amber-800 border-amber-200">
                {viewingTenant?.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workspacesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Folder className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p>
                {isViewingAsTenant
                  ? `No workspaces found for ${viewingTenant?.name}`
                  : 'No workspaces found'
                }
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Workspace</TableHead>
                    {!isViewingAsTenant && <TableHead>Tenant</TableHead>}
                    <TableHead>Owner</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkspaces.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="font-medium text-slate-900">{workspace.name}</p>
                            {workspace.description && (
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                {workspace.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {!isViewingAsTenant && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <span className="text-sm">{getTenantName(workspace.tenant_id)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{workspace.owner_name}</p>
                          <p className="text-xs text-slate-500">{workspace.owner_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span className="text-sm">{workspace.members?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getProjectCount(workspace.id)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          workspace.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200 border'
                            : 'bg-slate-100 text-slate-700 border-slate-200 border'
                        }>
                          {workspace.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {formatDateSafe(workspace.created_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteWorkspace(workspace)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete workspace "{deleteConfirmation.workspace?.name}"?
              This action cannot be undone and will affect {deleteConfirmation.workspace ? getProjectCount(deleteConfirmation.workspace.id) : 0} projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmation.workspace) {
                  deleteWorkspaceMutation.mutate(deleteConfirmation.workspace.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

