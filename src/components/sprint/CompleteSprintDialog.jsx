import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CompleteSprintDialog({ open, onClose, sprint, tasks, onComplete }) {
  const [incompleteAction, setIncompleteAction] = useState('backlog');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sprint) return null;

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const incompleteTasks = tasks.filter(t => t.status !== 'completed');

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(sprint.id, {
        incompleteAction,
        incompleteTaskIds: incompleteTasks.map(t => t.id)
      });
      onClose();
    } catch (error) {
      console.error("Failed to complete sprint", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Sprint: {sprint.name}</DialogTitle>
          <DialogDescription>
            Review the sprint summary before closing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
              <div className="text-2xl font-bold text-green-700">{completedTasks.length}</div>
              <div className="text-sm text-green-800">Completed Tasks</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center">
              <div className="text-2xl font-bold text-amber-700">{incompleteTasks.length}</div>
              <div className="text-sm text-amber-800">Incomplete Tasks</div>
            </div>
          </div>

          {incompleteTasks.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-900">
                Move {incompleteTasks.length} incomplete tasks to:
              </div>
              <RadioGroup value={incompleteAction} onValueChange={setIncompleteAction}>
                <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="backlog" id="backlog" />
                  <Label htmlFor="backlog" className="flex-1 cursor-pointer">
                    Backlog
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="next_sprint" id="next_sprint" />
                  <Label htmlFor="next_sprint" className="flex-1 cursor-pointer">
                    Next Planned Sprint
                    <span className="block text-xs text-slate-500 font-normal">
                      If no planned sprint exists, tasks will move to backlog.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {incompleteTasks.length === 0 && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All tasks completed! Great job team.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={isSubmitting}>
            {isSubmitting ? 'Completing...' : 'Complete Sprint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}