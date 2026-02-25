import React from "react";
import { cn } from "@/lib/utils";

export default function PresenceIndicator({ status, size = "sm", className }) {
  const statusColors = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    busy: "bg-red-500",
    offline: "bg-slate-400",
  };

  const sizes = {
    xs: "h-2 w-2",
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "rounded-full border-2 border-white",
          statusColors[status] || statusColors.offline,
          sizes[size]
        )}
      />
      {status === 'online' && (
        <div
          className={cn(
            "absolute inset-0 rounded-full animate-ping",
            statusColors.online,
            "opacity-75"
          )}
        />
      )}
    </div>
  );
}