import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { eventEmitter } from "../shared/eventEmitter";
import ConfirmationDialog from "../shared/ConfirmationDialog";

export default function LeavesList({ leaves, currentUser, showActions }) {
  const queryClient = useQueryClient();
  const [cancellingLeave, setCancellingLeave] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Cancel leave mutation
  const cancelLeaveMutation = useMutation({
    mutationFn: async ({ leave, reason }) => {
      // Update leave status (use rejection_reason field as per model definition)
      await groonabackend.entities.Leave.update(leave.id, {
        status: 'cancelled',
        rejection_reason: reason
      });

      // Restore balance
      const balances = await groonabackend.entities.LeaveBalance.filter({
        tenant_id: leave.tenant_id,
        user_id: leave.user_id,
        leave_type_id: leave.leave_type_id
      });

      if (balances[0]) {
        const balance = balances[0];
        if (leave.status === 'approved') {
          // Return from used to remaining
          await groonabackend.entities.LeaveBalance.update(balance.id, {
            used: Math.max(0, balance.used - leave.total_days),
            remaining: balance.remaining + leave.total_days
          });
        } else if (leave.status === 'submitted') {
          // Return from pending to remaining
          await groonabackend.entities.LeaveBalance.update(balance.id, {
            pending: Math.max(0, balance.pending - leave.total_days),
            remaining: balance.remaining + leave.total_days
          });
        }
      }

      // Create audit log
      await groonabackend.entities.Activity.create({
        tenant_id: leave.tenant_id,
        action: 'cancelled',
        entity_type: 'leave',
        entity_id: leave.id,
        entity_name: `Leave request cancelled`,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        details: `Leave request for ${leave.leave_type_name} (${leave.total_days} days) starting ${leave.start_date} was successfully Modified/Cancelled in the system. Reason: ${reason}`
      });

      // Send notifications
      await eventEmitter.leaveCancelled({
        leave,
        cancelledBy: { email: currentUser.email, name: currentUser.full_name },
        reason,
        tenantId: leave.tenant_id
      });

      return leave;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['all-leaves'] });
      toast.success('Leave request cancelled successfully');
      handleCloseCancelDialog();
    },
    onError: (error) => {
      toast.error('Failed to cancel leave: ' + error.message);
    }
  });

  const handleCancelLeave = (leave) => {
    setCancellingLeave(leave);
    setCancellationReason('');
  };

  const handleCloseCancelDialog = () => {
    setCancellingLeave(null);
    setCancellationReason('');
  };

  const handleConfirmCancel = () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    cancelLeaveMutation.mutate({ leave: cancellingLeave, reason: cancellationReason });
  };
  const statusColors = {
    draft: "bg-gray-100 text-gray-800",
    submitted: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    cancelled: "bg-slate-100 text-slate-800"
  };

  if (leaves.length === 0) {
    return (
      <Card className="text-center p-12">
        <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600">No leave requests found</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {leaves.map((leave) => (
        <Card key={leave.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {leave.leave_type_name}
                  <Badge className={statusColors[leave.status]}>
                    {leave.status.toUpperCase()}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {leave.reason && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Reason:</p>
                <p className="text-sm text-slate-600">{leave.reason}</p>
              </div>
            )}

            {leave.status === 'approved' && leave.approved_by && (
              <div className="text-sm text-green-600 flex items-center gap-1">
                ✓ Approved by {leave.approved_by}
              </div>
            )}

            {leave.status === 'rejected' && (
              <div className="text-sm text-red-600">
                <div className="flex items-center gap-1 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  Rejected
                </div>
                {leave.rejection_reason && (
                  <p className="text-red-600">{leave.rejection_reason}</p>
                )}
              </div>
            )}

            {leave.status === 'cancelled' && (
              <div className="text-sm text-slate-600">
                <div className="flex items-center gap-1 mb-1">
                  <XCircle className="h-4 w-4" />
                  Cancelled
                </div>
                {leave.cancelled_reason && (
                  <p className="text-slate-600">{leave.cancelled_reason}</p>
                )}
              </div>
            )}

            {/* Cancel button for submitted or approved leaves */}
            {showActions && (leave.status === 'submitted' || leave.status === 'approved') && (
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelLeave(leave)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Leave Request
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Cancel Confirmation Dialog */}
      {cancellingLeave && (
        <Dialog open={true} onOpenChange={handleCloseCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Provide Cancellation Reason</DialogTitle>
              <DialogDescription>
                Please explain why you're cancelling this leave request
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium">{cancellingLeave.leave_type_name}</p>
                <p className="text-sm text-slate-600">
                  {format(new Date(cancellingLeave.start_date), 'MMM dd')} - {format(new Date(cancellingLeave.end_date), 'MMM dd, yyyy')}
                </p>
                <p className="text-sm text-slate-600">{cancellingLeave.total_days} days</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Cancellation *</label>
                <Textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please provide a reason for cancelling this leave..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCloseCancelDialog}
                  className="flex-1"
                  disabled={cancelLeaveMutation.isPending}
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleConfirmCancel}
                  disabled={cancelLeaveMutation.isPending || !cancellationReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {cancelLeaveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Submit Cancellation'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

