import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Global Confirmation Dialog Component
 * Used for all destructive/irreversible actions across the app
 * 
 * @param {boolean} open - Dialog open state
 * @param {function} onClose - Called when dialog is cancelled or closed
 * @param {function} onConfirm - Called when user confirms the action
 * @param {string} title - Dialog title (e.g., "Delete Project?")
 * @param {string} description - Explanation of what will happen
 * @param {string} confirmLabel - Text for confirm button (e.g., "Delete Project")
 * @param {string} confirmType - "danger" (red) or "warning" (orange)
 * @param {boolean} requiresTyping - If true, user must type keyword to confirm
 * @param {string} keyword - Keyword to type (e.g., "DELETE")
 * @param {boolean} loading - Shows loading state on confirm button
 * @param {boolean} allowEscapeKey - Allow ESC to close (default: true)
 */
export default function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Confirm",
  confirmType = "danger", // "danger" or "warning"
  requiresTyping = false,
  keyword = "DELETE",
  loading = false,
  allowEscapeKey = true,
}) {
  const [typedKeyword, setTypedKeyword] = useState("");
  const [isConfirmEnabled, setIsConfirmEnabled] = useState(!requiresTyping);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTypedKeyword("");
      setIsConfirmEnabled(!requiresTyping);
    }
  }, [open, requiresTyping]);

  // Validate typed keyword
  useEffect(() => {
    if (requiresTyping) {
      setIsConfirmEnabled(typedKeyword.trim() === keyword);
    }
  }, [typedKeyword, keyword, requiresTyping]);

  const handleConfirm = () => {
    if (isConfirmEnabled && !loading) {
      onConfirm();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && isConfirmEnabled && !loading) {
      handleConfirm();
    } else if (e.key === "Escape" && allowEscapeKey && !loading) {
      onClose();
    }
  };

  const confirmButtonClass = confirmType === "danger"
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "bg-amber-600 hover:bg-amber-700 text-white";

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && onClose()}>
      <AlertDialogContent className="max-w-md" onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              confirmType === "danger" ? "bg-red-100" : "bg-amber-100"
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                confirmType === "danger" ? "text-red-600" : "text-amber-600"
              }`} />
            </div>
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-slate-600 leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTyping && (
          <div className="py-4 space-y-2">
            <p className="text-sm text-slate-700">
              Type <span className="font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded">{keyword}</span> to confirm:
            </p>
            <Input
              value={typedKeyword}
              onChange={(e) => setTypedKeyword(e.target.value)}
              placeholder={`Type ${keyword}`}
              className="font-mono"
              disabled={loading}
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || loading}
            className={`${confirmButtonClass} min-w-[100px]`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}