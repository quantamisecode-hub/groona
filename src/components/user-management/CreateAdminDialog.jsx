import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle, Mail, ExternalLink } from "lucide-react";

export default function CreateAdminDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Create Admin User
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Invite a new admin with custom permissions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <Alert className="bg-blue-50 border-blue-200">
            <Mail className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              To create a new admin, you need to invite them through the groonabackend Dashboard.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-slate-900">Steps to create an admin:</h3>
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">1</span>
                  <span>Go to the groonabackend Dashboard (click the button below)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">2</span>
                  <span>Navigate to <strong>Users</strong> section</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">3</span>
                  <span>Click <strong>Invite User</strong> and enter their email</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">4</span>
                  <span>Select <strong>Admin</strong> role when inviting</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">5</span>
                  <span>After they accept, return here to configure their permissions</span>
                </li>
              </ol>
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <strong>Note:</strong> New admins will have no permissions by default. You'll need to configure their permissions after they accept the invitation.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                window.open('https://app.base44.com/dashboard', '_blank');
                onClose();
              }}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
