/**
 * Tenant Configuration Resolver
 * 
 * Provides configuration-driven feature behavior and terminology mapping
 * based on tenant settings without conditional business logic.
 */

const DEFAULT_CONFIGS = {
  SOFTWARE: {
    enable_sprints: true,
    default_workflow: "AGILE",
    require_task_approval: false,
    terminology_map: {
      SPRINT: "Sprint",
      TASK: "Task",
      MILESTONE: "Milestone",
      BACKLOG: "Backlog",
      PROJECT: "Project",
      TEAM: "Team",
      STORY_POINTS: "Story Points",
      VELOCITY: "Velocity",
      BURNDOWN: "Burndown"
    }
  },
  MARKETING: {
    enable_sprints: false,
    default_workflow: "CAMPAIGN",
    require_task_approval: true,
    terminology_map: {
      SPRINT: "Campaign",
      TASK: "Content",
      MILESTONE: "Phase",
      BACKLOG: "Content Pipeline",
      PROJECT: "Campaign",
      TEAM: "Agency Team",
      STORY_POINTS: "Effort Points",
      VELOCITY: "Campaign Progress",
      BURNDOWN: "Campaign Timeline"
    }
  }
};

class TenantConfigResolver {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get tenant configuration
   * @param {Object} tenant - Tenant object
   * @returns {Object} Resolved configuration
   */
  getConfig(tenant) {
    if (!tenant) {
      return DEFAULT_CONFIGS.SOFTWARE;
    }

    const cacheKey = tenant.id;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const companyType = tenant.company_type || "SOFTWARE";
    const defaultConfig = DEFAULT_CONFIGS[companyType] || DEFAULT_CONFIGS.SOFTWARE;

    // Merge tenant-specific config with defaults
    const config = {
      ...defaultConfig,
      ...(tenant.tenant_config || {})
    };

    // Ensure terminology_map exists
    if (!config.terminology_map) {
      config.terminology_map = defaultConfig.terminology_map;
    } else {
      // Merge custom terminology with defaults
      config.terminology_map = {
        ...defaultConfig.terminology_map,
        ...config.terminology_map
      };
    }

    this.cache.set(cacheKey, config);
    return config;
  }

  /**
   * Get translated term for UI display
   * @param {Object} tenant - Tenant object
   * @param {string} term - Term key (e.g., "SPRINT", "TASK")
   * @returns {string} Translated term
   */
  getTerm(tenant, term) {
    const config = this.getConfig(tenant);
    return config.terminology_map[term] || term;
  }

  /**
   * Check if feature is enabled
   * @param {Object} tenant - Tenant object
   * @param {string} feature - Feature key (e.g., "enable_sprints")
   * @returns {boolean}
   */
  isFeatureEnabled(tenant, feature) {
    const config = this.getConfig(tenant);
    return config[feature] !== false;
  }

  /**
   * Clear cache for a tenant (useful after tenant update)
   * @param {string} tenantId 
   */
  clearCache(tenantId) {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get approval policy for a module
   * @param {Object} tenant - Tenant object
   * @param {string} module - Module name (e.g., "timesheet", "task")
   * @returns {Array<string>} List of roles required for approval
   */
  getApprovalPolicy(tenant, module) {
    const config = this.getConfig(tenant);
    
    // Default policies
    const policies = {
      timesheet: ["PROJECT_MANAGER", "ADMIN"],
      task: config.require_task_approval ? ["PROJECT_MANAGER"] : [],
      ticket: ["ADMIN"]
    };

    // Override with tenant-specific policies if available
    if (config.approval_policies && config.approval_policies[module]) {
      return config.approval_policies[module];
    }

    return policies[module] || [];
  }

  /**
   * Get default project templates for tenant
   * @param {Object} tenant 
   * @returns {Array<string>} Template categories
   */
  getDefaultTemplates(tenant) {
    const companyType = tenant?.company_type || "SOFTWARE";
    
    if (companyType === "MARKETING") {
      return ["social_media_campaign", "seo_campaign", "paid_ads_campaign", "product_launch"];
    }
    
    return ["agile_scrum", "kanban", "waterfall"];
  }
}

// Export singleton instance
export const tenantConfig = new TenantConfigResolver();

// React hook for easy usage in components
export function useTenantConfig(tenant) {
  const config = tenantConfig.getConfig(tenant);
  
  return {
    config,
    getTerm: (term) => tenantConfig.getTerm(tenant, term),
    isFeatureEnabled: (feature) => tenantConfig.isFeatureEnabled(tenant, feature),
    getApprovalPolicy: (module) => tenantConfig.getApprovalPolicy(tenant, module)
  };
}

export default tenantConfig;