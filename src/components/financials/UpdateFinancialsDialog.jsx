import React from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function UpdateFinancialsDialog({ open, onClose, project, onSubmit, loading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  React.useEffect(() => {
    if (project) {
      reset({
        budget: project.budget || 0,
        actual_cost: project.actual_cost || 0,
        expected_revenue: project.expected_revenue || 0,
        actual_revenue: project.actual_revenue || 0,
      });
    }
  }, [project, reset]);

  const onFormSubmit = (data) => {
    onSubmit({
      ...project,
      budget: parseFloat(data.budget),
      actual_cost: parseFloat(data.actual_cost),
      expected_revenue: parseFloat(data.expected_revenue),
      actual_revenue: parseFloat(data.actual_revenue),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Financials</DialogTitle>
          <DialogDescription>
            Update budget, costs, and revenue for {project?.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                {...register("budget", { min: 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual_cost">Actual Cost</Label>
              <Input
                id="actual_cost"
                type="number"
                step="0.01"
                {...register("actual_cost", { min: 0 })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected_revenue">Expected Revenue</Label>
              <Input
                id="expected_revenue"
                type="number"
                step="0.01"
                {...register("expected_revenue", { min: 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual_revenue">Actual Revenue</Label>
              <Input
                id="actual_revenue"
                type="number"
                step="0.01"
                {...register("actual_revenue", { min: 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
