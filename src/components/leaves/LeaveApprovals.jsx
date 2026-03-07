import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Check, X, User, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LeaveApprovals({ leaves, currentUser, tenantId, isProjectManager = false, otherProjectManagerEmails = [] }) {
  const queryClient = useQueryClient();
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [comment, setComment] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter pending leaves
  // For project managers: show all tenant team members' leaves (excluding other project managers and themselves)
  // For owners/admins: show all pending leaves
  let pendingLeaves = leaves.filter(l => l.status === 'submitted');

  // Additional filter for project managers: ensure they cannot see other project managers' leaves
  if (isProjectManager && currentUser?.custom_role !== 'owner') {
    pendingLeaves = pendingLeaves.filter(leave =>
      leave.user_email !== currentUser?.email && // Exclude project manager's own leaves
      !otherProjectManagerEmails.includes(leave.user_email) // Exclude other project managers' leaves
    );
  }

  // Manual Refresh Handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['all-leaves'] }),
        queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['comp-off-credits'] }),
        queryClient.invalidateQueries({ queryKey: ['all-leave-balances'] })
      ]);
      toast.success("Approvals list refreshed");
    } catch (error) {
      toast.error("Failed to refresh");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Visual delay
    }
  };

  // Approve/Reject mutation
  const actionMutation = useMutation({
    mutationFn: async ({ leave, action, comment }) => {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const currentYear = new Date().getFullYear();

      // 1. Update leave status
      // Store comment in rejection_reason for both approve and reject so it appears in email
      await groonabackend.entities.Leave.update(leave.id, {
        status: newStatus,
        approved_by: currentUser.email,
        approved_at: new Date().toISOString(),
        ...(comment && { rejection_reason: comment }) // Store comment for both approve and reject
      });

      // 2. Create approval record
      await groonabackend.entities.LeaveApproval.create({
        tenant_id: tenantId,
        leave_id: leave.id,
        approver_email: currentUser.email,
        approver_name: currentUser.full_name,
        approver_role: currentUser.role === 'admin' ? 'admin' : 'project_manager',
        status: newStatus === 'approved' ? 'approved' : 'rejected',
        comment: comment,
        acted_at: new Date().toISOString()
      });

      // 3. === COMP OFF CONSUMPTION LOGIC ===
      if (action === 'approve') {
        const leaveTypes = await groonabackend.entities.LeaveType.filter({ id: leave.leave_type_id });
        const leaveType = leaveTypes[0];

        if (leaveType && (leaveType.is_comp_off === true || leaveType.is_comp_off === "true")) {
          const credits = await groonabackend.entities.CompOffCredit.filter({
            tenant_id: tenantId,
            user_id: leave.user_id,
            is_expired: false
          });

          // FIFO Sort
          const sortedCredits = credits.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));

          let daysToDeduct = Number(leave.total_days);

          for (const credit of sortedCredits) {
            if (daysToDeduct <= 0) break;

            const available = Number(credit.remaining_days);

            if (available > 0) {
              const deduction = Math.min(available, daysToDeduct);
              const newUsed = (Number(credit.used_days) || 0) + deduction;
              const newRemaining = available - deduction;

              await groonabackend.entities.CompOffCredit.update(credit.id, {
                used_days: newUsed,
                remaining_days: newRemaining
              });
              daysToDeduct -= deduction;
            }
          }
        }
      }

      // 4. Update Aggregate Leave Balance
      const balances = await groonabackend.entities.LeaveBalance.filter({
        tenant_id: tenantId,
        user_id: leave.user_id,
        leave_type_id: leave.leave_type_id,
        year: currentYear
      });

      if (balances[0]) {
        const balance = balances[0];
        const days = Number(leave.total_days);
        const currentPending = Number(balance.pending) || 0;
        const currentUsed = Number(balance.used) || 0;
        const currentRemaining = Number(balance.remaining) || 0;

        if (action === 'approve') {
          await groonabackend.entities.LeaveBalance.update(balance.id, {
            used: currentUsed + days,
            pending: Math.max(0, currentPending - days)
          });
        } else {
          await groonabackend.entities.LeaveBalance.update(balance.id, {
            pending: Math.max(0, currentPending - days),
            remaining: currentRemaining + days
          });
        }
      }

      // 5. Send email and in-app notification asynchronously after approval/rejection
      // This ensures approval/rejection is not affected by notification failures

      // Note: In-app notification is now handled by the backend trigger on Update

      const statusText = action === 'approve' ? 'Approved' : 'Rejected';
      const templateType = action === 'approve' ? 'leave_approved' : 'leave_cancelled';
      const emailData = {
        memberName: leave.user_name || leave.user_email,
        memberEmail: leave.user_email,
        leaveType: leave.leave_type_name,
        startDate: leave.start_date,
        endDate: leave.end_date,
        duration: leave.duration,
        totalDays: leave.total_days,
        approvedBy: action === 'approve' ? currentUser.full_name : undefined,
        cancelledBy: action === 'reject' ? currentUser.full_name : undefined,
        reason: action === 'reject' ? (comment || 'No reason provided') : undefined,
        description: comment || (action === 'approve' ? 'Your leave has been approved.' : undefined)
      };

      // Fire and forget - send email asynchronously
      setTimeout(async () => {
        try {
          // Email notification using template
          await groonabackend.email.sendTemplate({
            to: leave.user_email,
            templateType,
            data: emailData
          });
        } catch (notifError) {
          console.error('[LeaveApprovals] Failed to send email:', notifError);
        }
      }, 0);
    },
    onSuccess: (_, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['all-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['team-leaves-calendar'] }); // Invalidate TeamCalendar (matches pattern)
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['comp-off-credits'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['my-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });

      // Dispatch event for immediate real-time update
      if (variables.action === 'approve') {
        window.dispatchEvent(new CustomEvent('leave-approved', { detail: { leave: variables.leave } }));
      }
      window.dispatchEvent(new CustomEvent('leave-updated', { detail: { leave: variables.leave } }));

      toast.success(`Leave ${variables.action === 'approve' ? 'approved' : 'rejected'} successfully`);
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Action failed: ' + error.message);
    },
  });

  const handleAction = (leave, action) => {
    setSelectedLeave(leave);
    setActionType(action);
    setComment('');
  };

  const handleCloseDialog = () => {
    setSelectedLeave(null);
    setActionType(null);
    setComment('');
  };

  const handleConfirmAction = () => {
    if (actionType === 'reject' && !comment.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    actionMutation.mutate({
      leave: selectedLeave,
      action: actionType,
      comment: comment
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-[18px] font-black text-slate-800 tracking-tight">Pending Approvals</h3>
            <p className="text-[12px] text-slate-400 font-medium">Review and respond to team leave requests</p>
          </div>
          {pendingLeaves.length > 0 && (
            <div className="bg-blue-100 text-blue-700 font-black text-[10px] h-6 px-3 rounded-full flex items-center justify-center border border-blue-200 shadow-sm animate-pulse m-0">
              {pendingLeaves.length} NEW
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 rounded-full text-[12px] font-black uppercase tracking-widest shadow-sm transition-all text-blue-500 hover:text-blue-700 hover:bg-blue-50/50 border-blue-100"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {pendingLeaves.length === 0 ? (
        <Card className="text-center p-12 bg-white border-blue-50 shadow-sm rounded-[12px]">
          <Calendar className="h-10 w-10 mx-auto text-blue-100 mb-4" />
          <p className="text-[13px] font-medium text-slate-500">No pending leave approvals</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pendingLeaves.map((leave) => (
            <Card key={leave.id} className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
              <CardHeader className="pb-4 px-6 pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-400 font-black text-[12px] shadow-sm transform group-hover:scale-105 transition-transform uppercase">
                          {leave.user_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h3 className="text-[15px] font-black text-slate-800 tracking-tight leading-none">{leave.user_name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Requested Access</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-100 rounded-full text-[9px] px-2 py-0.5 border font-black uppercase tracking-widest shadow-none">PENDING</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="bg-blue-600 text-white rounded-full text-[9px] px-2.5 py-0.5 border-none font-black uppercase tracking-widest shadow-none">
                        {leave.leave_type_name}
                      </Badge>
                      <div className="flex items-center gap-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        <span className="flex items-center gap-1.5 bg-blue-50/30 px-2 py-1 rounded-[8px] border border-blue-50/50">
                          <Calendar className="h-3 w-3 text-blue-400" />
                          {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                        </span>
                        <span className="flex items-center gap-1.5 bg-blue-50/30 px-2 py-1 rounded-[8px] border border-blue-50/50">
                          <span className="text-blue-700">{leave.total_days} DAYS</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pb-6 pt-0">
                {leave.reason && (
                  <div className="p-4 bg-blue-50/20 rounded-[12px] border border-blue-50/50 shadow-inner">
                    <p className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest mb-1.5">Member's Reason</p>
                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic">"{leave.reason}"</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => handleAction(leave, 'approve')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-[12px] h-11 font-black shadow-lg shadow-blue-100 transition-all text-[12px] uppercase tracking-widest border-b-2 border-blue-800 active:border-b-0 active:translate-y-[1px]"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleAction(leave, 'reject')}
                    variant="outline"
                    className="flex-1 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 border-blue-100 rounded-[12px] h-11 font-black transition-all text-[12px] uppercase tracking-widest"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!selectedLeave} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-[420px] border-none rounded-[24px] p-0 shadow-2xl overflow-hidden bg-white">
          <DialogHeader className="px-8 py-8 border-b border-slate-50">
            <DialogTitle className="text-[18px] font-black text-slate-800 tracking-tight">
              {actionType === 'approve' ? 'Confirm Approval' : 'Decline Request'}
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-8">
            {selectedLeave && (
              <div className="p-5 bg-slate-50/80 rounded-[20px] border border-slate-100/50 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-black text-slate-900 tracking-tight leading-none">{selectedLeave.user_name}</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-widest leading-none">
                    {selectedLeave.leave_type_name} • {selectedLeave.total_days} DAYS
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 font-black text-[14px]">
                  {selectedLeave.user_name?.charAt(0) || 'U'}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {actionType === 'reject' ? 'Rejection Reason *' : 'Internal Note (Optional)'}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={actionType === 'reject' ? 'Tell the member why this request was declined...' : 'Add any additional notes for the record...'}
                rows={4}
                className="bg-slate-50 border-none rounded-[16px] shadow-inner text-[14px] font-medium focus:ring-2 focus:ring-slate-100 transition-all resize-none p-5 text-slate-700 placeholder:text-slate-300"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleCloseDialog}
                className="flex-1 h-12 rounded-[16px] font-black text-[13px] uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                Go Back
              </Button>
              <Button
                onClick={handleConfirmAction}
                disabled={actionMutation.isPending}
                className={`flex-1 h-12 rounded-[16px] font-black text-[13px] uppercase tracking-widest shadow-xl transition-all shadow-slate-200 ${actionType === 'approve' ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              >
                {actionMutation.isPending ? 'Working...' : `Confirm ${actionType === 'approve' ? 'Approve' : 'Reject'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

