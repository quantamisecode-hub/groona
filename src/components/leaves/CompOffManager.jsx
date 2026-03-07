import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalendarIcon, Gift, Loader2, RefreshCw } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CompOffManager({ currentUser, tenantId }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formData, setFormData] = useState({
    user_email: '',
    credited_days: 1,
    reason: '',
    expires_at: addDays(new Date(), 90)
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => groonabackend.entities.User.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  // Fetch comp off credits directly from DB
  const { data: credits = [] } = useQuery({
    queryKey: ['comp-off-credits', tenantId],
    queryFn: async () => {
      if (!groonabackend.entities.CompOffCredit) return [];
      return groonabackend.entities.CompOffCredit.filter({ tenant_id: tenantId }, '-created_date');
    },
    enabled: !!tenantId,
  });

  // Credit mutation
  const creditMutation = useMutation({
    mutationFn: async (data) => {
      const user = users.find(u => u.email === data.user_email);
      if (!user) throw new Error("Selected user not found in the system.");

      // Ensure "Comp Off" Leave Type exists
      let compOffType = null;
      const existingTypes = await groonabackend.entities.LeaveType.filter({
        tenant_id: tenantId,
        is_comp_off: true
      });

      if (existingTypes.length > 0) {
        compOffType = existingTypes[0];
      } else {
        compOffType = await groonabackend.entities.LeaveType.create({
          tenant_id: tenantId,
          name: "Compensatory Off",
          description: "Leave granted for working on holidays or weekends",
          is_paid: true,
          is_comp_off: true,
          requires_approval: true,
          color: "bg-purple-100 text-purple-800",
          annual_allowance: 0,
          carry_forward: false
        });
      }

      // Create Credit Record in DB (Init with 0 used)
      await groonabackend.entities.CompOffCredit.create({
        tenant_id: tenantId,
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        credited_days: data.credited_days,
        used_days: 0,
        remaining_days: data.credited_days,
        reason: data.reason,
        credited_by: currentUser.email,
        expires_at: format(data.expires_at, 'yyyy-MM-dd'),
        is_expired: false
      });

      // Update Aggregate Leave Balance
      const currentYear = new Date().getFullYear();
      const balances = await groonabackend.entities.LeaveBalance.filter({
        tenant_id: tenantId,
        user_id: user.id,
        leave_type_id: compOffType.id,
        year: currentYear
      });

      if (balances.length > 0) {
        await groonabackend.entities.LeaveBalance.update(balances[0].id, {
          allocated: (Number(balances[0].allocated) || 0) + data.credited_days,
          remaining: (Number(balances[0].remaining) || 0) + data.credited_days
        });
      } else {
        await groonabackend.entities.LeaveBalance.create({
          tenant_id: tenantId,
          user_id: user.id,
          user_email: user.email,
          leave_type_id: compOffType.id,
          leave_type_name: compOffType.name,
          year: currentYear,
          allocated: data.credited_days,
          used: 0,
          pending: 0,
          remaining: data.credited_days
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-off-credits'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Comp Off credited successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  // === NEW: SYNC FUNCTION TO FIX OLD DATA ===
  const handleSyncData = async () => {
    try {
      setIsSyncing(true);
      toast.info("Syncing credit history with leave balances...");

      // 1. Fetch all balances for Comp Off
      const balances = await groonabackend.entities.LeaveBalance.filter({
        tenant_id: tenantId,
        leave_type_name: "Compensatory Off" // Assuming name match or fetch by is_comp_off logic if needed
      });

      // 2. Fetch all credits
      const allCredits = await groonabackend.entities.CompOffCredit.filter({ tenant_id: tenantId });

      let updatedCount = 0;

      // 3. Loop through users and reconcile
      for (const balance of balances) {
        const userCredits = allCredits
          .filter(c => c.user_id === balance.user_id)
          .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at)); // Oldest first

        let totalUsedFromBalance = Number(balance.used) || 0;

        for (const credit of userCredits) {
          const originalAmount = Number(credit.credited_days);
          let newUsed = 0;

          if (totalUsedFromBalance > 0) {
            if (totalUsedFromBalance >= originalAmount) {
              newUsed = originalAmount;
              totalUsedFromBalance -= originalAmount;
            } else {
              newUsed = totalUsedFromBalance;
              totalUsedFromBalance = 0;
            }
          }

          const newRemaining = originalAmount - newUsed;

          // Only update if changed
          if (Number(credit.used_days) !== newUsed) {
            await groonabackend.entities.CompOffCredit.update(credit.id, {
              used_days: newUsed,
              remaining_days: newRemaining
            });
            updatedCount++;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['comp-off-credits'] });
      toast.success(`Sync Complete. Updated ${updatedCount} records.`);
    } catch (error) {
      console.error("Sync failed", error);
      toast.error("Sync failed: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    setFormData({
      user_email: '',
      credited_days: 1,
      reason: '',
      expires_at: addDays(new Date(), 90)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.user_email) {
      toast.error("Please select a user");
      return;
    }
    creditMutation.mutate(formData);
  };

  return (
    <>
      <Card className="bg-white border-none shadow-sm rounded-[16px] overflow-hidden">
        <CardHeader className="border-b border-slate-50 px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <CardTitle className="text-[17px] font-black text-slate-800 tracking-tight">Comp Off Management</CardTitle>
              <p className="text-[12px] text-slate-400 mt-1 font-medium">Issue and track compensatory time off credits for overtime work.</p>
            </div>
            <div className="flex items-center gap-3">
              {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                <Button
                  variant="outline"
                  onClick={handleSyncData}
                  disabled={isSyncing}
                  className="h-10 px-6 rounded-[12px] text-[12px] font-black uppercase tracking-widest shadow-sm transition-all text-slate-500 hover:text-slate-900 border-slate-200/60"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isSyncing && "animate-spin")} />
                  Sync
                </Button>
              )}
              <Button
                onClick={() => setShowDialog(true)}
                className="h-10 px-6 rounded-[12px] text-[12px] font-black uppercase tracking-widest shadow-lg shadow-slate-100 transition-all bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Issue Credit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid gap-4 lg:grid-cols-2">
            {credits.length === 0 ? (
              <div className="lg:col-span-2 text-center py-16 bg-slate-50/50 rounded-[16px] border border-dashed border-slate-200">
                <Gift className="h-12 w-12 mx-auto text-slate-200 mb-4" />
                <p className="text-[14px] font-black text-slate-800 tracking-tight">No credits issued yet</p>
                <p className="text-[12px] text-slate-400 font-medium mt-1">Reward your team for their extra effort.</p>
              </div>
            ) : (
              credits.map((credit, index) => (
                <div
                  key={credit.id || index}
                  className="group p-5 border border-slate-100 rounded-[16px] hover:shadow-md transition-all bg-white shadow-sm flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 text-[12px] font-black shadow-none group-hover:scale-105 transition-transform uppercase">
                        {credit.user_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h3 className="text-[14px] font-black text-slate-800 tracking-tight leading-none">{credit.user_name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          EXP: {format(new Date(credit.expires_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 text-[9px] border-none rounded-full font-black uppercase tracking-widest shadow-none px-2.5">
                      ACTIVE
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50/80 rounded-[12px] p-3 text-center border border-slate-100/50">
                      <p className="text-[20px] font-black text-slate-900 leading-none mb-1 tracking-tighter">{credit.credited_days}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Issued</p>
                    </div>
                    <div className="bg-amber-50/50 rounded-[12px] p-3 text-center border border-amber-100/50">
                      <p className="text-[20px] font-black text-amber-600 leading-none mb-1 tracking-tighter">{credit.used_days || 0}</p>
                      <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Consumed</p>
                    </div>
                    <div className="bg-emerald-50/50 rounded-[12px] p-3 text-center border border-emerald-100/50">
                      <p className="text-[20px] font-black text-emerald-600 leading-none mb-1 tracking-tighter">{credit.remaining_days}</p>
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Balance</p>
                    </div>
                  </div>

                  {credit.reason && (
                    <div className="px-1 pt-1 border-t border-slate-50">
                      <p className="text-[12px] text-slate-500 font-medium leading-relaxed italic">“{credit.reason}”</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* FIXED: onOpenChange uses handleClose correctly now */}
      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Credit Comp Off</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Team Member *</Label>
              <select
                value={formData.user_email}
                onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                className="w-full h-11 bg-white border border-slate-200/80 rounded-[10px] shadow-sm text-[13px] font-medium focus:ring-1 focus:ring-slate-300 transition-all px-4 appearance-none"
                required
              >
                <option value="">Select individual...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Days to Credit *</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={formData.credited_days}
                onChange={(e) => setFormData({ ...formData, credited_days: parseFloat(e.target.value) || 1 })}
                required
                className="h-11 bg-white border-slate-200/80 rounded-[10px] shadow-sm text-[13px] font-medium focus:ring-1 focus:ring-slate-300 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Reason for Credit *</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g. Worked over the weekend for project launch..."
                rows={3}
                required
                className="bg-white border-slate-200/80 rounded-[10px] shadow-sm text-[13px] font-medium focus:ring-1 focus:ring-slate-300 transition-all resize-none p-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Expiry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-left font-medium text-[13px] rounded-[10px] border-slate-200 bg-white hover:bg-slate-50 transition-all",
                      !formData.expires_at && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2.5 h-4 w-4 text-slate-400" />
                    {formData.expires_at ? format(formData.expires_at, "PPP") : "Select expiry..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.expires_at}
                    onSelect={(date) => setFormData({ ...formData, expires_at: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-3 pt-6">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creditMutation.isPending}
                className="flex-1 h-11 rounded-[10px] font-bold text-[13px] shadow-sm transition-all bg-slate-900 hover:bg-slate-800 text-white"
              >
                {creditMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Issuing...</>
                ) : (
                  "Issue Credit"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

