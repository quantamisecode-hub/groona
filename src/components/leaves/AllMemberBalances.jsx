import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Edit, Trash2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AllMemberBalances({ tenantId }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());

  // State for Edit/Delete actions
  const [editingBalance, setEditingBalance] = useState(null);
  const [deletingBalance, setDeletingBalance] = useState(null);
  const [editAllocatedDays, setEditAllocatedDays] = useState("");

  // 1. Fetch All Balances
  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['all-leave-balances', tenantId, year],
    queryFn: () => groonabackend.entities.LeaveBalance.filter({
      tenant_id: tenantId,
      year: parseInt(year)
    }),
    enabled: !!tenantId
  });

  // 2. Fetch Users
  const { data: users = [] } = useQuery({
    queryKey: ['users-list', tenantId],
    queryFn: () => groonabackend.entities.User.filter({ tenant_id: tenantId }),
    enabled: !!tenantId
  });

  // --- MUTATIONS ---

  const updateBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!editingBalance) return;

      const newAllocated = parseFloat(editAllocatedDays);
      if (isNaN(newAllocated)) throw new Error("Invalid allocation value");

      // Recalculate Remaining
      const newRemaining = newAllocated + (editingBalance.carried_over || 0) - (editingBalance.used || 0) - (editingBalance.pending || 0);

      return await groonabackend.entities.LeaveBalance.update(editingBalance.id, {
        allocated: newAllocated,
        remaining: newRemaining
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success("Balance updated successfully");
      setEditingBalance(null);
    },
    onError: (err) => {
      toast.error("Failed to update: " + err.message);
    }
  });

  const deleteBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!deletingBalance) return;
      return await groonabackend.entities.LeaveBalance.delete(deletingBalance.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success("Leave balance record deleted");
      setDeletingBalance(null);
    },
    onError: (err) => {
      toast.error("Failed to delete: " + err.message);
    }
  });

  // --- HANDLERS ---

  const openEditDialog = (balance) => {
    setEditingBalance(balance);
    setEditAllocatedDays(balance.allocated.toString());
  };

  const getUserName = (userId, email) => {
    const user = users.find(u => u.id === userId);
    return user ? user.full_name : email;
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  };

  // Filter & Sort
  const filteredBalances = balances.filter(b =>
    b.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.leave_type_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getUserName(b.user_id, "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  filteredBalances.sort((a, b) => {
    const nameA = getUserName(a.user_id, a.user_email);
    const nameB = getUserName(b.user_id, b.user_email);
    return nameA.localeCompare(nameB);
  });

  return (
    <>
      <Card className="bg-white border-none shadow-sm rounded-[16px] overflow-hidden">
        <CardHeader className="border-b border-slate-50 px-8 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <CardTitle className="text-[17px] font-black text-slate-800 tracking-tight">Team Leave Balances</CardTitle>
              <p className="text-[12px] text-slate-400 mt-1 font-medium">
                Manage individual allocations for {year}. Changes reflect across systems.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search teammate or leave type..."
                  className="pl-10 h-10 bg-slate-50 border-none rounded-[12px] text-[13px] font-medium shadow-none focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all text-slate-700"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-10 w-[110px] bg-slate-50 border-none rounded-[12px] text-[12px] font-black uppercase tracking-widest shadow-none focus:ring-2 focus:ring-slate-100 transition-all text-slate-600">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="rounded-[16px] border-slate-100 shadow-xl p-1">
                  <SelectItem value="2024" className="text-[12px] font-bold rounded-[8px]">2024</SelectItem>
                  <SelectItem value="2025" className="text-[12px] font-bold rounded-[8px]">2025</SelectItem>
                  <SelectItem value="2026" className="text-[12px] font-bold rounded-[8px]">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-slate-100/60 hover:bg-transparent">
                  <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Profile</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Allowance</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Used</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Pending</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Net Balance</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[180px]">Consumption</TableHead>
                  <TableHead className="text-right px-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                        <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Hydrating data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredBalances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-8 w-8 text-slate-100 mb-2" />
                        <span className="text-[14px] font-black text-slate-800 tracking-tight">No results found</span>
                        <span className="text-[12px] font-medium text-slate-400">Try adjusting your search criteria.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBalances.map((balance) => {
                    const name = getUserName(balance.user_id, balance.user_email);
                    const totalAvailable = balance.allocated + (balance.carried_over || 0);
                    const utilization = totalAvailable > 0
                      ? Math.round(((balance.used || 0) / totalAvailable) * 100)
                      : 0;

                    return (
                      <TableRow key={balance.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                        <TableCell className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 text-[11px] font-black shadow-sm group-hover:scale-105 transition-transform uppercase">
                              {getInitials(name)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-black text-slate-800 tracking-tight leading-none mb-1">{name}</span>
                              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest leading-none">{balance.user_email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-full text-[9px] px-2.5 py-0.5 border font-black uppercase tracking-widest shadow-none",
                              balance.leave_type_name === 'Compensatory Off'
                                ? 'bg-slate-900 text-white border-transparent'
                                : 'bg-slate-100 text-slate-500 border-none'
                            )}
                          >
                            {balance.leave_type_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[14px] font-black text-slate-800 tracking-tighter">{balance.allocated}</span>
                            {balance.carried_over > 0 && (
                              <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1 border border-emerald-100/50">+{balance.carried_over} C/F</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-bold text-slate-400">{balance.used || 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[14px] font-black text-amber-500">{balance.pending || 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "text-[15px] font-black tracking-tighter px-3 py-1 rounded-[8px]",
                            balance.remaining < 2 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50/50'
                          )}>
                            {balance.remaining}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-4">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 shadow-inner">
                              <div
                                className={cn(
                                  "h-full transition-all duration-700",
                                  utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-amber-500' : 'bg-slate-900'
                                )}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-slate-400 w-10 text-left shrink-0">{utilization}%</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right px-8">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100"
                              onClick={() => openEditDialog(balance)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                              onClick={() => setDeletingBalance(balance)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* --- EDIT DIALOG --- */}
      <Dialog open={!!editingBalance} onOpenChange={(open) => !open && setEditingBalance(null)}>
        <DialogContent className="sm:max-w-[400px] border-none rounded-[16px] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-slate-800">Edit Allocation</DialogTitle>
            <DialogDescription className="text-[13px] font-medium text-slate-500">
              Adjusting the allocated days will automatically update the remaining balance.
            </DialogDescription>
          </DialogHeader>

          {editingBalance && (
            <div className="space-y-6 pt-4 pb-2">
              <div className="p-4 bg-slate-50/50 rounded-[10px] border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-bold text-slate-900">{getUserName(editingBalance.user_id, editingBalance.user_email)}</p>
                  <p className="text-[12px] font-medium text-slate-500 mt-0.5">{editingBalance.leave_type_name}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 font-bold text-[12px]">
                  {getInitials(getUserName(editingBalance.user_id, editingBalance.user_email))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Used Days</Label>
                  <Input value={editingBalance?.used || 0} disabled className="h-11 bg-slate-50 border-slate-200/60 rounded-[10px] text-[13px] font-medium text-slate-400 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Allocated Days *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editAllocatedDays}
                    onChange={(e) => setEditAllocatedDays(e.target.value)}
                    className="h-11 bg-white border-slate-200/80 rounded-[10px] shadow-sm text-[13px] font-bold focus:ring-1 focus:ring-slate-300 transition-all"
                  />
                </div>
              </div>

              {parseFloat(editAllocatedDays) < (editingBalance?.used || 0) && (
                <div className="flex items-center gap-2 text-[12px] font-bold text-amber-600 bg-amber-50 p-3 rounded-[10px] border border-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Warning: New allocation is less than days used.
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditingBalance(null)} className="flex-1 h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">Cancel</Button>
                <Button
                  onClick={() => updateBalanceMutation.mutate()}
                  disabled={updateBalanceMutation.isPending}
                  className="flex-1 h-11 rounded-[10px] font-bold text-[13px] shadow-sm transition-all bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {updateBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {updateBalanceMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- DELETE CONFIRMATION --- */}
      <AlertDialog open={!!deletingBalance} onOpenChange={() => setDeletingBalance(null)}>
        <AlertDialogContent className="max-w-[400px] border-none rounded-[16px] p-6 shadow-2xl">
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-[18px] font-black text-slate-800 tracking-tight">Delete Leave Allocation?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] font-medium text-slate-500 leading-relaxed pt-2">
              Are you sure you want to delete the <b className="text-slate-900">{deletingBalance?.leave_type_name}</b> allocation for <b className="text-slate-900">{deletingBalance ? getUserName(deletingBalance.user_id, deletingBalance.user_email) : ''}</b>?
              <br /><br />
              <span className="text-red-600 font-bold">Warning:</span> The user will no longer be able to apply for this leave type. History of used leaves will remain in reports but the balance record will be gone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex-1 m-0">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBalanceMutation.mutate()}
              className="h-11 rounded-[10px] font-bold text-[13px] bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 transition-all flex-1 m-0"
            >
              {deleteBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {deleteBalanceMutation.isPending ? "Deleting..." : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}