import React, { createContext, useContext, useState, useEffect } from 'react';
import { groonabackend } from '@/api/groonabackend';
import { useQuery } from '@tanstack/react-query';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => groonabackend.auth.me(),
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });

  const effectiveTenantId = user?.is_super_admin && user?.active_tenant_id
    ? user.active_tenant_id
    : user?.tenant_id;

  const { data: tenant } = useQuery({
    queryKey: ['tenant', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;
      // Get fresh tenant data
      const tenants = await groonabackend.entities.Tenant.filter({ _id: effectiveTenantId });
      return tenants[0] || null;
    },
    enabled: !!effectiveTenantId,
    // FIX: Reduced staleTime to 0 to prevent onboarding loop issues.
    // This ensures we always check the latest status when this component mounts/remounts.
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });

  const { data: subscription } = useQuery({
    queryKey: ['tenant-subscription', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;
      const subs = await groonabackend.entities.TenantSubscription.filter({ tenant_id: effectiveTenantId });
      return subs[0] || null;
    },
    enabled: !!effectiveTenantId,
    staleTime: 0,
  });

  const value = {
    user,
    tenant,
    subscription,
    effectiveTenantId,
    isLoading,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
