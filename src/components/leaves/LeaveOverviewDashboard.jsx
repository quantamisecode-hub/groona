import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle, Users, TrendingUp, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useHasPermission } from "../shared/usePermissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LeaveOverviewDashboard({ currentUser, tenantId, onApplyLeave }) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currentMonth = new Date();
  const isAdmin = useHasPermission('can_manage_team') || currentUser?.role === 'admin' || currentUser?.is_super_admin;
  const isProjectManager = currentUser?.custom_role === 'project_manager';
  // Project managers should see their balance info (not full admin view)
  const showBalanceInfo = !isAdmin || isProjectManager;

  // Fetch all users to get profile pictures
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  // Fetch my leaves
  const { data: myLeaves = [] } = useQuery({
    queryKey: ['my-leaves-overview', currentUser?.email],
    queryFn: () => groonabackend.entities.Leave.filter({
      user_email: currentUser.email
    }),
    enabled: !!currentUser,
  });

  // Fetch ALL leaves for Tenant (if Admin) or just Approved (if Employee)
  const { data: allTenantLeaves = [] } = useQuery({
    queryKey: ['all-tenant-leaves', tenantId],
    queryFn: () => groonabackend.entities.Leave.filter({
      tenant_id: tenantId
    }),
    enabled: !!tenantId && isAdmin,
  });

  // Fetch approved leaves for team visibility (available to everyone)
  const { data: teamLeaves = [] } = useQuery({
    queryKey: ['team-leaves-overview', tenantId],
    queryFn: () => groonabackend.entities.Leave.filter({
      tenant_id: tenantId,
      status: 'approved'
    }),
    enabled: !!tenantId,
  });

  // Fetch my balances
  const { data: balances = [] } = useQuery({
    queryKey: ['my-balances-overview', currentUser?.id],
    queryFn: () => groonabackend.entities.LeaveBalance.filter({
      tenant_id: tenantId,
      user_id: currentUser.id,
      year: new Date().getFullYear()
    }),
    enabled: !!currentUser,
  });

  // Calculate stats based on role
  const pendingLeaves = isAdmin 
    ? allTenantLeaves.filter(l => l.status === 'submitted')
    : myLeaves.filter(l => l.status === 'submitted');
  
  const pendingCount = pendingLeaves.length;

  const approvedCount = isAdmin
    ? allTenantLeaves.filter(l => l.status === 'approved').length
    : myLeaves.filter(l => l.status === 'approved').length;

  const totalUsed = balances.reduce((sum, b) => sum + b.used, 0);
  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);

  // Team leaves this month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const teamLeavesThisMonth = teamLeaves.filter(leave => {
    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);
    return isWithinInterval(leaveStart, { start: monthStart, end: monthEnd }) ||
           isWithinInterval(leaveEnd, { start: monthStart, end: monthEnd });
  });

  // Manual Refresh Handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users-list'] }),
        queryClient.invalidateQueries({ queryKey: ['my-leaves-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['all-tenant-leaves'] }),
        queryClient.invalidateQueries({ queryKey: ['team-leaves-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['my-balances-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['comp-off-credits'] })
      ]);
      toast.success("Dashboard refreshed");
    } catch (error) {
      toast.error("Failed to refresh");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Leave Overview</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {isAdmin ? "Total Pending Requests" : "My Pending Requests"}
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
               {isAdmin ? "Total Approved" : "My Approved"}
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{approvedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Leaves approved</p>
          </CardContent>
        </Card>

        {showBalanceInfo && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">My Days Used</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{totalUsed}</div>
              <p className="text-xs text-slate-500 mt-1">Across all leave types</p>
            </CardContent>
          </Card>
        )}

        {showBalanceInfo && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">My Remaining</CardTitle>
              <Calendar className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{totalRemaining}</div>
              <p className="text-xs text-slate-500 mt-1">Available to use</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* My Leave Balance Summary - Hidden for Admin (but shown for Project Managers) */}
      {showBalanceInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              My Leave Balance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No leave balances configured</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {balances.map(balance => (
                  <div key={balance.id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-slate-900">{balance.leave_type_name}</h4>
                      <span className="text-lg font-bold text-green-600">{balance.remaining}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Used: {balance.used}</span>
                      <span>Total: {balance.allocated}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Availability This Month */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Availability - {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamLeavesThisMonth.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-slate-600">Everyone is available this month!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamLeavesThisMonth.map(leave => {
                // Find user to get profile picture
                const user = allUsers.find(u => u.email === leave.user_email);
                
                return (
                  <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      {/* Avatar Logic */}
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {user?.profile_image_url ? (
                          <img 
                            src={user.profile_image_url} 
                            alt={leave.user_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{leave.user_name?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      
                      <div>
                        <p className="font-medium text-slate-900">{leave.user_name}</p>
                        <p className="text-sm text-slate-600">
                          {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700">{leave.leave_type_name}</p>
                      <p className="text-xs text-slate-500">{leave.total_days} days</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Action - Show for non-admins and project managers */}
      {showBalanceInfo && (
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Ready to Take Time Off?</h3>
                <p className="text-blue-100">Apply for leave in just a few clicks</p>
              </div>
              <Button 
                onClick={onApplyLeave}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                Apply Leave
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

