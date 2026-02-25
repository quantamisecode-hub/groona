import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2, Loader2, Wand2 } from "lucide-react"; // Added Wand2 icon
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
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <CardTitle>Leave Types Configuration</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                    Define the types of leaves available for your organization.
                </p>
            </div>
            <div className="flex gap-2">
              {/* Seed Button */}
              <Button 
                variant="outline"
                onClick={() => seedDefaultsMutation.mutate()}
                disabled={seedDefaultsMutation.isPending}
                className="border-dashed"
              >
                 {seedDefaultsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                 ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                 )}
                 Load Defaults
              </Button>
              
              <Button
                onClick={() => setShowDialog(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Leave Type
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {leaveTypes.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-lg bg-slate-50">
                  <p className="text-slate-500 mb-4">No leave types configured.</p>
                  <Button onClick={() => seedDefaultsMutation.mutate()}>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Load Standard Defaults
                  </Button>
              </div>
          ) : (
          <div className="space-y-4">
            {leaveTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                      {type.name}
                      {type.is_comp_off && <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">Comp-Off</span>}
                  </h3>
                  <div className="flex gap-4 mt-1 text-sm text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{type.code}</span>
                    <span>Annual: {type.annual_allocation} days</span>
                    {type.carry_forward && (
                      <span className="text-green-600">Carry Fwd: Max {type.max_carry_forward}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(type)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingType(type)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Edit Leave Type' : 'Add Leave Type'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Casual Leave"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. CL"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Annual Allocation (Days)</Label>
              <Input
                type="number"
                value={formData.annual_allocation}
                onChange={(e) => setFormData({ ...formData, annual_allocation: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center justify-between border p-3 rounded-lg">
              <Label className="cursor-pointer" htmlFor="carry-switch">Carry Forward Unused Leaves</Label>
              <Switch
                id="carry-switch"
                checked={formData.carry_forward}
                onCheckedChange={(checked) => setFormData({ ...formData, carry_forward: checked })}
              />
            </div>

            {formData.carry_forward && (
              <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                <Label>Max Carry Forward (Days)</Label>
                <Input
                  type="number"
                  value={formData.max_carry_forward}
                  onChange={(e) => setFormData({ ...formData, max_carry_forward: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}

            <div className="flex items-center justify-between border p-3 rounded-lg">
              <Label className="cursor-pointer" htmlFor="comp-switch">Is Compensatory Off?</Label>
              <Switch
                id="comp-switch"
                checked={formData.is_comp_off}
                onCheckedChange={(checked) => setFormData({ ...formData, is_comp_off: checked })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingType ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingType} onOpenChange={() => setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingType?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

