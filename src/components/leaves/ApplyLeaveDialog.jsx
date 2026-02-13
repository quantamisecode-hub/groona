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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply For Leave</DialogTitle>
          <DialogDescription>Submit your leave request for approval</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Leave Type Dropdown - Populated ONLY from User's Balances */}
          <div className="space-y-2">
            <Label>Leave Type *</Label>
            <Select
              value={formData.leave_type_id}
              onValueChange={(val) => setFormData({ ...formData, leave_type_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select leave type..." />
              </SelectTrigger>
              <SelectContent>
                {myBalances.length > 0 ? (
                  myBalances.map(balance => (
                    <SelectItem key={balance.leave_type_id} value={balance.leave_type_id}>
                      {balance.leave_type_name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-slate-500">No leaves allocated to you</div>
                )}
              </SelectContent>
            </Select>
            {selectedBalance && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-600">Allocated</p>
                    <p className="font-semibold text-slate-900">{selectedBalance.allocated}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Used</p>
                    <p className="font-semibold text-slate-900">{selectedBalance.used}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Remaining</p>
                    <p className="font-semibold text-green-600">{selectedBalance.remaining}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {pendingLeaves.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                My Pending Requests ({pendingLeaves.length})
              </Label>
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-3">
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pendingLeaves.map((leave) => (
                      <div key={leave.id || leave._id} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-amber-200">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{leave.leave_type_name || leave.leave_type}</p>
                          <p className="text-xs text-slate-600">
                            {format(parseISO(leave.start_date), 'MMM d')} - {format(parseISO(leave.end_date), 'MMM d')}
                            {leave.duration === 'half_day' && ' (Half Day)'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.start_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.start_date ? format(formData.start_date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={formData.start_date} onSelect={(date) => setFormData({ ...formData, start_date: date })} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>End Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.end_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.end_date ? format(formData.end_date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={formData.end_date} onSelect={(date) => setFormData({ ...formData, end_date: date })} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={formData.duration} onValueChange={(val) => setFormData({ ...formData, duration: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_day">Full Day</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Reason for leave..." rows={3} required />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={applyLeaveMutation.isPending} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={applyLeaveMutation.isPending} className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600">
              {applyLeaveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

