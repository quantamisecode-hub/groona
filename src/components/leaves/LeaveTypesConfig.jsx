import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Loader2, Wand2, Settings2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import AnnualAllocationButton from "./AnnualAllocationButton";

// --- STANDARD DEFAULT TYPES ---
const STANDARD_LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", annual_allocation: 12, color: "bg-blue-100 text-blue-800", description: "For personal matters and short breaks." },
  { name: "Sick Leave", code: "SL", annual_allocation: 10, color: "bg-red-100 text-red-800", description: "For medical recovery." },
  { name: "Privilege Leave", code: "PL", annual_allocation: 18, carry_forward: true, max_carry_forward: 45, color: "bg-green-100 text-green-800", description: "Earned leave for long vacations." },
  { name: "Maternity Leave", code: "ML", annual_allocation: 180, color: "bg-pink-100 text-pink-800", description: "Maternity benefit." },
  { name: "Paternity Leave", code: "PTL", annual_allocation: 5, color: "bg-purple-100 text-purple-800", description: "Paternity benefit." },
  { name: "Work From Home", code: "WFH", annual_allocation: 12, color: "bg-indigo-100 text-indigo-800", description: "Remote work allowance." },
  { name: "Compensatory Off", code: "COMP", annual_allocation: 0, is_comp_off: true, color: "bg-orange-100 text-orange-800", description: "Time off in lieu of overtime." },
  { name: "Unpaid Leave", code: "LOP", annual_allocation: 0, color: "bg-slate-100 text-slate-800", description: "Loss of pay." }
];

