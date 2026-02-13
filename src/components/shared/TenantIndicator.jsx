import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TenantIndicator() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: tenant } = useQuery({
    queryKey: ['current-tenant', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return null;
      const tenants = await groonabackend.entities.Tenant.filter({ id: currentUser.tenant_id });
      return tenants[0] || null;
    },
    enabled: !!currentUser?.tenant_id && !currentUser?.is_super_admin,
  });

  // Don't show for super admins or if no tenant
  if (!currentUser || currentUser.is_super_admin || !tenant) {
    return null;
  }

  const statusColors = {
    active: "bg-green-100 text-green-800 border-green-200",
    trial: "bg-amber-100 text-amber-800 border-amber-200",
    suspended: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${statusColors[tenant.status]} flex items-center gap-1.5`}>
              <Building2 className="h-3 w-3" />
              <span className="font-medium">{tenant.name}</span>
            </Badge>
            {tenant.status === 'trial' && (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p><span className="font-semibold">Plan:</span> {tenant.subscription_plan}</p>
            <p><span className="font-semibold">Status:</span> {tenant.status}</p>
            {tenant.trial_ends_at && tenant.status === 'trial' && (
              <p className="text-amber-600">
                Trial ends: {new Date(tenant.trial_ends_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

