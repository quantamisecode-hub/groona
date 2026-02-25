import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, Clock, ShieldAlert, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import TimesheetEntryForm from "./TimesheetEntryForm";

export default function MandatoryTimesheetModal({ currentUser, effectiveTenantId }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAppeal, setShowAppeal] = useState(false);
    const [appealReason, setAppealReason] = useState("");
    const queryClient = useQueryClient();

    const isAllowedRole = (currentUser?.role === 'member' && currentUser?.custom_role === 'viewer');

    // Fetch notifications to check for timesheet alerts/alarms
    const { data: notifications = [] } = useQuery({
        queryKey: ['mandatory-timesheet-check', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return [];
            return groonabackend.entities.Notification.filter({
                recipient_email: currentUser.email
            });
        },
        select: (data) => data.filter(n => n.status === 'OPEN' || n.status === 'APPEALED'),
        enabled: !!currentUser?.email && isAllowedRole,
        refetchInterval: 30000, // Check every 30 seconds
    });

    const { data: missingDayData } = useQuery({
        queryKey: ['missing-timesheet-day', currentUser?.email],
        queryFn: () => groonabackend.functions.invoke('getMissingTimesheetDay', {
            userEmail: currentUser.email
        }),
        enabled: !!currentUser?.email && isAllowedRole,
        refetchInterval: 60000,
    });

    const timesheetAlerts = notifications.filter(n =>
        n.type === 'timesheet_missing_alert' ||
        n.type === 'timesheet_missing_alarm' ||
        n.type === 'timesheet_incomplete_alert' ||
        n.type === 'timesheet_lockout_alarm'
    );

    const hasMissingDay = !!missingDayData?.missingDate;

    const hasAlarm = timesheetAlerts.some(n =>
        (n.status === 'OPEN' || n.status === 'APPEALED') &&
        (n.category === 'alarm' || n.type === 'timesheet_missing_alarm' || n.type === 'task_delay_alarm')
    );
    const isTaskDelay = timesheetAlerts.some(n => n.type === 'task_delay_alarm');
    const hasPendingAppeal = timesheetAlerts.some(n => n.status === 'APPEALED');

    useEffect(() => {
        // If we have alerts OR a missing day detected
        if ((timesheetAlerts.length > 0 || hasMissingDay) && !isSubmitting) {
            setOpen(true);
        } else if (timesheetAlerts.length === 0 && !hasMissingDay) {
            setOpen(false);
        }
    }, [timesheetAlerts.length, hasMissingDay, isSubmitting]);

    const handleSuccess = async () => {
        queryClient.invalidateQueries({ queryKey: ['missing-timesheet-day', currentUser?.email] });
        queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
        setOpen(false);
        setShowAppeal(false);
        setAppealReason("");
    };

    if (!isAllowedRole || !open || (timesheetAlerts.length === 0 && !hasMissingDay)) return null;

    // --- REFACTORED VIEW ---
    const renderContent = () => (
        <div className={cn(
            "flex flex-col h-full max-h-[90vh] w-full max-w-3xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200",
            hasAlarm && "bg-red-50 border-red-200"
        )}>
            <div className={`p-6 ${hasAlarm ? 'bg-red-50 border-b border-red-100' : 'bg-amber-50 border-b border-amber-100'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${hasAlarm ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        {hasAlarm ? <ShieldAlert className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className={`text-xl font-bold ${hasAlarm ? 'text-red-900' : 'text-amber-900'}`}>
                            {hasAlarm
                                ? (isTaskDelay ? 'Action Required: Resolve Task Delays' : 'Action Required: Log Pending Hours')
                                : 'Missing Timesheet Entry Required'}
                        </h3>
                        <div className={`text-sm mt-1 ${hasAlarm ? 'text-red-700' : 'text-amber-700'}`}>
                            {hasAlarm
                                ? (isTaskDelay
                                    ? "Critical: 3 Task delays detected. Admin has been notified. Work start is locked until reasons are provided."
                                    : "Severe Policy Violation: Multiple missing timesheets detected. Work tracking is locked until pending hours are logged.")
                                : (hasMissingDay && missingDayData?.missingDate && isValid(new Date(missingDayData.missingDate))
                                    ? (
                                        <div className="space-y-1">
                                            <span>You haven't logged at least 8 hours for {format(new Date(missingDayData.missingDate), 'MMMM do, yyyy')}. Please log your hours to continue.</span>
                                            {missingDayData.dailyTotal > 0 && (
                                                <div className="text-xs font-semibold mt-2 flex items-center gap-1.5 px-2 py-1 bg-white/50 rounded-md border border-amber-200/50 w-fit">
                                                    <Clock className="w-3 h-3" />
                                                    Currently: {(missingDayData.dailyTotal / 60).toFixed(2)}h in {missingDayData.dailyStatus === 'draft' ? 'Draft' : 'Submitted'}
                                                </div>
                                            )}
                                        </div>
                                    )
                                    : "You haven't logged your time yet. Please log your daily hours to continue.")
                            }
                        </div>
                    </div>
                    {!hasAlarm && (
                        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="p-6 bg-white overflow-y-auto">
                {!showAppeal ? (
                    <TimesheetEntryForm
                        currentUser={currentUser}
                        effectiveTenantId={effectiveTenantId}
                        forceRemark={hasAlarm}
                        hideCancel={hasAlarm}
                        preSelectedDate={missingDayData?.missingDate}
                        remarkLabel={isTaskDelay ? "Delay Reason" : "Backlog Reason"}
                        extraButtons={
                            hasAlarm && currentUser?.custom_role === 'viewer' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => !hasPendingAppeal && setShowAppeal(true)}
                                    className={cn(
                                        "text-amber-600 border-amber-200 hover:bg-amber-50 flex-1",
                                        hasPendingAppeal && "opacity-50 cursor-not-allowed grayscale"
                                    )}
                                    disabled={hasPendingAppeal}
                                >
                                    {hasPendingAppeal ? "Appeal Pending Review" : "Appeal Project Manager"}
                                </Button>
                            )
                        }
                        onSubmit={async (data) => {
                            setIsSubmitting(true);
                            try {
                                await groonabackend.entities.Timesheet.create(data);

                                // Also resolve the notifications locally for immediate UI response
                                for (const alert of timesheetAlerts) {
                                    const id = alert._id || alert.id;
                                    if (id) {
                                        await groonabackend.entities.Notification.update(id, { status: 'RESOLVED', read: true });
                                    }
                                }

                                toast.success("Timesheet logged successfully. Enforcement cleared.");
                                handleSuccess();
                            } catch (error) {
                                console.error('Failed to create timesheet:', error);
                                toast.error("Failed to log timesheet. Please try again.");
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        onCancel={() => {
                            // Cannot cancel if it's an alarm
                            if (!hasAlarm) {
                                setOpen(false);
                            }
                        }}
                    />
                ) : (
                    <div className="space-y-4 text-left">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-slate-900">Appeal Request</h4>
                            <p className="text-sm text-slate-500">Provide a reason why you missed these logs or tasks. This will be sent to your Project Manager for review.</p>
                        </div>
                        <textarea
                            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Enter your reason for appeal..."
                            rows={4}
                            value={appealReason}
                            onChange={(e) => setAppealReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setShowAppeal(false)}
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                                disabled={!appealReason.trim() || isSubmitting}
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    try {
                                        const now = new Date().toISOString();
                                        for (const alert of timesheetAlerts) {
                                            const id = alert._id || alert.id;
                                            if (id) {
                                                await groonabackend.entities.Notification.update(id, {
                                                    status: 'APPEALED',
                                                    appeal_reason: appealReason,
                                                    appealed_at: now
                                                });
                                            }
                                        }
                                        toast.success("Appeal submitted! Waiting for PM review.");
                                        handleSuccess();
                                    } catch (error) {
                                        console.error("Failed to submit appeal:", error);
                                        toast.error("Failed to submit appeal. Please try again.");
                                    } finally {
                                        setIsSubmitting(false);
                                    }
                                }}
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Submit Appeal
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (hasAlarm) {
        return (
            <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                {renderContent()}
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent hideCloseButton className="max-w-3xl w-full p-0 overflow-hidden border-none shadow-2xl">
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
}
