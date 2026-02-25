import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

export default function EditGroupDialog({ open, onClose, group, currentUser, effectiveTenantId }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [color, setColor] = useState(group.color);
  const [isActive, setIsActive] = useState(group.is_active);
  const [permissions, setPermissions] = useState(group.permissions || {});
  const queryClient = useQueryClient();

  console.log('[Aivora EditGroupDialog] Editing group:', group.name);

  const updateGroupMutation = useMutation({
    mutationFn: async () => {
      const updateData = {
        name,
        description,
        color,
        is_active: isActive,
        permissions,
      };

      console.log('[Aivora EditGroupDialog] Updating group with data:', updateData);
      const updatedGroup = await groonabackend.entities.UserGroup.update(group.id, updateData);

      // Log audit entry
      try {
        await groonabackend.entities.AuditLog.create({
          tenant_id: effectiveTenantId,
          action: 'update',
          entity_type: 'group',
          entity_id: group.id,
          entity_name: name,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          description: `Updated user group: ${name}`,
          severity: 'low',
          changes: {
            before: group,
            after: updateData,
          },
        });
      } catch (error) {
        console.error('[Aivora EditGroupDialog] Failed to log audit entry:', error);
      }

      return updatedGroup;
    },
    onSuccess: (updatedGroup) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success('Group updated successfully!');
      console.log('[Aivora EditGroupDialog] Group updated:', updatedGroup.name);
      onClose();
    },
    onError: (error) => {
      console.error('[Aivora EditGroupDialog] Failed to update group:', error);
      toast.error('Failed to update group. Please try again.');
    },
  });

  const handlePermissionToggle = (resource, action, value) => {
    setPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: value,
      },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    updateGroupMutation.mutate();
  };

  const permissionResources = [
    {
      key: 'projects',
      label: 'Projects',
      actions: ['create', 'read', 'update', 'delete'],
    },
    {
      key: 'tasks',
      label: 'Tasks',
      actions: ['create', 'read', 'update', 'delete', 'assign'],
    },
    {
      key: 'workspaces',
      label: 'Workspaces',
      actions: ['create', 'read', 'update', 'delete', 'manage_members'],
    },
    {
      key: 'timesheets',
      label: 'Timesheets',
      actions: ['create', 'read', 'update', 'delete', 'approve'],
    },
    {
      key: 'team',
      label: 'Team',
      actions: ['view', 'manage'],
    },
    {
      key: 'reports',
      label: 'Reports',
      actions: ['view', 'export'],
    },
    {
      key: 'automation',
      label: 'Automation',
      actions: ['view', 'manage'],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
          <DialogDescription>
            Update group settings and permissions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={updateGroupMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={updateGroupMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select value={color} onValueChange={setColor} disabled={updateGroupMutation.isPending}>
                  <SelectTrigger id="color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="purple">Purple</SelectItem>
                    <SelectItem value="pink">Pink</SelectItem>
                    <SelectItem value="amber">Amber</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                <div>
                  <Label htmlFor="isActive">Active Status</Label>
                  <p className="text-xs text-slate-600">Inactive groups don't grant permissions</p>
                </div>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={updateGroupMutation.isPending}
                />
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="space-y-4">
              {permissionResources.map(resource => (
                <div key={resource.key} className="space-y-2">
                  <h3 className="font-semibold text-sm text-slate-900 border-b pb-2">
                    {resource.label}
                  </h3>
                  <div className="space-y-2">
                    {resource.actions.map(action => (
                      <div
                        key={action}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
                      >
                        <Label htmlFor={`${resource.key}-${action}`} className="capitalize cursor-pointer">
                          {action.replace('_', ' ')}
                        </Label>
                        <Switch
                          id={`${resource.key}-${action}`}
                          checked={permissions[resource.key]?.[action] || false}
                          onCheckedChange={(checked) => handlePermissionToggle(resource.key, action, checked)}
                          disabled={updateGroupMutation.isPending}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateGroupMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateGroupMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                {updateGroupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

