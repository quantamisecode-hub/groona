import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, UserCheck, ShieldCheck, Lightbulb } from "lucide-react";
import { groonabackend } from '@/api/groonabackend';
import { toast } from 'sonner';

export default function ReworkActionDialog({
    open,
    onClose,
    notification,
    reworkEntry, // New prop for specific task
    users = [], // List of possible reviewers
    currentUser,
    onActionComplete,
    initialAction // Prop to pre-select action
}) {
    const [loading, setLoading] = useState(false);
    const [actions, setActions] = useState({
        peerReview: initialAction === 'peerReview',
        improveTesting: false
    });

    // Reset state when dialog opens
    React.useEffect(() => {
        if (open) {
            setActions({
                peerReview: initialAction === 'peerReview',
                improveTesting: false
            });
            setReviewerEmail("");
            setComment("");
        }
    }, [open, initialAction]);
    const [reviewerEmail, setReviewerEmail] = useState("");
    const [comment, setComment] = useState("");

    const handleSubmit = async () => {
        if (actions.peerReview && !reviewerEmail) {
            toast.error("Please select a reviewer for the Peer Review.");
            return;
        }

        if (!actions.peerReview && !actions.improveTesting) {
            toast.error("Please select at least one action taken.");
            return;
        }

        setLoading(true);
        try {
            // 1. Update the Notification Status IF notification exists
            if (notification) {
                await groonabackend.entities.Notification.update(notification.id, {
                    status: 'RESOLVED',
                    appeal_reason: JSON.stringify({
                        actions: [
                            actions.peerReview ? 'Peer Review Requested' : null,
                            actions.improveTesting ? 'Improved Testing' : null
                        ].filter(Boolean),
                        reviewer: reviewerEmail,
                        comment: comment
                    }),
                    appealed_at: new Date().toISOString()
                });
            }

            // 2. If Peer Review, create PeerReviewRequest
            if (actions.peerReview && reviewerEmail) {
                // Determine IDs from reworkEntry (preferred) or notification
                const taskId = reworkEntry ? reworkEntry.task_id : (notification ? notification.entity_id : null);
                const taskTitle = reworkEntry ? reworkEntry.task_title : (notification ? "Rework Task" : "Rework Task"); // Fallback
                const projectName = reworkEntry ? reworkEntry.project_name : "Project";

                await groonabackend.entities.PeerReviewRequest.create({
                    tenant_id: currentUser.tenant_id || (notification ? notification.tenant_id : null),
                    requester_email: currentUser.email,
                    requester_name: currentUser.full_name,
                    reviewer_email: reviewerEmail,
                    task_id: taskId,
                    task_title: taskTitle,
                    project_name: projectName,
                    message: comment || 'General Code Quality',
                    status: 'PENDING'
                });

                // ALWAYS send a notification to the reviewer
                await groonabackend.entities.Notification.create({
                    tenant_id: currentUser.tenant_id,
                    recipient_email: reviewerEmail,
                    type: 'rework_peer_review',
                    category: 'action_request',
                    title: 'Peer Review Requested',
                    message: `${currentUser.full_name} has requested a peer review for ${taskTitle}. Click to view in Rework Reviews tab.`,
                    entity_type: 'peer_review_request',
                    entity_id: currentUser.id, // Linking to user for avatar/profile
                    link: '/timesheets?tab=rework-reviews',
                    scope: 'user',
                    sender_name: currentUser.full_name,
                    status: 'OPEN'
                });
            }

            if (notification) {
                toast.success("Action logged. Escalation paused.");
            }

            if (onActionComplete) onActionComplete();
            onClose();

        } catch (error) {
            console.error("Failed to submit rework action:", error);
            toast.error("Failed to submit action.");
        } finally {
            setLoading(false);
        }
    };

    const isTaskContext = !!reworkEntry;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isTaskContext ? "text-blue-600" : "text-amber-600"}`}>
                        {isTaskContext ? <UserCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        {isTaskContext ? "Request Peer Review" : "High Rework Detected"}
                    </DialogTitle>
                    <DialogDescription>
                        {isTaskContext
                            ? `Requesting review for task: "${reworkEntry.task_title}"`
                            : "Your rework percentage exceeds 15%. Required action is needed to prevent escalation to PM review."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="bg-amber-50 p-3 rounded-md flex gap-2 text-sm text-amber-800 border border-amber-200">
                        <Lightbulb className="h-5 w-5 flex-shrink-0" />
                        <p className="font-medium">Tip: Talking to a peer often spots issues early.</p>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-sm font-semibold text-slate-700">Required Action</Label>

                        {/* Peer Review Option */}
                        <div className="flex items-start space-x-2 border rounded-md p-3 hover:bg-slate-50 transition-colors">
                            <Checkbox
                                id="peer-review"
                                checked={actions.peerReview}
                                onCheckedChange={(c) => setActions(prev => ({ ...prev, peerReview: c }))}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="peer-review"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                                >
                                    <UserCheck className="h-4 w-4 text-blue-500" />
                                    Request Peer Review (Recommended)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Get a fresh pair of eyes on your code changes.
                                </p>
                            </div>
                        </div>

                        {/* Improve Testing Option */}
                        <div className="flex items-start space-x-2 border rounded-md p-3 hover:bg-slate-50 transition-colors">
                            <Checkbox
                                id="improve-testing"
                                checked={actions.improveTesting}
                                onCheckedChange={(c) => setActions(prev => ({ ...prev, improveTesting: c }))}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="improve-testing"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                                >
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                    Improve Testing Coverage
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Add more unit tests or manual verification steps.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Conditional Reviewer Selection */}
                    {actions.peerReview && (
                        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-2">
                                <Label>Suggested Reviewer</Label>
                                <Select value={reviewerEmail} onValueChange={setReviewerEmail}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a team member..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users
                                            .filter(u => u.email !== currentUser.email) // Exclude self
                                            .map(u => (
                                                <SelectItem key={u.id} value={u.email}>
                                                    {u.full_name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Message to Reviewer (Optional)</Label>
                                <Textarea
                                    placeholder="What should the reviewer focus on?"
                                    className="h-20"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
                        {loading ? "Submitting..." : "Submit Action"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


