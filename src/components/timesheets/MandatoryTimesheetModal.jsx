import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, Clock, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import TimesheetEntryForm from "./TimesheetEntryForm";

export default function MandatoryTimesheetModal({ currentUser, effectiveTenantId }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAppeal, setShowAppeal] = useState(false);
    const [appealReason, setAppealReason] = useState("");
    const queryClient = useQueryClient();

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
        enabled: !!currentUser?.email,
        refetchInterval: 30000, // Check every 30 seconds
    });

    const timesheetAlerts = notifications.filter(n =>
        n.type === 'timesheet_missing_alert' ||
        n.type === 'timesheet_missing_alarm' ||
        n.type === 'timesheet_incomplete_alert' ||
        n.type === 'timesheet_lockout_alarm'
    );

    const hasAlarm = timesheetAlerts.some(n =>
        (n.status === 'OPEN' || n.status === 'APPEALED') &&
        (n.category === 'alarm' || n.type === 'timesheet_missing_alarm' || n.type === 'task_delay_alarm')
    );
    const isTaskDelay = timesheetAlerts.some(n => n.type === 'task_delay_alarm');
    const hasPendingAppeal = timesheetAlerts.some(n => n.status === 'APPEALED');

    const hasLockout = timesheetAlerts.some(n => n.type === 'timesheet_lockout_alarm' && n.status === 'OPEN');

    // Logic for appeals on Lockout
    // If it's a lockout, we only show "Ask Manager Approval" if NOT appealed yet.
    // If appealed, we show "Pending Approval"
    const isLockoutAppealed = timesheetAlerts.some(n => n.type === 'timesheet_lockout_alarm' && n.status === 'APPEALED');

    useEffect(() => {
        // If we have alerts (including lockouts), and we aren't currently submitting
        if (timesheetAlerts.length > 0 && !isSubmitting) {
            setOpen(true);
        } else if (timesheetAlerts.length === 0) {
            setOpen(false);
        }
    }, [timesheetAlerts.length, isSubmitting]);

    const handleSuccess = async () => {
        queryClient.invalidateQueries({ queryKey: ['mandatory-timesheet-check'] });
        queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
        setOpen(false);
        setShowAppeal(false);
        setAppealReason("");
    };

    if (timesheetAlerts.length === 0) return null;

    // --- LOCKOUT VIEW ---
    if (hasLockout || isLockoutAppealed) {
        return (
            <Dialog open={open} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none" hideCloseButton={true}>
                    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-red-200">
                        <div className="p-6 bg-red-50 border-b border-red-100 text-center">
                            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <ShieldAlert className="h-8 w-8 text-red-600" />
                            </div>
                            <DialogTitle className="text-2xl font-bold text-red-900 mb-2">
                                Account Locked
                            </DialogTitle>
                            <DialogDescription className="text-red-700">
                                You have ignored over 3 timesheet alerts. Your account access is suspended until further notice.
                            </DialogDescription>
                        </div>
                        <div className="p-6">
                            {isLockoutAppealed ? (
                                <div className="text-center space-y-4">
                                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-sm">
                                        <strong>Request Sent</strong><br />
                                        Your request for unlocking has been sent to your Manager. Please wait for approval.
                                    </div>
                                    <Button disabled className="w-full" variant="outline">
                                        Pending Admin Action
                                    </Button>
                                </div>
                            ) : (
                                !showAppeal ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600 text-center">
                                            To regain access, you must request approval from your reporting manager.
                                        </p>
                                        <Button
                                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => setShowAppeal(true)}
                                        >
                                            Require Manager Approval
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-slate-900">Request Unlock</h4>
                                            <p className="text-sm text-slate-500">Please provide a reason for the repeated delays.</p>
                                        </div>
                                        <textarea
                                            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                                            placeholder="Apology / Explanation..."
                                            rows={3}
                                            value={appealReason}
                                            onChange={(e) => setAppealReason(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setShowAppeal(false)} className="flex-1">Back</Button>
                                            <Button
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                                onClick={async () => {
                                                    setIsSubmitting(true);
                                                    try {
                                                        const now = new Date().toISOString();
                                                        // Update Lockout Alarms to APPEALED
                                                        for (const alert of timesheetAlerts) {
                                                            if (alert.type === 'timesheet_lockout_alarm') {
                                                                await groonabackend.entities.Notification.update(alert._id || alert.id, {
                                                                    status: 'APPEALED',
                                                                    appeal_reason: appealReason,
                                                                    appealed_at: now
                                                                });
                                                            }
                                                        }
                                                        toast.success("Request sent to Manager.");
                                                        // Close locally/Refresh
                                                        handleSuccess();
                                                    } catch (e) {
                                                        console.error(e);
                                                        toast.error("Failed to send request.");
                                                    } finally {
                                                        setIsSubmitting(false);
                                                    }
                                                }}
                                                disabled={!appealReason.trim() || isSubmitting}
                                            >
                                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                Send Request
                                            </Button>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // --- ORIGINAL VIEW (Alerts/Alarms but no Lockout) ---
    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val && !hasAlarm) setOpen(false);
        }}>
            <DialogContent
                className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none"
                hideCloseButton={hasAlarm}
            >
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
                    <div className={`p-6 ${hasAlarm ? 'bg-red-50 border-b border-red-100' : 'bg-amber-50 border-b border-amber-100'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${hasAlarm ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                {hasAlarm ? <ShieldAlert className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                            </div>
                            <div className="flex-1">
                                <DialogTitle className={`text-xl font-bold ${hasAlarm ? 'text-red-900' : 'text-amber-900'}`}>
                                    {hasAlarm
                                        ? (isTaskDelay ? 'Action Required: Resolve Task Delays' : 'Action Required: Log Pending Hours')
                                        : 'Timesheet Entry Required'}
                                </DialogTitle>
                                <DialogDescription className={`text-sm mt-1 ${hasAlarm ? 'text-red-700' : 'text-amber-700'}`}>
                                    {hasAlarm
                                        ? (isTaskDelay
                                            ? "Critical: 3 Task delays detected. Admin has been notified. Work start is locked until reasons are provided."
                                            : "Severe Policy Violation: Multiple missing timesheets detected. Work tracking is locked until pending hours are logged.")
                                        : "You haven't logged your time yet. Please log your daily hours to continue."}
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {!showAppeal ? (
                            <>
                                <TimesheetEntryForm
                                    currentUser={currentUser}
                                    effectiveTenantId={effectiveTenantId}
                                    forceRemark={hasAlarm}
                                    hideCancel={hasAlarm}
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

                                            toast.success("Timesheet logged successfully. Alarms cleared.");
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
                            </>
                        ) : (
                            <div className="space-y-4">
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
            </DialogContent>
        </Dialog>
    );
}


