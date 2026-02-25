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
    <div className="space-y-4">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-slate-900">Approvals</h3>
          {pendingLeaves.length > 0 && (
            <Badge className="bg-orange-500 text-white">
              {pendingLeaves.length}
            </Badge>
          )}
        </div>
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

      {pendingLeaves.length === 0 ? (
        <Card className="text-center p-12">
          <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600">No pending leave approvals</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingLeaves.map((leave) => (
            <Card key={leave.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {leave.user_name}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                      <Badge className="bg-blue-100 text-blue-800">
                        {leave.leave_type_name}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                      </span>
                      <span>{leave.total_days} days</span>
                    </div>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">PENDING</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {leave.reason && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Reason:</p>
                    <p className="text-sm text-slate-600">{leave.reason}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAction(leave, 'approve')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleAction(leave, 'reject')}
                    variant="destructive"
                    className="flex-1"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedLeave && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium">{selectedLeave.user_name}</p>
                <p className="text-sm text-slate-600">
                  {selectedLeave.leave_type_name} • {selectedLeave.total_days} days
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {actionType === 'reject' ? 'Rejection Reason *' : 'Comment (Optional)'}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={actionType === 'reject' ? 'Please provide a reason...' : 'Add a comment...'}
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAction}
                disabled={actionMutation.isPending}
                className={`flex-1 ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

