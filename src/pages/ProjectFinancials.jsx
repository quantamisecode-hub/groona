import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHasPermission } from "@/components/shared/usePermissions";
import PermissionGuard from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Activity } from "lucide-react";
import FinancialsTable from "@/components/financials/FinancialsTable";
import UpdateFinancialsDialog from "@/components/financials/UpdateFinancialsDialog";
import { toast } from "sonner";
import { useUser } from "@/components/shared/UserContext";

export default function ProjectFinancials() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser, effectiveTenantId } = useUser();

  const canManageFinancials = useHasPermission('can_manage_project_financials');
  
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects-financials', effectiveTenantId],
    queryFn: async () => {
        if (!effectiveTenantId) return [];
        return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!effectiveTenantId,
  });

  const updateProjectMutation = useMutation({
    mutationFn: (projectData) => groonabackend.entities.Project.update(projectData.id, projectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-financials'] });
      toast.success("Project financials updated successfully");
      setIsUpdateDialogOpen(false);
      setSelectedProject(null);
    },
    onError: (error) => {
      toast.error("Failed to update financials", {
        description: error.message
      });
    }
  });

  const handleEdit = (project) => {
    if (!canManageFinancials) {
      toast.error("You don't have permission to edit financials");
      return;
    }
    setSelectedProject(project);
    setIsUpdateDialogOpen(true);
  };

  // Calculate summary stats
  const stats = React.useMemo(() => {
    return projects.reduce((acc, curr) => {
      acc.totalRevenue += (curr.actual_revenue || 0);
      acc.totalCost += (curr.actual_cost || 0);
      acc.totalBudget += (curr.budget || 0);
      acc.projectCount += 1;
      return acc;
    }, { totalRevenue: 0, totalCost: 0, totalBudget: 0, projectCount: 0 });
  }, [projects]);

  const totalProfit = stats.totalRevenue - stats.totalCost;
  const profitMargin = stats.totalRevenue ? (totalProfit / stats.totalRevenue) * 100 : 0;

  return (
    <PermissionGuard permissionKey="can_view_project_financials" fallback={
        <div className="p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-800">Access Restricted</h2>
            <p className="text-slate-600 mt-2">You do not have permission to view project financials.</p>
        </div>
    }>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Project Financials</h1>
            <p className="text-slate-600">Track revenue, costs, and profitability across all projects.</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Actual revenue collected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCost.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Actual costs incurred</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              {totalProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${totalProfit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Revenue - Costs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profitMargin.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Average across projects</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <FinancialsTable 
            projects={projects} 
            onEdit={handleEdit}
          />
        )}

        <UpdateFinancialsDialog
          open={isUpdateDialogOpen}
          onClose={() => {
            setIsUpdateDialogOpen(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onSubmit={(data) => updateProjectMutation.mutate(data)}
          loading={updateProjectMutation.isPending}
        />
      </div>
    </PermissionGuard>
  );
}

