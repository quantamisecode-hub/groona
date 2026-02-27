import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Settings, MapPin, Phone, Mail, Globe, Crown } from "lucide-react";
import EditTenantProfileDialog from "./EditTenantProfileDialog";

export default function TenantBrandingHeader({ currentUser }) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: tenant, refetch } = useQuery({
    queryKey: ['current-tenant', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return null;
      // FIX: Changed 'id' to '_id' to correctly match the MongoDB database field
      const tenants = await groonabackend.entities.Tenant.filter({ _id: currentUser.tenant_id });

      console.log('[TenantBrandingHeader] Loaded tenant:', tenants[0]);

      return tenants[0] || null;
    },
    enabled: !!currentUser?.tenant_id,
  });

  // Don't show if no tenant
  if (!currentUser || !tenant) {
    return null;
  }

  const handleSuccess = async () => {
    console.log('[TenantBrandingHeader] Update successful, refetching tenant...');
    await refetch();
    setShowEditDialog(false);

    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('tenant-updated'));
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm mb-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Compact Logo */}
          <div className="flex-shrink-0">
            {tenant.branding?.logo_url ? (
              <img
                src={tenant.branding.logo_url}
                alt={tenant.name}
                className="h-8 w-8 object-contain rounded-md border border-slate-100 bg-white p-0.5"
                key={tenant.branding.logo_url}
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          {/* Company Info - Single Inline Row */}
          <div className="flex items-center gap-2 truncate">
            <h2 className="text-[14px] font-semibold text-slate-800 truncate">{tenant.name}</h2>

            {currentUser.role === 'admin' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                <Crown className="h-2.5 w-2.5 mr-1" />
                Admin
              </span>
            )}

            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 ml-1">
              {tenant.subscription_plan ? (tenant.subscription_plan.charAt(0).toUpperCase() + tenant.subscription_plan.slice(1)) : 'Free'} Plan
            </span>

            <span className={`hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tenant.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${tenant.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`} />
              {tenant.status === 'active' ? 'Active' : tenant.status}
            </span>
          </div>
        </div>

        {/* Minimal Settings Button */}
        {currentUser.role === 'admin' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditDialog(true)}
            className="flex-shrink-0 h-8 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2.5"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>
        )}
      </div>

      {/* Edit Dialog */}
      {currentUser.role === 'admin' && (
        <EditTenantProfileDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          tenant={tenant}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

