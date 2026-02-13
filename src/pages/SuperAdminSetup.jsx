import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle2, AlertCircle, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminSetup() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [alreadySuperAdmin, setAlreadySuperAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await groonabackend.auth.me();
      setCurrentUser(user);
      
      if (user.is_super_admin) {
        setAlreadySuperAdmin(true);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
      toast.error("Failed to load user information");
    } finally {
      setLoading(false);
    }
  };

  const promoteToSuperAdmin = async () => {
    setPromoting(true);
    try {
      // Update current user to Super Admin
      await groonabackend.auth.updateMe({
        is_super_admin: true,
        role: 'admin',
      });

      toast.success("🎉 You are now a Super Admin!");
      
      // Wait a moment and reload
      setTimeout(() => {
        window.location.href = createPageUrl("SuperAdminDashboard");
      }, 1500);
    } catch (error) {
      console.error("Failed to promote to Super Admin:", error);
      toast.error("Failed to promote to Super Admin: " + (error.message || "Please try again"));
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mx-auto mb-4">
              <Crown className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl">You're Already a Super Admin!</CardTitle>
            <CardDescription>
              You already have Super Admin privileges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your account is configured with Super Admin access. You can now manage all tenants and access the Super Admin Dashboard.
              </AlertDescription>
            </Alert>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => navigate(createPageUrl("SuperAdminDashboard"))}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                Go to Super Admin Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(createPageUrl("Dashboard"))}
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mx-auto mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-3xl">Super Admin Setup</CardTitle>
          <CardDescription>
            One-time setup to grant Super Admin privileges
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current User Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Current User Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Name:</span>
                <span className="font-medium text-slate-900">{currentUser?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Email:</span>
                <span className="font-medium text-slate-900">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Current Role:</span>
                <span className="font-medium text-slate-900 capitalize">{currentUser?.role || 'user'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Super Admin:</span>
                <span className="font-medium text-slate-900">
                  {currentUser?.is_super_admin ? 'Yes ✓' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Important:</strong> Super Admin privileges grant full access to all tenants, 
              users, and system-wide settings. Only grant this to trusted administrators.
            </AlertDescription>
          </Alert>

          {/* What You'll Get */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Super Admin Capabilities:</h3>
            <div className="grid gap-3">
              {[
                'Manage all tenants across the platform',
                'Create, edit, and delete tenant accounts',
                'View platform-wide statistics and analytics',
                'Access all tenant data and resources',
                'Configure subscription plans and limits',
                'Manage feature flags for tenants',
              ].map((capability, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{capability}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={promoteToSuperAdmin}
              disabled={promoting}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-6 text-lg font-semibold"
            >
              {promoting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Promoting to Super Admin...
                </>
              ) : (
                <>
                  <Crown className="h-5 w-5 mr-2" />
                  Promote Me to Super Admin
                </>
              )}
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-center text-sm text-slate-600">
            <p>
              After promotion, you'll be redirected to the Super Admin Dashboard.
              <br />
              <span className="text-xs">You can access this page at: <code className="bg-slate-100 px-2 py-0.5 rounded">/SuperAdminSetup</code></span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

