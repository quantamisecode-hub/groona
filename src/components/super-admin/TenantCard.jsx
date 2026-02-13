import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, FolderKanban, Eye, Settings, Trash2, Calendar, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import EditTenantDialog from "./EditTenantDialog";
import { toast } from "sonner";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createPageUrl } from "@/utils"; // FIXED: Import createPageUrl

export default function TenantCard({ tenant, onUpdate, onDelete, userCount, projectCount }) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [switchingView, setSwitchingView] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  // Fetch users for this tenant
  const { data: tenantUsers = [] } = useQuery({
    queryKey: ['tenant-users', tenant.id],
    queryFn: async () => {
      const users = await groonabackend.entities.User.filter({ tenant_id: tenant.id });
      return users;
    },
    enabled: showUsers,
  });

  const statusColors = {
    active: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
    trial: "bg-amber-100 text-amber-800",
    cancelled: "bg-slate-100 text-slate-800",
  };

  const planColors = {
    free: "bg-slate-100 text-slate-800",
    starter: "bg-blue-100 text-blue-800",
    "starter trial": "bg-blue-100 text-blue-800",
    professional: "bg-purple-100 text-purple-800",
    enterprise: "bg-amber-100 text-amber-800",
  };

  const handleViewAsTenant = async () => {
    setSwitchingView(true);
    try {
      // Update Super Admin's active_tenant_id to switch context
      await groonabackend.auth.updateMe({
        active_tenant_id: tenant.id
      });

      toast.success(`Switched to ${tenant.name} view`);
      
      // Reload the page to apply tenant context
      setTimeout(() => {
        // FIXED: Redirect to Dashboard instead of Landing Page ('/')
        window.location.href = createPageUrl("Dashboard");
      }, 500);
    } catch (error) {
      console.error('Failed to switch tenant view:', error);
      toast.error('Failed to switch tenant view');
      setSwitchingView(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return initials.slice(0, 2) || 'U';
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-all">
        <CardContent className="p-6 space-y-4">
          {/* Header with Logo */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {tenant.branding?.logo_url ? (
                <img 
                  src={tenant.branding.logo_url} 
                  alt={tenant.name}
                  className="h-12 w-12 object-contain rounded-lg border border-slate-200 bg-white p-1 flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">{tenant.name}</h3>
                <p className="text-sm text-slate-600 truncate">{tenant.owner_email}</p>
              </div>
            </div>
          </div>

          {/* Status & Plan Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={statusColors[tenant.status]}>
              {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
            </Badge>
            <Badge className={planColors[tenant.subscription_plan] || "bg-slate-100 text-slate-800"}>
              {tenant.subscription_plan.split(/[_\s]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-slate-700">
                <span className="font-semibold">{userCount}</span> / {tenant.max_users}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FolderKanban className="h-4 w-4 text-slate-500" />
              <span className="text-slate-700">
                <span className="font-semibold">{projectCount}</span> / {tenant.max_projects}
              </span>
            </div>
          </div>

          {/* Trial Info */}
          {tenant.status === 'trial' && tenant.trial_ends_at && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              <AlertCircle className="h-3 w-3" />
              <span>Trial ends: {format(new Date(tenant.trial_ends_at), "MMM d, yyyy")}</span>
            </div>
          )}

          {/* Created Date */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar className="h-3 w-3" />
            <span>Created: {format(new Date(tenant.created_date), "MMM d, yyyy")}</span>
          </div>

          {/* Users List Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUsers(!showUsers)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              View Users ({userCount})
            </span>
            {showUsers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          {/* Users List */}
          {showUsers && (
            <div className="space-y-2 pt-2 border-t">
              {tenantUsers.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-2">No users yet</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {tenantUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Avatar className="h-8 w-8 border border-slate-200">
                        <AvatarImage src={user.profile_image_url} alt={user.full_name} />
                        <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
                        <p className="text-xs text-slate-600 truncate">{user.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleViewAsTenant}
              disabled={switchingView || tenant.status === 'suspended'}
              className="flex-1"
              title={tenant.status === 'suspended' ? 'Cannot view suspended tenant' : 'Switch to this tenant view'}
            >
              {switchingView ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditDialog(true)}
              className="flex-1"
            >
              <Settings className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditTenantDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        tenant={tenant}
        onSubmit={(data) => {
          onUpdate(data);
          setShowEditDialog(false);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{tenant.name}"? This will permanently delete all data associated with this tenant, including users, projects, and tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