export default function LeaveTypesConfig({ tenantId, currentUser }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    annual_allocation: 0,
    carry_forward: false,
    max_carry_forward: 0,
    is_comp_off: false,
    color: 'blue'
  });

  // Fetch leave types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types', tenantId],
    queryFn: () => groonabackend.entities.LeaveType.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingType) {
        return groonabackend.entities.LeaveType.update(editingType.id, data);
      } else {
        return groonabackend.entities.LeaveType.create({
          ...data,
          tenant_id: tenantId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-types'] }); // Refresh allocation dropdown
      toast.success(`Leave type ${editingType ? 'updated' : 'created'} successfully`);
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to save leave type: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return groonabackend.entities.LeaveType.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-types'] });
      toast.success('Leave type deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete leave type: ' + error.message);
    }
  });

  // --- NEW: Seed Defaults Mutation ---
  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      let addedCount = 0;
      for (const type of STANDARD_LEAVE_TYPES) {
        // Check if exists by code to avoid duplicates
        const exists = leaveTypes.find(lt => lt.code === type.code || lt.name === type.name);
        if (!exists) {
          await groonabackend.entities.LeaveType.create({
            ...type,
            tenant_id: tenantId,
            is_active: true
          });
          addedCount++;
        }
      }
      return addedCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-types'] });
      if (count > 0) {
        toast.success(`Successfully added ${count} standard leave types.`);
      } else {
        toast.info("Standard leave types already exist.");
      }
    },
    onError: (err) => {
      toast.error("Failed to seed defaults: " + err.message);
    }
  });

  const handleClose = () => {
    setShowDialog(false);
    setEditingType(null);
    setFormData({
      name: '',
      code: '',
      annual_allocation: 0,
      carry_forward: false,
      max_carry_forward: 0,
      is_comp_off: false,
      color: 'blue'
    });
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setFormData({
      name: type.name || '',
      code: type.code || '',
      annual_allocation: type.annual_allocation || 0,
      carry_forward: type.carry_forward || false,
      max_carry_forward: type.max_carry_forward || 0,
      is_comp_off: type.is_comp_off || false,
      color: type.color || 'blue'
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (deletingType) {
      deleteMutation.mutate(deletingType.id);
      setDeletingType(null);
    }
  };

  return (
    <>
      <Card className="bg-white border-slate-200/60 shadow-sm rounded-[12px]">
        <CardHeader className="border-b border-slate-100 px-6 py-6 font-medium">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-[16px] font-bold text-slate-800">Leave Types Configuration</CardTitle>
              <p className="text-[13px] text-slate-500 mt-1 font-medium">
                Define the types of leaves available for your organization.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => seedDefaultsMutation.mutate()}
                disabled={seedDefaultsMutation.isPending}
                className="h-9 px-4 rounded-[10px] text-[12px] font-bold shadow-sm transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/60 border-dashed"
              >
                {seedDefaultsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5 mr-2" />
                )}
                Load Defaults
              </Button>

              <Button
                onClick={() => setShowDialog(true)}
                className="h-9 px-4 rounded-[10px] text-[12px] font-bold shadow-sm transition-all bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                Add Type
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {leaveTypes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-[12px] bg-slate-50/50">
              <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center border border-slate-100 mx-auto mb-4 shadow-sm text-slate-300">
                <Settings2 className="h-6 w-6" />
              </div>
              <p className="text-[13px] font-medium text-slate-500 mb-5">No leave types configured.</p>
              <Button
                onClick={() => seedDefaultsMutation.mutate()}
                className="h-10 px-6 rounded-[10px] text-[13px] font-bold shadow-sm transition-all bg-slate-900 text-white"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Load Standard Defaults
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-4 border border-slate-100/80 rounded-[12px] hover:bg-slate-50/30 transition-all bg-white shadow-sm group"
                >
                  <div className="flex-1">
                    <h3 className="text-[14px] font-black text-slate-800 flex items-center gap-3 tracking-tight">
                      {type.name}
                      {type.is_comp_off && (
                        <Badge className="rounded-full text-[9px] px-2 py-0 border border-amber-200 bg-amber-50 text-amber-700 font-bold uppercase tracking-widest shadow-none">
                          Comp-Off
                        </Badge>
                      )}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-[6px] border border-slate-100 lowercase font-bold">{type.code}</span>
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" />Annual: <span className="text-slate-700">{type.annual_allocation} days</span></span>
                      {type.carry_forward && (
                        <span className="flex items-center gap-1.5 text-emerald-600"><div className="w-1.5 h-1.5 rounded-full bg-emerald-200" />Carry Fwd: <span className="font-black">Max {type.max_carry_forward}</span></span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white border border-slate-100 hover:border-slate-300 hover:shadow-sm"
                      onClick={() => handleEdit(type)}
                    >
                      <Edit className="h-3.5 w-3.5 text-slate-400 hover:text-slate-900" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white border border-slate-100 hover:bg-red-50 hover:border-red-200 hover:shadow-sm"
                      onClick={() => setDeletingType(type)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-[420px] border-none rounded-[16px] p-0 shadow-2xl overflow-hidden bg-white">
          <DialogHeader className="px-6 py-6 border-b border-slate-100">
            <DialogTitle className="text-[17px] font-black text-slate-800 tracking-tight">
              {editingType ? 'Edit Leave Type' : 'Add Leave Type'}
            </DialogTitle>
            <DialogDescription className="text-[13px] font-medium text-slate-400 mt-1">
              Configure parameters for this leave category.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Leave Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Casual Leave"
                required
                className="h-11 bg-slate-50 border-slate-200/60 rounded-[10px] text-[13px] font-bold shadow-none focus:bg-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Short Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. CL"
                  required
                  className="h-11 bg-slate-50 border-slate-200/60 rounded-[10px] text-[13px] font-black uppercase tracking-widest shadow-none focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Annual Days</Label>
                <Input
                  type="number"
                  value={formData.annual_allocation}
                  onChange={(e) => setFormData({ ...formData, annual_allocation: parseInt(e.target.value) || 0 })}
                  className="h-11 bg-slate-50 border-slate-200/60 rounded-[10px] text-[13px] font-bold shadow-none focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-4 rounded-[12px] bg-slate-50/50 border border-slate-100 shadow-inner">
                <div>
                  <Label className="cursor-pointer text-[13px] font-black text-slate-800" htmlFor="carry-switch">Carry Forward</Label>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">Allow unused days to roll over.</p>
                </div>
                <Switch
                  id="carry-switch"
                  checked={formData.carry_forward}
                  onCheckedChange={(checked) => setFormData({ ...formData, carry_forward: checked })}
                />
              </div>

              {formData.carry_forward && (
                <div className="space-y-2 pl-4 border-l-2 border-emerald-400/30 animate-in slide-in-from-left-2">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Max Rollover Days</Label>
                  <Input
                    type="number"
                    value={formData.max_carry_forward}
                    onChange={(e) => setFormData({ ...formData, max_carry_forward: parseInt(e.target.value) || 0 })}
                    className="h-11 bg-white border-slate-200/80 rounded-[10px] shadow-sm text-[13px] font-bold focus:ring-1 focus:ring-slate-300 transition-all"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-[12px] bg-slate-50/50 border border-slate-100 shadow-inner">
                <div>
                  <Label className="cursor-pointer text-[13px] font-black text-slate-800" htmlFor="comp-switch">Comp-Off Type</Label>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">Requires credit approval.</p>
                </div>
                <Switch
                  id="comp-switch"
                  checked={formData.is_comp_off}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_comp_off: checked })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 rounded-[10px] font-black text-[13px] shadow-lg shadow-slate-200 transition-all bg-slate-900 hover:bg-slate-800 text-white"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  editingType ? 'Save Changes' : 'Create Type'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingType} onOpenChange={() => setDeletingType(null)}>
        <AlertDialogContent className="max-w-[400px] border-none rounded-[16px] p-6 shadow-2xl">
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-[18px] font-black text-slate-800 tracking-tight">Delete Leave Type?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] font-medium text-slate-500 leading-relaxed pt-2">
              Are you sure you want to delete <b className="text-slate-900">"{deletingType?.name}"</b>? This will affect all future leave calculations and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex-1 m-0">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-11 rounded-[10px] font-bold text-[13px] bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 transition-all flex-1 m-0"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

