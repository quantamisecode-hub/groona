import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Loader2, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ApplyLeaveDialog({ open, onClose, currentUser, tenantId }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: null,
    end_date: null,
    duration: 'full_day',
    reason: ''
  });
  const [error, setError] = useState('');

  // 1. Fetch ONLY the user's balances (Requirement: "show the leave types which... allocated to that particular member")
  const { data: myBalances = [] } = useQuery({
    queryKey: ['leave-balances', currentUser?.id, tenantId],
    queryFn: () => groonabackend.entities.LeaveBalance.filter({
      tenant_id: tenantId,
      user_id: currentUser.id,
      year: new Date().getFullYear()
    }),
    enabled: !!currentUser && !!tenantId && open,
    refetchInterval: 5000, // Real-time updates every 5 seconds
  });

  // Fetch pending leave requests
  const { data: pendingLeaves = [], refetch: refetchPendingLeaves } = useQuery({
    queryKey: ['my-pending-leaves', currentUser?.id, tenantId],
    queryFn: () => groonabackend.entities.Leave.filter({
      tenant_id: tenantId,
      user_id: currentUser.id,
      status: 'submitted'
    }),
    enabled: !!currentUser && !!tenantId && open,
    refetchInterval: 3000, // Real-time updates every 3 seconds
  });

  // Listen for leave application events to refetch immediately
  React.useEffect(() => {
    const handleLeaveApplied = () => {
      refetchPendingLeaves();
    };

    window.addEventListener('leave-applied', handleLeaveApplied);

    return () => {
      window.removeEventListener('leave-applied', handleLeaveApplied);
    };
  }, [refetchPendingLeaves]);

  const applyLeaveMutation = useMutation({
    mutationFn: async (data) => {
      const days = differenceInDays(new Date(data.end_date), new Date(data.start_date)) + 1;
      const totalDays = data.duration === 'half_day' ? 0.5 : days;

      // Validate against the specific balance record
      const balance = myBalances.find(b => b.leave_type_id === data.leave_type_id);

      if (!balance) {
        throw new Error("Invalid leave type selection.");
      }

      if (balance.remaining < totalDays) {
        throw new Error(`Insufficient leave balance. Available: ${balance.remaining} days`);
      }

      const leave = await groonabackend.entities.Leave.create({
        tenant_id: tenantId,
        user_id: currentUser.id,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        leave_type_id: data.leave_type_id,
        leave_type_name: balance.leave_type_name, // Use name from balance
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        end_date: format(data.end_date, 'yyyy-MM-dd'),
        duration: data.duration,
        total_days: totalDays,
        reason: data.reason,
        status: 'submitted',
        applied_at: new Date().toISOString()
      });

      // Update Balance: Enforce "Encumbrance" immediately
      await groonabackend.entities.LeaveBalance.update(balance.id, {
        pending: balance.pending + totalDays,
        remaining: balance.remaining - totalDays
      });

      // Create Activity log for new leave application
      await groonabackend.entities.Activity.create({
        tenant_id: tenantId,
        action: 'created',
        entity_type: 'leave',
        entity_id: leave.id,
        entity_name: `New Leave Application - ${balance.leave_type_name}`,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        details: `Member ${currentUser.full_name} applied for ${totalDays} days of ${balance.leave_type_name} from ${format(data.start_date, 'yyyy-MM-dd')} to ${format(data.end_date, 'yyyy-MM-dd')}.`
      });

      // Send email acknowledgment asynchronously after leave application
      // This ensures leave application is not affected by email failures
      const emailData = {
        memberName: currentUser.full_name,
        memberEmail: currentUser.email,
        leaveType: balance.leave_type_name,
        startDate: format(data.start_date, 'yyyy-MM-dd'),
        endDate: format(data.end_date, 'yyyy-MM-dd'),
        duration: data.duration,
        totalDays: totalDays,
        reason: data.reason || 'Not specified'
      };

      // Fire and forget - send email asynchronously
      setTimeout(async () => {
        try {
          await groonabackend.email.sendTemplate({
            to: currentUser.email,
            templateType: 'leave_submitted',
            data: emailData
          });
        } catch (emailError) {
          console.error('[ApplyLeaveDialog] Failed to send acknowledgment email:', emailError);
          // Email failure does not affect leave application
        }
      }, 0);

      return leave;
    },
    onSuccess: () => {
      // Immediately invalidate and refetch pending leaves
      queryClient.invalidateQueries({ queryKey: ['my-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['all-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['team-leaves-calendar'] });

      // Dispatch event for real-time updates
      window.dispatchEvent(new CustomEvent('leave-applied', { detail: { timestamp: Date.now() } }));

      toast.success('Leave application submitted successfully');
      handleClose();
    },
    onError: (error) => {
      setError(error.message || 'Failed to apply leave');
    },
  });

  const handleClose = () => {
    setFormData({ leave_type_id: '', start_date: null, end_date: null, duration: 'full_day', reason: '' });
    setError('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.leave_type_id) { setError('Please select a leave type'); return; }
    if (!formData.start_date || !formData.end_date) { setError('Please select leave dates'); return; }
    if (formData.start_date > formData.end_date) { setError('End date must be after start date'); return; }
    applyLeaveMutation.mutate(formData);
  };

  const selectedBalance = myBalances.find(b => b.leave_type_id === formData.leave_type_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[440px] border-none rounded-[16px] p-0 shadow-2xl overflow-hidden bg-white">
        <DialogHeader className="px-6 py-6 border-b border-slate-100 flex flex-row items-center gap-4 space-y-0">
          <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-[17px] font-black text-slate-800 tracking-tight leading-none">Apply for Leave</DialogTitle>
            <DialogDescription className="text-[13px] font-medium text-slate-400 mt-1.5 line-clamp-1">Submit your request for team review.</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-[10px] text-[12px] font-bold text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Leave Type Selector */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Type of Leave</Label>
              <Select
                value={formData.leave_type_id}
                onValueChange={(val) => setFormData({ ...formData, leave_type_id: val })}
              >
                <SelectTrigger className="h-11 bg-slate-50 border-slate-200/60 rounded-[10px] text-[13px] font-bold shadow-none focus:bg-white transition-all">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="rounded-[10px] border-slate-200">
                  {myBalances.length > 0 ? (
                    myBalances.map(balance => (
                      <SelectItem key={balance.leave_type_id} value={balance.leave_type_id} className="text-[13px] font-medium">
                        {balance.leave_type_name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">No Leave Allocated</p>
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedBalance && (
              <div className="p-4 bg-slate-50/50 rounded-[12px] border border-slate-100 flex items-center justify-between shadow-inner">
                <div className="text-center flex-1 border-r border-slate-200/60 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allocated</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-1">{selectedBalance.allocated}</p>
                </div>
                <div className="text-center flex-1 border-r border-slate-200/60 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Used</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-1">{selectedBalance.used}</p>
                </div>
                <div className="text-center flex-1 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                  <p className="text-[15px] font-black text-emerald-600 mt-1">{selectedBalance.remaining}</p>
                </div>
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {pendingLeaves.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                <Clock className="h-3 w-3" />
                My Pending Requests ({pendingLeaves.length})
              </Label>
              <Card className="border-amber-200 bg-amber-50/50 rounded-[12px] shadow-inner">
                <CardContent className="p-3">
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pendingLeaves.map((leave) => (
                      <div key={leave.id || leave._id} className="flex items-center justify-between text-sm p-2 bg-white rounded-[8px] border border-amber-200 shadow-sm">
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 text-[13px]">{leave.leave_type_name || leave.leave_type}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {format(parseISO(leave.start_date), 'MMM d')} - {format(parseISO(leave.end_date), 'MMM d')}
                            {leave.duration === 'half_day' && ' (Half Day)'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-100 border-amber-200 px-2 py-0.5 rounded-full">
                          Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-11 w-full justify-start text-[13px] font-bold bg-slate-50/50 border-slate-100 rounded-[10px] shadow-sm hover:bg-white transition-all", !formData.start_date && "text-slate-400 font-medium")}>
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                    {formData.start_date ? format(formData.start_date, "MMM d, yyyy") : "Pick start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none rounded-[16px] shadow-2xl overflow-hidden" align="start">
                  <Calendar mode="single" selected={formData.start_date} onSelect={(date) => setFormData({ ...formData, start_date: date })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-11 w-full justify-start text-[13px] font-bold bg-slate-50/50 border-slate-100 rounded-[10px] shadow-sm hover:bg-white transition-all", !formData.end_date && "text-slate-400 font-medium")}>
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                    {formData.end_date ? format(formData.end_date, "MMM d, yyyy") : "Pick end"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none rounded-[16px] shadow-2xl overflow-hidden" align="start">
                  <Calendar mode="single" selected={formData.end_date} onSelect={(date) => setFormData({ ...formData, end_date: date })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Duration</Label>
            <div className="flex bg-slate-50 p-1 rounded-[10px] border border-slate-200/60 shadow-inner">
              <Button
                type="button"
                variant="ghost"
                className={cn("flex-1 h-9 rounded-[8px] text-[12px] font-bold transition-all", formData.duration === 'full_day' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:bg-white/50")}
                onClick={() => setFormData({ ...formData, duration: 'full_day' })}
              >
                Full Day
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn("flex-1 h-9 rounded-[8px] text-[12px] font-bold transition-all", formData.duration === 'half_day' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:bg-white/50")}
                onClick={() => setFormData({ ...formData, duration: 'half_day' })}
              >
                Half Day
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Reason for Leave</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Briefly explain your leave request..."
              className="min-h-[100px] bg-slate-50 border-slate-200/60 rounded-[12px] text-[13px] font-medium p-4 focus:bg-white transition-all leading-relaxed resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={handleClose} disabled={applyLeaveMutation.isPending} className="flex-1 h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</Button>
            <Button
              type="submit"
              disabled={applyLeaveMutation.isPending}
              className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-[10px] font-black text-[13px] shadow-lg shadow-slate-200"
            >
              {applyLeaveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Submit Application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

