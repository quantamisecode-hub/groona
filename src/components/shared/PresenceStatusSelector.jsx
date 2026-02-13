import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PresenceIndicator from "./PresenceIndicator";

export default function PresenceStatusSelector({ user }) {
  const [updating, setUpdating] = useState(false);
  const queryClient = useQueryClient();

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await groonabackend.auth.updateMe({
        presence_status: newStatus,
        last_seen: new Date().toISOString(),
      });
      
      // Dispatch event to notify all components for real-time updates
      window.dispatchEvent(new CustomEvent('profile-updated'));
      window.dispatchEvent(new CustomEvent('presence-updated', { detail: { status: newStatus } }));
      
      // Invalidate queries for real-time reflection
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      
      toast.success(`Status changed to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const statuses = [
    { value: 'online', label: 'Online', color: 'text-green-700' },
    { value: 'busy', label: 'Busy', color: 'text-red-700' },
    { value: 'away', label: 'Away', color: 'text-yellow-700' },
    { value: 'offline', label: 'Appear Offline', color: 'text-slate-700' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={updating} className="flex items-center gap-2">
          {updating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <PresenceIndicator status={user.presence_status || 'offline'} size="sm" />
          )}
          <span className="capitalize">{user.presence_status || 'Offline'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.value}
            onClick={() => handleStatusChange(status.value)}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <PresenceIndicator status={status.value} size="sm" />
              <span className={status.color}>{status.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

