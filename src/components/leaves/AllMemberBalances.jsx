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
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Team Leave Balances</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Manage individual allocations for {year}. Changes here affect availability immediately.
              </p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employee or type..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[200px]">Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead className="text-center">Allocated</TableHead>
                  <TableHead className="text-center">Used</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center font-bold text-slate-700">Remaining</TableHead>
                  {/* Added Status Column */}
                  <TableHead className="text-center w-[140px]">Utilization</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">Loading balances...</TableCell>
                  </TableRow>
                ) : filteredBalances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                      No balance records found for {year}.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBalances.map((balance) => {
                    const name = getUserName(balance.user_id, balance.user_email);
                    
                    // Calculate Utilization
                    const totalAvailable = balance.allocated + (balance.carried_over || 0);
                    const utilization = totalAvailable > 0 
                        ? Math.round(((balance.used || 0) / totalAvailable) * 100) 
                        : 0;

                    return (
                      <TableRow key={balance.id} className="group hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-slate-900">{name}</span>
                              <span className="text-xs text-slate-500">{balance.user_email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-white font-normal text-slate-700">
                            {balance.leave_type_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                              <span className="font-medium">{balance.allocated}</span>
                              {balance.carried_over > 0 && (
                                  <span className="text-[10px] text-green-600">+{balance.carried_over} C/F</span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-slate-600">
                          {balance.used || 0}
                        </TableCell>
                        <TableCell className="text-center text-orange-600">
                          {balance.pending || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${balance.remaining < 2 ? 'text-red-600' : 'text-green-600'}`}>
                            {balance.remaining}
                          </span>
                        </TableCell>
                        
                        {/* Status Bar Column */}
                        <TableCell className="text-center">
                             <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${utilization > 80 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${Math.min(utilization, 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{utilization}%</span>
                            </div>
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => openEditDialog(balance)}
                                title="Edit Allocation"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletingBalance(balance)}
                                title="Delete Balance"
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Leave Allocation</DialogTitle>
            <DialogDescription>
              Adjusting the allocated days will automatically update the remaining balance.
            </DialogDescription>
          </DialogHeader>

          {editingBalance && (
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{getUserName(editingBalance.user_id, editingBalance.user_email)}</p>
                <p className="text-xs text-slate-500">{editingBalance.leave_type_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label>Used (ReadOnly)</Label>
                   <Input value={editingBalance.used || 0} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                   <Label>Allocated Days</Label>
                   <Input 
                      type="number" 
                      step="0.5" 
                      value={editAllocatedDays}
                      onChange={(e) => setEditAllocatedDays(e.target.value)}
                   />
                </div>
              </div>

              {parseFloat(editAllocatedDays) < (editingBalance.used || 0) && (
                 <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertTriangle className="h-3 w-3" />
                    Warning: Allocation is less than days already used.
                 </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBalance(null)}>Cancel</Button>
            <Button 
              onClick={() => updateBalanceMutation.mutate()} 
              disabled={updateBalanceMutation.isPending}
              className="bg-blue-600"
            >
              {updateBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DELETE CONFIRMATION --- */}
      <AlertDialog open={!!deletingBalance} onOpenChange={() => setDeletingBalance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Balance?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the <b>{deletingBalance?.leave_type_name}</b> allocation for <b>{deletingBalance ? getUserName(deletingBalance.user_id, deletingBalance.user_email) : ''}</b>?
              <br/><br/>
              <span className="text-red-600">Warning: The user will no longer be able to apply for this leave type. History of used leaves will remain in reports but the balance record will be gone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteBalanceMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

