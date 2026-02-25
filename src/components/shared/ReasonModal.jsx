import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const ReasonModal = ({ isOpen, onClose, onConfirm, title = "Reason Required", description = "Please provide a reason for this change." }) => {
    const [reason, setReason] = useState("");

    const handleConfirm = () => {
        if (reason.trim().length >= 5) {
            onConfirm(reason);
            setReason(""); // reset for next time
        }
    };

    const handleClose = () => {
        setReason("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="Enter reason (min 5 characters)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full min-h-[100px]"
                        autoFocus
                    />
                    {reason.trim().length > 0 && reason.trim().length < 5 && (
                        <p className="text-red-500 text-xs mt-2">Reason must be at least 5 characters long.</p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={reason.trim().length < 5}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReasonModal;
