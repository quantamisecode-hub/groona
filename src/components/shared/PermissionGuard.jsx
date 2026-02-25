import React from 'react';
import { useHasPermission } from './usePermissions';
import { Shield } from 'lucide-react';

/**
 * Component that conditionally renders children based on permission
 * @param {string} permission - The permission key to check (e.g., 'can_create_project')
 * @param {object} context - Optional context object (e.g., { project: projectData }) for checking local permissions
 * @param {React.ReactNode} children - Content to render if permission is granted
 * @param {React.ReactNode} fallback - Optional content to render if permission is denied
 */
export function PermissionGuard({ permission, context = null, children, fallback = null }) {
  const hasPermission = useHasPermission(permission, context);

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Component that shows access denied message
 */
export function AccessDenied({ message = "You don't have permission to access this feature" }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
      <Shield className="h-16 w-16 text-slate-300 mb-4" />
      <h3 className="font-semibold text-slate-900 mb-2">Access Denied</h3>
      <p className="text-slate-600 text-center">{message}</p>
    </div>
  );
}

/**
 * Hook to check multiple permissions at once
 * @param {string[]} permissions - Array of permission keys
 * @param {boolean} requireAll - If true, requires all permissions. If false, requires at least one
 */
export function useHasAnyPermission(permissions, requireAll = false) {
  const permissionResults = permissions.map(perm => useHasPermission(perm));
  
  if (requireAll) {
    return permissionResults.every(result => result === true);
  }
  
  return permissionResults.some(result => result === true);
}

export default PermissionGuard;