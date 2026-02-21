import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../shared/UserContext";

export default function SubmitTimesheetsDialog({ open, onClose, draftEntries, onSuccess }) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [selectedIds, setSelectedIds] = useState([]);

  const submitMutation = useMutation({
    mutationFn: async (timesheetIds) => {
      const now = new Date().toISOString();

      // Update all selected timesheets to submitted
      await Promise.all(
        timesheetIds.map(id =>
          groonabackend.entities.Timesheet.update(id, {
            status: 'submitted',
            submitted_at: now
          })
        )
      );

      // Get user for notifications
      const user = await groonabackend.auth.me();
      const effectiveTenantId = user.is_super_admin && user.active_tenant_id
        ? user.active_tenant_id
        : user.tenant_id;

      // Notify approvers (project managers and admins)
      try {
        const uniqueProjectIds = [...new Set(draftEntries.map(e => {
          // Handle both populated object and string ID
          return e.project_id && typeof e.project_id === 'object' ? e.project_id._id || e.project_id.id : e.project_id;
        }).filter(Boolean))];

        for (const pid of uniqueProjectIds) {
          // Get project managers
          const pmRoles = await groonabackend.entities.ProjectUserRole.filter({
            project_id: pid,
            role: 'project_manager'
          });

          // Get project details
          const projectList = await groonabackend.entities.Project.filter({ id: pid });
          const projectData = projectList[0];

          // Notify each PM
          for (const pmRole of pmRoles) {
            await groonabackend.entities.Notification.create({
              tenant_id: effectiveTenantId,
              recipient_email: pmRole.user_email,
              type: 'timesheet_approval_needed',
              category: 'general',
              title: 'Timesheet Approval Pending',
              message: `${user.full_name} submitted timesheets for ${projectData?.name || 'project'}`,
              entity_type: 'timesheet',
              sender_name: user.full_name
            });
          }
        }

        // Notify admins
        const admins = await groonabackend.entities.User.filter({
          tenant_id: effectiveTenantId,
          role: 'admin'
        });

        for (const admin of admins) {
          await groonabackend.entities.Notification.create({
            tenant_id: effectiveTenantId,
            recipient_email: admin.email,
            type: 'timesheet_approval_needed',
            category: 'general',
            title: 'Timesheet Approval Pending',
            message: `${user.full_name} submitted ${timesheetIds.length} timesheet entries`,
            entity_type: 'timesheet',
            sender_name: user.full_name
          });
        }
      } catch (notifError) {
        console.error('[SubmitTimesheetsDialog] Failed to send notifications:', notifError);
      }

      // Send email acknowledgment to the user who submitted
      try {
        // Get today's date in local ISO format (YYYY-MM-DD)
        const todayStr = new Date().toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD

        // Get the first timesheet for details (if single entry)
        const submittedTimesheets = draftEntries.filter(e => timesheetIds.includes(e.id));
        const firstTimesheet = submittedTimesheets[0];

        // Determine if any entry is late
        const isLateBatch = submittedTimesheets.some(t => {
          const entryDateStr = t.date?.substring(0, 10);
          return entryDateStr && entryDateStr < todayStr;
        });

        await groonabackend.email.sendTemplate({
          to: user.email,
          templateType: 'timesheet_submitted',
          data: {
            memberName: user.full_name,
            memberEmail: user.email,
            taskTitle: timesheetIds.length === 1 ? (firstTimesheet?.task_title || 'N/A') : undefined,
            date: firstTimesheet?.date || new Date().toISOString().split('T')[0],
            hours: firstTimesheet?.hours || 0,
            minutes: firstTimesheet?.minutes || 0,
            projectName: firstTimesheet?.project_name,
            entryCount: timesheetIds.length,
            isLate: isLateBatch
          }
        });

        // Create In-App Notification for Submitter
        await groonabackend.entities.Notification.create({
          tenant_id: effectiveTenantId,
          recipient_email: user.email,
          type: isLateBatch ? 'late_timesheet_submission' : 'timesheet_submission',
          category: 'general',
          title: isLateBatch ? 'Late Timesheet Submission' : 'Timesheet Submitted',
          message: isLateBatch
            ? `You have submitted ${timesheetIds.length} late timesheet entr${timesheetIds.length === 1 ? 'y' : 'ies'}.`
            : `You have successfully submitted ${timesheetIds.length} timesheet entr${timesheetIds.length === 1 ? 'y' : 'ies'}.`,
          entity_type: 'timesheet',
          sender_name: 'System'
        });

      } catch (emailError) {
        console.error('[SubmitTimesheetsDialog] Failed to send submission email/notification:', emailError);
        // Don't fail the submission if email fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheets submitted for approval');
      onSuccess?.();
      onClose();
      setSelectedIds([]);
    },
    onError: (error) => {
      console.error('[SubmitTimesheetsDialog] Error:', error);
      toast.error('Failed to submit timesheets');
    }
  });

  const handleToggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === draftEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(draftEntries.map(e => e.id));
    }
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one entry');
      return;
    }
    submitMutation.mutate(selectedIds);
  };

  const totalHours = draftEntries
    .filter(e => selectedIds.includes(e.id))
    .reduce((sum, e) => sum + (e.hours || 0), 0);

  const totalMinutes = draftEntries
    .filter(e => selectedIds.includes(e.id))
    .reduce((sum, e) => sum + (e.minutes || 0), 0);

  const finalHours = totalHours + Math.floor(totalMinutes / 60);
  const finalMinutes = totalMinutes % 60;

  const isLocked = user?.is_timesheet_locked;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Timesheets for Approval</DialogTitle>
          <DialogDescription>
            Select the draft entries you want to submit. Once submitted, they will be locked until approved or rejected.
          </DialogDescription>
        </DialogHeader>

        {isLocked && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Audit locked by Manager--</strong>
            <span className="block sm:inline"> You cannot submit timesheets at this time.</span>
          </div>
        )}

        {draftEntries.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No draft entries to submit</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-3 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={submitMutation.isPending || isLocked}
              >
                {selectedIds.length === draftEntries.length ? 'Deselect All' : 'Select All'}
              </Button>
              <div className="text-sm text-slate-600">
                {selectedIds.length} of {draftEntries.length} selected
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {draftEntries.map(entry => (
                <Card
                  key={entry.id}
                  className={`cursor-pointer transition-colors ${selectedIds.includes(entry.id) ? 'bg-blue-50 border-blue-200' : ''
                    } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isLocked && handleToggle(entry.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(entry.id)}
                          onCheckedChange={() => handleToggle(entry.id)}
                          disabled={submitMutation.isPending || isLocked}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-slate-900">{entry.task_title}</p>
                          <Badge variant="outline" className="ml-2">
                            <Clock className="h-3 w-3 mr-1" />
                            {entry.time_spent || `${entry.hours}h ${entry.minutes}m`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                          <span className="truncate">{entry.project_name}</span>
                          {entry.sprint_name && (
                            <Badge variant="secondary" className="text-xs">{entry.sprint_name}</Badge>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-slate-600 line-clamp-1 mt-1">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between py-3 border-t">
                <div className="text-sm font-medium text-slate-900">
                  Total Time: {finalHours}h {finalMinutes}m
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle className="h-3 w-3" />
                  Ready to submit
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || selectedIds.length === 0 || isLocked}
            className={isLocked ? "bg-gray-400 cursor-not-allowed" : ""}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              `Submit ${selectedIds.length} Entries`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
