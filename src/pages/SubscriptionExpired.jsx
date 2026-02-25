import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, AlertTriangle } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";

export default function SubscriptionExpired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border-red-200 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900">Subscription Expired</CardTitle>
            <CardDescription className="text-lg mt-2">
              Your trial period has ended.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-red-50 p-4 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800">
              Access to the platform is restricted until your subscription is updated. Please contact support or your administrator to upgrade your plan.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={() => window.location.href = 'mailto:support@base44.com'}
            >
              Contact Support
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => groonabackend.auth.logout()}
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

