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

  const statusColors = {
    active: "bg-green-100 text-green-800 border-green-200",
    trial: "bg-amber-100 text-amber-800 border-amber-200",
    suspended: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  };

  const planColors = {
    free: "bg-slate-100 text-slate-800",
    starter: "bg-blue-100 text-blue-800",
    professional: "bg-purple-100 text-purple-800",
    enterprise: "bg-amber-100 text-amber-800",
  };

  const handleSuccess = async () => {
    console.log('[TenantBrandingHeader] Update successful, refetching tenant...');
    await refetch();
    setShowEditDialog(false);

    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('tenant-updated'));
  };

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-xl shadow-sm">
        {/* Logo */}
        <div className="flex-shrink-0">
          {tenant.branding?.logo_url ? (
            <img
              src={tenant.branding.logo_url}
              alt={tenant.name}
              className="h-14 w-14 object-contain rounded-lg border border-slate-200 bg-white p-1.5"
              key={tenant.branding.logo_url}
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-white" />
            </div>
          )}
        </div>

        {/* Company Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 truncate">{tenant.name}</h2>
            {currentUser.role === 'admin' && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Crown className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className={planColors[tenant.subscription_plan] || planColors.free}>
              {tenant.subscription_plan ? (tenant.subscription_plan.charAt(0).toUpperCase() + tenant.subscription_plan.slice(1)) : 'Free'} Plan
            </Badge>
            <Badge variant="outline" className={statusColors[tenant.status] || statusColors.active}>
              {tenant.status}
            </Badge>

            {tenant.company_city && tenant.company_country && (
              <span className="text-slate-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {tenant.company_city}, {tenant.company_country}
              </span>
            )}
          </div>

          {/* Additional Info - Only show if available */}
          {(tenant.company_phone || tenant.billing_email || tenant.branding?.company_website) && (
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600">
              {tenant.company_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {tenant.company_phone}
                </span>
              )}
              {tenant.billing_email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {tenant.billing_email}
                </span>
              )}
              {tenant.branding?.company_website && (
                <a
                  href={tenant.branding.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                >
                  <Globe className="h-3 w-3" />
                  Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Edit Button - Only for admins */}
        {currentUser.role === 'admin' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditDialog(true)}
            className="flex-shrink-0"
          >
            <Settings className="h-4 w-4 mr-2" />
            Company Settings
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

