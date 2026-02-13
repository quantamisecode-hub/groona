import { useState, useEffect, useMemo } from 'react';
import { groonabackend } from '@/api/groonabackend';
import { useQuery } from '@tanstack/react-query';
import { useUser } from './UserContext';

// Permission mapping from resource/action to specific permission keys
const permissionMap = {
  projects: {
    create: 'can_create_project',
    read: 'can_view_all_projects',
    update: 'can_edit_project',
    delete: 'can_delete_project',
  },
  templates: {
    view: 'can_view_templates',
    manage: 'can_manage_templates',
  },
  tasks: {
    create: 'can_create_task',
    read: 'can_view_all_projects',
    update: 'can_edit_task',
    delete: 'can_delete_task',
    assign: 'can_assign_task',
  },
  tickets: {
    create: 'can_create_ticket',
    read: 'can_view_tickets',
    read_own: 'can_view_own_tickets',
    update: 'can_update_ticket',
    assign: 'can_assign_ticket',
    delete: 'can_delete_ticket',
  },
  workspaces: {
    create: 'can_create_workspace',
    read: 'can_view_workspace',
    update: 'can_edit_workspace',
    delete: 'can_delete_workspace',
    manage_members: 'can_manage_workspace_members',
  },
  timesheets: {
    create: 'can_create_timesheet',
    read: 'can_view_all_projects',
    update: 'can_edit_timesheet',
    delete: 'can_delete_timesheet',
    approve: 'can_approve_timesheet',
  },
  team: {
    view: 'can_view_team',
    manage: 'can_manage_team',
  },
  users: {
    invite: 'can_invite_user',
    edit: 'can_edit_user',
    delete: 'can_delete_user',
  },
  groups: {
    manage: 'can_manage_groups',
  },
  reports: {
    view: 'can_view_reports',
    export: 'can_export_reports',
  },
  insights: {
    view: 'can_view_insights',
  },
  automation: {
    view: 'can_view_automation',
    manage: 'can_manage_automation',
  },
  ai: {
    use: 'can_use_ai_assistant',
  },
  financials: {
    view: 'can_view_project_financials',
    manage: 'can_manage_project_financials',
  },
  expenses: {
    create: 'can_manage_project_expenses',
    read: 'can_manage_project_expenses',
    update: 'can_manage_project_expenses',
    delete: 'can_manage_project_expenses',
    approve: 'can_manage_project_expenses',
  },
  budget: {
    set: 'can_set_project_budget',
    view: 'can_view_project_financials',
  },
};

// Map permission keys to tenant feature flags.
// If the tenant implies "OFF" here, no user can have it unless explicitly overridden.
const permissionToFeatureMap = {
  'can_use_ai_assistant': 'ai_assistant',
  'can_view_insights': 'advanced_analytics',
  'can_view_reports': 'advanced_analytics',
  'can_export_reports': 'advanced_analytics',
  'can_use_collaboration': 'ai_assistant',
  'can_view_team': 'team_management',
  'can_manage_team': 'team_management',
  'can_view_automation': 'automation',
  'can_manage_automation': 'automation',
};

/**
 * Custom hook to check if user has a specific permission
 */
