import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Folder, Loader2 } from "lucide-react";

export default function WorkspaceSelector({ currentUser, onWorkspaceChange, selectedWorkspaceId }) {
  // CRITICAL FIX: Default to "all" instead of auto-selecting first workspace
  const [localSelection, setLocalSelection] = useState(selectedWorkspaceId || "all");

  // CRITICAL: Determine the effective tenant ID for filtering (RBAC + Multi-Tenancy)
  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  console.log('[WorkspaceSelector] Effective Tenant ID:', effectiveTenantId);
  console.log('[WorkspaceSelector] Selected Workspace ID:', selectedWorkspaceId);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        console.log('[WorkspaceSelector] No effective tenant ID - Super Admin in global view');
        return groonabackend.entities.Workspace.list();
      }
      console.log('[WorkspaceSelector] Filtering workspaces by tenant:', effectiveTenantId);
      return groonabackend.entities.Workspace.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!effectiveTenantId,
  });

  // Filter workspaces to only show those the user has access to
  const accessibleWorkspaces = workspaces.filter(ws => {
    // Super Admins can see all workspaces in the current tenant context
    if (currentUser?.is_super_admin) {
      return true;
    }
    
    // Regular Admins can see all workspaces in their tenant
    if (currentUser?.role === 'admin') {
      return true;
    }
    
    // Regular users can only see workspaces they're members of or own
    const isMember = ws.members?.some(m => m.user_email === currentUser?.email);
    const isOwner = ws.owner_email === currentUser?.email;
    
    return isMember || isOwner;
  });

  console.log('[WorkspaceSelector] Total workspaces:', workspaces.length, '| Accessible:', accessibleWorkspaces.length);

  // CRITICAL FIX: Don't auto-select first workspace
  // Only set initial value if a workspace was explicitly provided
  useEffect(() => {
    if (selectedWorkspaceId && selectedWorkspaceId !== "all") {
      setLocalSelection(selectedWorkspaceId);
      console.log('[WorkspaceSelector] Using provided workspace:', selectedWorkspaceId);
    } else {
      // Default to "all" to show all projects
      setLocalSelection("all");
      onWorkspaceChange?.(null);
      console.log('[WorkspaceSelector] Defaulting to "All Workspaces"');
    }
  }, [selectedWorkspaceId]);

  const handleChange = (value) => {
    const workspaceId = value === "all" ? null : value;
    setLocalSelection(value);
    onWorkspaceChange?.(workspaceId);
    console.log('[WorkspaceSelector] Workspace changed to:', value === "all" ? "All Workspaces" : value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-600">Loading workspaces...</span>
      </div>
    );
  }

  if (accessibleWorkspaces.length === 0) {
    console.log('[WorkspaceSelector] No accessible workspaces found');
    return null;
  }

  return (
    <Select value={localSelection} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px] bg-white" data-onboarding="workspace-selector">
        <Folder className="h-4 w-4 mr-2 text-slate-600" />
        <SelectValue placeholder="All Workspaces" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Workspaces</SelectItem>
        {accessibleWorkspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            <div className="flex items-center gap-2">
              {workspace.name}
              {workspace.is_default && (
                <span className="text-xs text-slate-500">(Default)</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

