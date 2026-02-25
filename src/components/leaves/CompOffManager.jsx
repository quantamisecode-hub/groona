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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Comp Off Management</CardTitle>
            <div className="flex gap-2">
                {/* ADMIN ONLY SYNC BUTTON */}
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                    <Button 
                        variant="outline" 
                        onClick={handleSyncData} 
                        disabled={isSyncing}
                        title="Fix '0 Used' days by syncing with Leave Balance"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                        {isSyncing ? "Syncing..." : "Sync History"}
                    </Button>
                )}
                <Button
                onClick={() => setShowDialog(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600"
                >
                <Plus className="h-4 w-4 mr-2" />
                Credit Comp Off
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {credits.length === 0 ? (
              <div className="text-center p-12">
                <Gift className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">No comp off credits yet</p>
              </div>
            ) : (
              credits.map((credit, index) => (
                <div
                  key={credit.id || index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                       <div>
                          <h3 className="font-medium text-slate-900">{credit.user_name}</h3>
                          <div className="flex gap-4 mt-1 text-sm text-slate-600">
                            <span className="font-medium text-blue-700">Credited: {credit.credited_days} days</span>
                            
                            {/* FETCHED DIRECTLY FROM DB */}
                            <span className={cn(
                                "font-medium",
                                credit.used_days > 0 ? "text-orange-600" : "text-slate-500"
                            )}>
                                Used: {credit.used_days || 0} days
                            </span>
                            
                            <span className={cn(
                                "font-medium",
                                credit.remaining_days > 0 ? "text-green-600" : "text-slate-400"
                            )}>
                                Remaining: {credit.remaining_days} days
                            </span>
                            
                            <span className="text-xs text-slate-400 mt-0.5 block">
                              Expires: {format(new Date(credit.expires_at), 'MMM dd, yyyy')}
                            </span>
                          </div>
                       </div>
                    </div>
                    {credit.reason && (
                      <p className="text-sm text-slate-500 mt-1">{credit.reason}</p>
                    )}
                  </div>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>User *</Label>
              <select
                value={formData.user_email}
                onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="">Select user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Days To Credit *</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={formData.credited_days}
                onChange={(e) => setFormData({ ...formData, credited_days: parseFloat(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Holiday work, overtime, etc..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Expiry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.expires_at && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.expires_at, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.expires_at}
                    onSelect={(date) => setFormData({ ...formData, expires_at: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creditMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
              >
                {creditMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                    "Credit Comp Off"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