export function useHasPermission(permissionKey, context = null) {
  const { user: currentUser, tenant } = useUser();

  const { data: groups = [] } = useQuery({
    queryKey: ['user-groups'],
    queryFn: () => groonabackend.entities.UserGroup.list(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['group-memberships', currentUser?.email],
    queryFn: () => groonabackend.entities.UserGroupMembership.filter({
      user_email: currentUser?.email
    }),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.email],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_email: currentUser?.email
    }),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // --- NEW: Fetch Explicit User Permissions from DB ---
  const { data: userPermissionRecord } = useQuery({
    queryKey: ['user-permissions-record', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      // Fetch specifically from the UserPermission model we just created
      const records = await groonabackend.entities.UserPermission.filter({ user_id: currentUser.id });
      return records?.[0] || null;
    },
    enabled: !!currentUser?.id,
    // Keep it fresh so sidebar updates immediately after changes
    staleTime: 10 * 1000,
  });

  if (!currentUser) return false;

  // 1. Super Admin: Always True
  if (currentUser.is_super_admin) return true;

  // 2. Tenant Feature Gate (Hardware Switch)
  // If the tenant explicitly has a feature TURNED OFF (false), 
  // we generally block it. However, if you want specific user overrides to even 
  // bypass tenant flags, you would move step #3 above this one.
  // For now, we assume if the Company doesn't have "Team" features, nobody gets them.
  if (tenant && permissionToFeatureMap[permissionKey]) {
    const featureKey = permissionToFeatureMap[permissionKey];
    const isFeatureEnabled = tenant.features_enabled?.[featureKey];

    // If explicitly false, block it. 
    // (If undefined, we allow it to pass through to check user permissions)
    if (isFeatureEnabled === false) return false;
  }

  // 3. EXPLICIT DB OVERRIDE (This handles your Sidebar Request)
  // This checks the new UserPermission model.
  // If a value exists (true or false), it OVERRIDES everything below (Groups, Roles, Defaults).
  if (userPermissionRecord && userPermissionRecord.permissions) {
    const explicitValue = userPermissionRecord.permissions[permissionKey];

    // If explicitly set to true in DB -> SHOW IT
    if (explicitValue === true) return true;

    // If explicitly set to false in DB -> HIDE IT
    if (explicitValue === false) return false;
  }

  // 4. Admin Role: Always True (but project managers are restricted from certain actions)
  // Owners have role='admin' and custom_role='owner' - they get full access
  // Project managers have role='admin' and custom_role='project_manager' - they can only view, not manage
  if (currentUser.role === 'admin') {
    // Project managers cannot: invite users/clients, edit/delete users, manage permissions, create/edit/delete workspaces, manage workspace members
    const restrictedPermissions = [
      'can_invite_user',
      'can_edit_user',
      'can_delete_user',
      'can_manage_permissions',
      'can_create_workspace',
      'can_edit_workspace',
      'can_delete_workspace',
      'can_manage_workspace_members'
    ];
    if (currentUser.custom_role === 'project_manager' && restrictedPermissions.includes(permissionKey)) {
      return false; // Restrict project managers from these actions
    }
    return true; // Other admin permissions are allowed
  }

  // 5. Legacy User Permissions Field (Backwards compatibility)
  if (currentUser.permissions?.[permissionKey] === true) return true;

  // 6. Group Permissions
  const userGroupIds = memberships.map(m => m.group_id);
  const userGroups = groups.filter(g => userGroupIds.includes(g.id) && g.is_active);

  const checkGroups = (groupsToCheck) => {
    for (const [resource, actions] of Object.entries(permissionMap)) {
      for (const [action, key] of Object.entries(actions)) {
        if (key === permissionKey) {
          for (const group of groupsToCheck) {
            if (group.permissions?.[resource]?.[action] === true) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  if (checkGroups(userGroups)) return true;

  // 7. Project Manager Context
  if (context?.project) {
    const pmRole = projectRoles.find(r =>
      r.project_id === context.project.id &&
      r.role === 'project_manager'
    );

    if (pmRole && pmRole.permissions) {
      if (permissionKey === 'can_view_templates') return true;
    }
  }

  // 8. STRICT DEFAULTS
  // If nothing above granted access, we fall back to these defaults.
  const defaultPermissions = {
    // Allowed by default
    can_create_task: true,
    can_view_all_projects: true,
    can_create_timesheet: true,
    can_view_workspace: true,
    can_create_ticket: true,
    can_view_own_tickets: true,

    // BLOCKED by default (Requires Explicit Permission)
    can_view_team: false,
    can_use_ai_assistant: false,
    can_view_automation: false,
    can_view_templates: false,
    can_manage_templates: false,
    can_view_project_financials: false,
    can_manage_project_financials: false,
  };

  return defaultPermissions[permissionKey] || false;
}

export function usePermissions(resource, action) {
  const permissionKey = permissionMap[resource]?.[action];
  return useHasPermission(permissionKey);
}

export function useAllPermissions() {
  const { user: currentUser } = useUser();
  return {};
}

export function getAllPermissionDefinitions() {
  return [
    { key: 'can_create_project', label: 'Create Projects', category: 'Projects' },
    { key: 'can_edit_project', label: 'Edit Projects', category: 'Projects' },
    { key: 'can_delete_project', label: 'Delete Projects', category: 'Projects' },
    { key: 'can_view_all_projects', label: 'View All Projects', category: 'Projects' },

    { key: 'can_view_templates', label: 'View Templates', category: 'Projects' },
    { key: 'can_manage_templates', label: 'Manage Templates', category: 'Projects' },

    { key: 'can_create_workspace', label: 'Create Workspaces', category: 'Workspaces' },
    { key: 'can_view_workspace', label: 'View Workspaces', category: 'Workspaces' },
    { key: 'can_edit_workspace', label: 'Edit Workspaces', category: 'Workspaces' },
    { key: 'can_delete_workspace', label: 'Delete Workspaces', category: 'Workspaces' },
    { key: 'can_manage_workspace_members', label: 'Manage Workspace Members', category: 'Workspaces' },

    { key: 'can_create_task', label: 'Create Tasks', category: 'Tasks' },
    { key: 'can_edit_task', label: 'Edit Tasks', category: 'Tasks' },
    { key: 'can_delete_task', label: 'Delete Tasks', category: 'Tasks' },
    { key: 'can_assign_task', label: 'Assign Tasks', category: 'Tasks' },

    { key: 'can_create_timesheet', label: 'Log Time', category: 'Timesheets' },
    { key: 'can_edit_timesheet', label: 'Edit Timesheets', category: 'Timesheets' },
    { key: 'can_delete_timesheet', label: 'Delete Timesheets', category: 'Timesheets' },
    { key: 'can_approve_timesheet', label: 'Approve Timesheets', category: 'Timesheets' },

    { key: 'can_view_team', label: 'View Team & Resources', category: 'Team' },
    { key: 'can_manage_team', label: 'Manage Team', category: 'Team' },

    { key: 'can_invite_user', label: 'Invite Users', category: 'User Management' },
    { key: 'can_edit_user', label: 'Edit Users', category: 'User Management' },
    { key: 'can_delete_user', label: 'Delete Users', category: 'User Management' },
    { key: 'can_manage_groups', label: 'Manage User Groups', category: 'User Management' },

    { key: 'can_view_reports', label: 'View Reports', category: 'Reports & Analytics' },
    { key: 'can_export_reports', label: 'Export Reports', category: 'Reports & Analytics' },
    { key: 'can_view_insights', label: 'View AI Insights', category: 'Reports & Analytics' },

    { key: 'can_view_automation', label: 'View Automation', category: 'Automation' },
    { key: 'can_manage_automation', label: 'Manage Automation', category: 'Automation' },

    { key: 'can_use_ai_assistant', label: 'Use AI Assistant', category: 'AI Features' },
    { key: 'can_use_collaboration', label: 'Use Collaboration Features', category: 'Collaboration' },

    { key: 'can_create_ticket', label: 'Create Support Tickets', category: 'Support' },
    { key: 'can_view_tickets', label: 'View All Tickets', category: 'Support' },
    { key: 'can_view_own_tickets', label: 'View Own Tickets', category: 'Support' },
    { key: 'can_update_ticket', label: 'Update Tickets', category: 'Support' },
    { key: 'can_assign_ticket', label: 'Assign Tickets', category: 'Support' },
    { key: 'can_delete_ticket', label: 'Delete Tickets', category: 'Support' },

    { key: 'can_view_project_financials', label: 'View Project Financials', category: 'Financials' },
    { key: 'can_manage_project_financials', label: 'Manage Project Financials', category: 'Financials' },
    { key: 'can_set_project_budget', label: 'Set Project Budget', category: 'Budget' },
    { key: 'can_manage_project_expenses', label: 'Manage Project Expenses', category: 'Budget' },
  ];
}
