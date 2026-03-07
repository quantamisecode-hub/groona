import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, AlertCircle, XCircle, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { eventEmitter } from "../shared/eventEmitter";
import ConfirmationDialog from "../shared/ConfirmationDialog";
import { cn } from "@/lib/utils";

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
    draft: "bg-blue-50 text-blue-700 border-blue-100",
    submitted: "bg-blue-100/50 text-blue-700 border-blue-200/60",
    approved: "bg-indigo-100/50 text-indigo-700 border-indigo-200/60 shadow-sm shadow-indigo-100/50",
    rejected: "bg-red-100/50 text-red-700 border-red-200/60",
    cancelled: "bg-slate-100/50 text-slate-600 border-slate-200/60"
  };

  if (leaves.length === 0) {
    return (
      <Card className="text-center p-12 border-blue-50 bg-white">
        <Calendar className="h-12 w-12 mx-auto text-blue-100 mb-4" />
        <p className="text-slate-600">No leave requests found</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {leaves.map((leave) => (
        <Card key={leave.id} className="bg-white border-none shadow-sm hover:shadow-md transition-all rounded-[16px] overflow-hidden group">
          <CardHeader className="pb-4 px-6 pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[15px] font-black text-slate-800 tracking-tight">{leave.leave_type_name}</h3>
                  <Badge className={cn("rounded-full text-[9px] px-2 py-0.5 border font-black uppercase tracking-widest shadow-none", statusColors[leave.status])}>
                    {leave.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 bg-blue-50/50 px-2 py-1 rounded-[8px] border border-blue-50/50">
                    <Calendar className="h-3.5 w-3.5 text-blue-400" />
                    {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd, yyyy')}
                  </span>
                  <span className="flex items-center gap-1.5 bg-blue-50/50 px-2 py-1 rounded-[8px] border border-blue-50/50">
                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-blue-700 font-black">{leave.total_days}</span> {leave.total_days === 1 ? 'DAY' : 'DAYS'}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 pt-0">
            {leave.reason && (
              <div className="p-3.5 bg-blue-50/20 rounded-[12px] border border-blue-50/50 shadow-inner">
                <p className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest mb-1.5">Employee Reason</p>
                <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic">"{leave.reason}"</p>
              </div>
            )}

            {leave.status === 'approved' && leave.approved_by && (
              <div className="text-[11px] font-black text-blue-700 flex items-center gap-2 bg-blue-50/50 px-3 py-1.5 rounded-[10px] border border-blue-100/50 uppercase tracking-widest">
                <CheckCircle className="h-3.5 w-3.5" /> Approved by {leave.approved_by}
              </div>
            )}

            {leave.status === 'rejected' && (
              <div className="text-[11px] text-red-600 bg-red-50/50 p-3.5 rounded-[12px] border border-red-100/50">
                <div className="flex items-center gap-1.5 mb-1.5 font-black uppercase tracking-widest">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Management Response
                </div>
                {leave.rejection_reason && (
                  <p className="text-red-700 font-medium text-[13px]">"{leave.rejection_reason}"</p>
                )}
              </div>
            )}

            {leave.status === 'cancelled' && (
              <div className="text-[11px] text-slate-500 bg-slate-50/50 p-3.5 rounded-[12px] border border-slate-200/50">
                <div className="flex items-center gap-1.5 mb-1.5 font-black uppercase tracking-widest">
                  <XCircle className="h-3.5 w-3.5" />
                  Request Cancelled
                </div>
                {leave.rejection_reason && (
                  <p className="text-slate-600 font-medium text-[13px]">"{leave.rejection_reason}"</p>
                )}
              </div>
            )}

            {/* Cancel button for submitted or approved leaves */}
            {showActions && (leave.status === 'submitted' || leave.status === 'approved') && (
              <div className="pt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelLeave(leave)}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[10px] h-9 px-4 text-[12px] font-black uppercase tracking-widest transition-all"
                >
                  <XCircle className="h-3.5 w-3.5 mr-2" />
                  Cancel Request
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

