import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function AuditLogFilters({ filters, onFiltersChange, users, tenants, auditLogs, isSuperAdmin }) {
  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    onFiltersChange({
      tenant_id: 'all',
      action: 'all',
      entity_type: 'all',
      user_email: 'all',
      severity: 'all',
      success: 'all',
      dateFrom: null,
      dateTo: null,
    });
  };

  // Get unique values for filters
  const uniqueActions = [...new Set(auditLogs.map(log => log.action))].sort();
  const uniqueEntityTypes = [...new Set(auditLogs.map(log => log.entity_type))].sort();

  const hasActiveFilters = 
    filters.tenant_id !== 'all' ||
    filters.action !== 'all' ||
    filters.entity_type !== 'all' ||
    filters.user_email !== 'all' ||
    filters.severity !== 'all' ||
    filters.success !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Filter Audit Logs</h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-slate-600"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tenant Filter - Only for Super Admin */}
          {isSuperAdmin && tenants && tenants.length > 0 && (
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={filters.tenant_id} onValueChange={(value) => handleFilterChange('tenant_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Action Filter */}
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={filters.action} onValueChange={(value) => handleFilterChange('action', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity Type Filter */}
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={filters.entity_type} onValueChange={(value) => handleFilterChange('entity_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All entity types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entity Types</SelectItem>
                {uniqueEntityTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Filter */}
          <div className="space-y-2">
            <Label>User</Label>
            <Select value={filters.user_email} onValueChange={(value) => handleFilterChange('user_email', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.email}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity Filter */}
          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Success Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.success} onValueChange={(value) => handleFilterChange('success', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="true">Success</SelectItem>
                <SelectItem value="false">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-2">
            <Label>From Date</Label>
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <Label>To Date</Label>
            <Input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-slate-600">Active filters:</span>
              {filters.tenant_id !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('tenant_id', 'all')}
                  className="h-6 text-xs"
                >
                  Tenant: {tenants?.find(t => t.id === filters.tenant_id)?.name || filters.tenant_id}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )}
              {filters.action !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('action', 'all')}
                  className="h-6 text-xs"
                >
                  Action: {filters.action}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )}
              {filters.entity_type !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('entity_type', 'all')}
                  className="h-6 text-xs"
                >
                  Entity: {filters.entity_type}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )}
              {filters.user_email !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('user_email', 'all')}
                  className="h-6 text-xs"
                >
                  User: {users.find(u => u.email === filters.user_email)?.full_name || filters.user_email}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )}
              {filters.severity !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('severity', 'all')}
                  className="h-6 text-xs"
                >
                  Severity: {filters.severity}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )}
              {filters.success !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('success', 'all')}
                  className="h-6 text-xs"
                >
                  Status: {filters.success === 'true' ? 'Success' : 'Failed'}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
