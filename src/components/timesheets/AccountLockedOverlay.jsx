import React, { useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";

export default function AccountLockedOverlay({ currentUser, timesheetAlerts, onBackfillSuccess }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAppeal, setShowAppeal] = useState(false);
    const [appealReason, setAppealReason] = useState("");

    const isLockoutAppealed = timesheetAlerts.some(n => n.type === 'timesheet_lockout_alarm' && n.status === 'APPEALED');

    const handleAppeal = async () => {
        setIsSubmitting(true);
        try {
            const now = new Date().toISOString();
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
            if (onBackfillSuccess) onBackfillSuccess();
        } catch (e) {
            console.error(e);
            toast.error("Failed to send request.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white max-w-md w-full rounded-xl shadow-2xl overflow-hidden border border-red-200">
                <div className="p-6 bg-red-50 border-b border-red-100 text-center">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-red-900 mb-2">
                        Account Locked
                    </h2>
                    <p className="text-red-700 text-sm">
                        You have ignored over 3 timesheet alerts. Your account access is suspended until further notice.
                    </p>
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
                                        onClick={handleAppeal}
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
        </div>
    );
}
