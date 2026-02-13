import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createPageUrl } from "@/utils";
import { Sprout, Github, Mail, Loader2, Eye, EyeOff } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { getOtpEmailTemplate } from "@/utils/emailTemplates";

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });
  
  const [showPassword, setShowPassword] = useState(false);

  // --- AUTO LOGIN LOGIC ---
  useEffect(() => {
    const autoLogin = searchParams.get('autoLogin');
    const emailParam = searchParams.get('email');
    const passwordParam = searchParams.get('password');

    if (autoLogin === 'true' && emailParam && passwordParam) {
      setFormData({ email: emailParam, password: passwordParam });
      performAutoLogin(emailParam, passwordParam);
    }
  }, [searchParams]);

  const performAutoLogin = async (email, password) => {
    setLoading(true);
    setError('');

    try {
      const response = await groonabackend.auth.login(
        email, 
        password, 
        getOtpEmailTemplate('{{OTP}}')
      );

      if (response.require_otp) {
        navigate(createPageUrl("VerifyOTP"), { 
          state: { email: email }
        });
        return;
      }

      if (response.token) {
        if (response.user && response.user.is_super_admin) {
          window.location.href = createPageUrl("SuperAdminDashboard");
        } else if (response.user && response.user.custom_role === 'client') {
          window.location.href = createPageUrl("ClientDashboard");
        } else {
          window.location.href = createPageUrl("Dashboard");
        }
        return;
      }
    } catch (error) {
      console.error('[AutoSignIn] Error:', error);
      // Don't show error immediately on auto-login failure, just let user try manually
      // or show a subtle message
      setError("Auto-login failed. Please enter your credentials manually.");
      setLoading(false);
    }
  };
  // ------------------------

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await groonabackend.auth.login(
        formData.email, 
        formData.password, 
        getOtpEmailTemplate('{{OTP}}')
      );

      if (response.require_otp) {
        navigate(createPageUrl("VerifyOTP"), { 
          state: { email: formData.email }
        });
        return;
      }

      if (response.token) {
        if (response.user && response.user.is_super_admin) {
          window.location.href = createPageUrl("SuperAdminDashboard");
        } else if (response.user && response.user.custom_role === 'client') {
          window.location.href = createPageUrl("ClientDashboard");
        } else {
          window.location.href = createPageUrl("Dashboard");
        }
        return;
      }

    } catch (error) {
      console.error('[SignIn] Error:', error);
      const msg = error.response?.data?.msg || 'Failed to sign in. Please check your credentials.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sprout className="h-5 w-5 text-white" />
              </div>
            </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to access your projects, tasks, and AI agents.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/60 sm:rounded-lg sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="mt-1">
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  autoComplete="email" 
                  required 
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-1 relative">
                <Input 
                  id="password" 
                  name="password" 
                  type={showPassword ? "text" : "password"} 
                  autoComplete="current-password" 
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                  className="pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => navigate(createPageUrl("ForgotPassword"))}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-slate-500">Secure 2-Step Verification</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500">
                Secure your account with 2FA in profile settings.
              </p>
            </div>
          </div>
          
           <div className="mt-6 text-center text-sm">
              <span className="text-slate-600">Don't have an account?</span>{' '}
              <Link to={createPageUrl("Register")} className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </div>
        </div>
      </div>
    </div>
  );
}

