import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AnnualAllocationButton({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [dryRun, setDryRun] = useState(false);

  const allocationMutation = useMutation({
    mutationFn: async ({ targetYear, isDryRun }) => {
      // FIX: 'response' is already the data payload because groonabackend.functions.invoke returns res.data
      const response = await groonabackend.functions.invoke('runAnnualLeaveAllocation', {
        tenant_id: currentUser.tenant_id,
        year: targetYear,
        dry_run: isDryRun
      });
      return response; // Removed .data here
    },
    onSuccess: (data) => {
      if (data && data.success) {
        const result = data.results[0];
        toast.success(
          `Leave allocation ${dryRun ? 'simulated' : 'completed'} for ${data.year}`,
          {
            description: `Created: ${result.created}, Updated: ${result.updated}, Carried Forward: ${result.carried_forward}`
          }
        );
        if (!dryRun) {
            setOpen(false);
        }
      } else {
        toast.error('Allocation failed: ' + (data?.message || 'Unknown error'));
      }
    },
    onError: (error) => {
      toast.error('Failed to allocate leaves: ' + error.message);
    }
  });

  const handleRun = () => {
    allocationMutation.mutate({ targetYear: year, isDryRun: dryRun });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
        data-onboarding="annual-allocation-button"
      >
        <Calendar className="h-4 w-4" />
        Annual Allocation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Annual Leave Allocation</DialogTitle>
            <DialogDescription>
              Allocate leave days to all users for the selected year based on configured leave types
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will create or update leave balances for all users in your organization. 
                Any carry-forward rules will be applied automatically.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min={2020}
                max={2050}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dryRun"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="dryRun" className="cursor-pointer">
                Dry run (preview without saving)
              </Label>
            </div>

            {allocationMutation.isSuccess && allocationMutation.data?.results?.[0] && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <div className="font-semibold mb-1">
                    {dryRun ? 'Simulation Complete' : 'Allocation Complete'}
                  </div>
                  <div className="text-sm space-y-1">
                    <div>Created: {allocationMutation.data.results[0].created} new balances</div>
                    <div>Updated: {allocationMutation.data.results[0].updated} existing balances</div>
                    <div>Carried Forward: {allocationMutation.data.results[0].carried_forward} balances</div>
                    <div>Total Users: {allocationMutation.data.results[0].total_users}</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={allocationMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRun}
              disabled={allocationMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {allocationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  {dryRun ? 'Simulate' : 'Run Allocation'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

