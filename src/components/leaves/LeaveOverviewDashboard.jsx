import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle, Users, TrendingUp, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-[18px] font-black text-slate-800 tracking-tight">Leave Overview</h2>
          <p className="text-[12px] text-slate-400 font-medium">Snapshot of your team availability and balances</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 rounded-[10px] text-[12px] font-bold shadow-sm transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/60"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className={cn("grid gap-4 md:grid-cols-2", showBalanceInfo ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
        <Card className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 transition-transform group-hover:scale-110">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pending</span>
            </div>
            <div className="text-[32px] font-black text-slate-900 leading-tight tracking-tight">{pendingCount}</div>
            <p className="text-[12px] font-medium text-slate-400 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 transition-transform group-hover:scale-110">
                <CheckCircle className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Approved</span>
            </div>
            <div className="text-[32px] font-black text-slate-900 leading-tight tracking-tight">{approvedCount}</div>
            <p className="text-[12px] font-medium text-slate-400 mt-1">Successfully granted</p>
          </CardContent>
        </Card>

        {showBalanceInfo && (
          <Card className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 transition-transform group-hover:scale-110">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Days Used</span>
              </div>
              <div className="text-[32px] font-black text-slate-900 leading-tight tracking-tight">{totalUsed}</div>
              <p className="text-[12px] font-medium text-slate-400 mt-1">Current year usage</p>
            </CardContent>
          </Card>
        )}

        {showBalanceInfo && (
          <Card className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 transition-transform group-hover:scale-110">
                  <Calendar className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Remaining</span>
              </div>
              <div className="text-[32px] font-black text-slate-900 leading-tight tracking-tight">{totalRemaining}</div>
              <p className="text-[12px] font-medium text-slate-400 mt-1">Available to use</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className={cn("grid gap-6", showBalanceInfo ? "lg:grid-cols-2" : "grid-cols-1")}>
        {/* My Leave Balance Summary */}
        {showBalanceInfo && (
          <Card className="bg-white border-none shadow-sm rounded-[16px]">
            <CardHeader className="px-6 py-6 border-b border-blue-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[15px] font-black text-slate-800 tracking-tight">
                  My Balances
                </CardTitle>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time status</p>
              </div>
              <Calendar className="h-4 w-4 text-blue-300" />
            </CardHeader>
            <CardContent className="p-6">
              {balances.length === 0 ? (
                <div className="text-center py-10 bg-blue-50/20 rounded-[12px] border border-dashed border-blue-100">
                  <p className="text-[13px] font-medium text-slate-400">No balances configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {balances.map(balance => (
                    <div key={balance.id} className="p-4 border border-blue-50 rounded-[12px] hover:border-blue-200 transition-all bg-white group shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-black text-[13px] text-slate-800">{balance.leave_type_name}</h4>
                        <div className="bg-blue-600 text-white font-black px-2.5 py-0.5 rounded-full text-[10px] tracking-tight">
                          {balance.remaining} LEFT
                        </div>
                      </div>
                      <div className="w-full bg-blue-50 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.3)]"
                          style={{ width: `${(balance.used / balance.allocated) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3 pt-3 border-t border-blue-50/50">
                        <span>Used: <span className="text-blue-700 font-bold">{balance.used}</span></span>
                        <span>Total Cap: <span className="text-slate-900">{balance.allocated}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team Availability This Month */}
        <Card className="bg-white border-none shadow-sm rounded-[16px]">
          <CardHeader className="px-6 py-6 border-b border-blue-50/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[15px] font-black text-slate-800 tracking-tight">
                Team Presence
              </CardTitle>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{format(currentMonth, 'MMMM yyyy')}</p>
            </div>
            <Users className="h-4 w-4 text-blue-300" />
          </CardHeader>
          <CardContent className="p-6">
            {teamLeavesThisMonth.length === 0 ? (
              <div className="text-center py-12 bg-blue-50/30 rounded-[12px] border border-dashed border-blue-100">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-3">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="text-[14px] font-black text-blue-900 tracking-tight">Full Availability!</p>
                <p className="text-[12px] text-blue-600/70 font-medium mt-1">No one is scheduled for leave this month.</p>
              </div>
            ) : (
              <div className={cn("space-y-3", !showBalanceInfo && "grid md:grid-cols-2 2xl:grid-cols-3 gap-4 space-y-0")}>
                {teamLeavesThisMonth.map(leave => {
                  const user = allUsers.find(u => u.email === leave.user_email);
                  return (
                    <div key={leave.id} className="flex items-center justify-between p-4 border border-blue-50 rounded-[12px] hover:bg-blue-50/30 transition-all bg-white shadow-sm hover:border-blue-200">
                      <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-[12px] flex-shrink-0">
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
                          <p className="font-black text-[13px] text-slate-900 tracking-tight leading-none">{leave.user_name}</p>
                          <p className="text-[11px] font-bold text-blue-500 mt-1 uppercase tracking-widest">
                            {format(new Date(leave.start_date), 'MMM dd')} &mdash; {format(new Date(leave.end_date), 'MMM dd')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-blue-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest px-2 shadow-sm border-none">
                          {leave.leave_type_name}
                        </Badge>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">{leave.total_days} DAYS</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Card */}
      {showBalanceInfo && (
        <Card className="bg-blue-900 text-white border-none shadow-2xl rounded-[20px] overflow-hidden relative group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] z-0"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-950 z-0"></div>
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md transform group-hover:rotate-6 transition-transform border border-white/10">
                  <Calendar className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-[20px] font-black tracking-tight text-white mb-1">Time for a Break?</h3>
                  <p className="text-blue-100/70 text-[13px] font-medium max-w-sm">Planning your next vacation or need some personal time? Apply for leave instantly.</p>
                </div>
              </div>
              <Button
                onClick={onApplyLeave}
                className="bg-white text-blue-900 hover:bg-blue-50 rounded-[12px] h-12 px-8 font-black shadow-xl transition-all text-[14px] flex-shrink-0 active:scale-95 border-b-2 border-slate-200"
              >
                Apply for Leave
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

