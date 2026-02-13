import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageUrl } from "@/utils";
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Building2 } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Extract params from URL
  const email = searchParams.get("email");
  const tenantId = searchParams.get("tenant_id");
  const role = searchParams.get("role");
  const customRole = searchParams.get("custom_role");
  const fullNameParam = searchParams.get("full_name");
  const workingFrom = searchParams.get("working_from");
  const workingTo = searchParams.get("working_to");
  const workingDaysParam = searchParams.get("working_days");

  const [formData, setFormData] = useState({
    fullName: fullNameParam || "",
    password: "",
    confirmPassword: ""
  });

  useEffect(() => {
    if (!email || !tenantId) {
      setError("Invalid invitation link. Missing required information.");
    }
  }, [email, tenantId]);

  const handleAccept = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      // Call API
      const response = await groonabackend.auth.acceptInvite({
        email,
        password: formData.password,
        full_name: formData.fullName,
        tenant_id: tenantId,
        role: role || 'member',
        custom_role: customRole || 'viewer',
        working_hours_start: workingFrom,
        working_hours_end: workingTo,
        working_days: workingDaysParam ? workingDaysParam.split(',') : []
      });

      // Check for token and force login
      if (response.token) {
        localStorage.setItem('auth_token', response.token);

        toast.success("Invitation accepted! Welcome to your new workspace.");

        // CRITICAL FIX: Force Hard Refresh to Dashboard
        // This skips the "UserOnboarding" loop and ensures new permissions are loaded
        window.location.href = createPageUrl("Dashboard");
      }
    } catch (error) {
      console.error('Accept invite error:', error);
      const msg = error.response?.data?.msg || 'Failed to accept invitation. The link may be expired or invalid.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!email || !tenantId) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Invalid invitation link. Please request a new invitation.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
          Join your team
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Create your account to join the organization
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/60 sm:rounded-lg sm:px-10 border border-slate-100">

          <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-800 font-medium">
              <Building2 className="h-4 w-4" />
              <span>Invitation Details</span>
            </div>
            <div className="space-y-1 text-sm text-blue-700">
              <p><strong>Email:</strong> {email}</p>
              <p><strong>Role:</strong> {(customRole || role || 'Member').replace('_', ' ')}</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleAccept}>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <div className="mt-1">
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Create Password</Label>
              <div className="mt-1">
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={8}
                  required
                  placeholder="Min 8 characters"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="mt-1">
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  placeholder="Re-enter password"
                />
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept & Join
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

