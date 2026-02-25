import { groonabackend } from "@/api/groonabackend";

/**
 * Helper function to create audit log entries
 * Call this from your mutation handlers to automatically log actions
 * 
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - Action performed (create, update, delete, etc.)
 * @param {string} params.entity_type - Type of entity (user, project, task, etc.)
 * @param {string} params.entity_id - ID of the entity
 * @param {string} params.entity_name - Name of the entity
 * @param {Object} params.user - Current user object
 * @param {Object} params.changes - Before/after changes (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @param {string} params.severity - Severity level (optional, defaults to 'low')
 * @param {boolean} params.success - Whether action succeeded (optional, defaults to true)
 * @param {string} params.error_message - Error message if failed (optional)
 * @param {string} params.description - Human-readable description (optional)
 */
export async function createAuditLog({
  action,
  entity_type,
  entity_id,
  entity_name,
  user,
  changes = null,
  metadata = null,
  severity = 'low',
  success = true,
  error_message = null,
  description = null,
}) {
  try {
    // Only create audit logs for tenants (not super admin platform actions)
    if (!user?.tenant_id) {
      return;
    }

    const auditData = {
      tenant_id: user.tenant_id,
      action,
      entity_type,
      entity_id,
      entity_name,
      user_email: user.email,
      user_name: user.full_name,
      user_role: user.role,
      severity,
      success,
      description: description || `${action} ${entity_type}: ${entity_name}`,
    };

    if (changes) {
      auditData.changes = changes;
    }

    if (metadata) {
      auditData.metadata = metadata;
    }

    if (error_message) {
      auditData.error_message = error_message;
    }

    // Capture IP address and user agent if available
    if (typeof window !== 'undefined') {
      auditData.user_agent = window.navigator.userAgent;
    }

    await groonabackend.entities.AuditLog.create(auditData);
  } catch (error) {
    // Silently fail - we don't want audit logging to break the app
    console.error('[AuditLog] Failed to create audit log:', error);
  }
}

/**
 * Helper to determine severity based on action and entity type
 */
export function getSeverityForAction(action, entity_type) {
  // Critical actions
  if (action === 'delete' && ['user', 'tenant', 'project'].includes(entity_type)) {
    return 'critical';
  }
  
  if (action === 'permission_change' || action === 'role_change') {
    return 'high';
  }

  // High severity actions
  if (action === 'delete' || action === 'archive') {
    return 'high';
  }

  // Medium severity actions
  if (action === 'update' || action === 'status_change') {
    return 'medium';
  }

  // Low severity actions (create, login, etc.)
  return 'low';
}

/**
 * Example usage in a mutation:
 * 
 * const updateProjectMutation = useMutation({
 *   mutationFn: async ({ id, data }) => {
 *     const oldProject = await groonabackend.entities.Project.filter({ id });
 *     const updated = await groonabackend.entities.Project.update(id, data);
 *     
 *     // Create audit log
 *     await createAuditLog({
 *       action: 'update',
 *       entity_type: 'project',
 *       entity_id: id,
 *       entity_name: updated.name,
 *       user: currentUser,
 *       changes: {
 *         before: oldProject[0],
 *         after: updated
 *       },
 *       severity: getSeverityForAction('update', 'project'),
 *       description: `Updated project ${updated.name}`
 *     });
 *     
 *     return updated;
 *   }
 * });
 */

