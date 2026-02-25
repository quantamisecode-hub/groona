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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CreateGroupDialog({ open, onClose, currentUser, effectiveTenantId }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const queryClient = useQueryClient();

  console.log('[Aivora CreateGroupDialog] Creating group for tenant:', effectiveTenantId);

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      const groupData = {
        tenant_id: effectiveTenantId,
        name,
        description,
        color,
        is_active: true,
        permissions: {
          projects: { create: false, read: true, update: false, delete: false },
          tasks: { create: false, read: true, update: false, delete: false, assign: false },
          workspaces: { create: false, read: true, update: false, delete: false, manage_members: false },
          timesheets: { create: true, read: true, update: false, delete: false, approve: false },
          team: { view: true, manage: false },
          reports: { view: false, export: false },
          automation: { view: false, manage: false },
        },
      };

      console.log('[Aivora CreateGroupDialog] Creating group with data:', groupData);
      const newGroup = await groonabackend.entities.UserGroup.create(groupData);

      // Log audit entry
      try {
        await groonabackend.entities.AuditLog.create({
          tenant_id: effectiveTenantId,
          action: 'create',
          entity_type: 'group',
          entity_id: newGroup.id,
          entity_name: newGroup.name,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
          description: `Created user group: ${name}`,
          severity: 'low',
        });
      } catch (error) {
        console.error('[Aivora CreateGroupDialog] Failed to log audit entry:', error);
      }

      return newGroup;
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success('Group created successfully!');
      console.log('[Aivora CreateGroupDialog] Group created:', newGroup.name);
      onClose();
    },
    onError: (error) => {
      console.error('[Aivora CreateGroupDialog] Failed to create group:', error);
      toast.error('Failed to create group. Please try again.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    createGroupMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create User Group</DialogTitle>
          <DialogDescription>
            Create a new group to organize users and manage permissions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Developers, Managers, Designers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={createGroupMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={createGroupMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Select value={color} onValueChange={setColor} disabled={createGroupMutation.isPending}>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createGroupMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25"
            >
              {createGroupMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

