import React from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Building2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function CrossTenantInsights() {
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants-insights'],
    queryFn: () => groonabackend.entities.Tenant.list(),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects-insights'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  const { data: allSprints = [] } = useQuery({
    queryKey: ['all-sprints-insights'],
    queryFn: () => groonabackend.entities.Sprint.list(),
  });

  const { data: allTimesheets = [] } = useQuery({
    queryKey: ['all-timesheets-insights'],
    queryFn: () => groonabackend.entities.Timesheet.list(),
  });

  const softwareCount = tenants.filter(t => t.company_type === 'SOFTWARE').length;
  const marketingCount = tenants.filter(t => t.company_type === 'MARKETING').length;
  const totalTenants = tenants.length;

  const tenantsUsingSprints = tenants.filter(t => 
    t.tenant_config?.enable_sprints !== false
  ).length;
  
  const tenantsUsingTimesheets = tenants.filter(t => {
    const tenantTimesheets = allTimesheets.filter(ts => ts.tenant_id === t.id);
    return tenantTimesheets.length > 0;
  }).length;

  const tenantsUsingApprovals = tenants.filter(t => 
    t.tenant_config?.require_task_approval === true
  ).length;

  const metrics = [
    {
      label: 'Software Companies',
      value: softwareCount,
      total: totalTenants,
      color: 'bg-blue-500',
      icon: Building2
    },
    {
      label: 'Marketing Agencies',
      value: marketingCount,
      total: totalTenants,
      color: 'bg-purple-500',
      icon: Building2
    },
    {
      label: 'Using Sprints',
      value: tenantsUsingSprints,
      total: totalTenants,
      color: 'bg-green-500',
      icon: TrendingUp
    },
    {
      label: 'Using Timesheets',
      value: tenantsUsingTimesheets,
      total: totalTenants,
      color: 'bg-amber-500',
      icon: BarChart3
    },
    {
      label: 'Using Approvals',
      value: tenantsUsingApprovals,
      total: totalTenants,
      color: 'bg-red-500',
      icon: Users
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Cross-Tenant Insights (Read-Only)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {metrics.map((metric, idx) => {
            const percentage = metric.total > 0 ? (metric.value / metric.total) * 100 : 0;
            const Icon = metric.icon;
            
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-600" />
                    <span className="font-medium text-slate-900">{metric.label}</span>
                  </div>
                  <span className="text-sm text-slate-600">
                    {metric.value} / {metric.total} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" indicatorClassName={metric.color} />
              </div>
            );
          })}

          <div className="pt-4 border-t">
            <p className="text-xs text-slate-500">
              📊 Aggregated analytics only. No access to tenant business data or IP.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

