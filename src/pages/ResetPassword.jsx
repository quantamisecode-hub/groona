import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
// CHANGED: Replaced Sparkles with Sprout, added Eye and EyeOff
import { Loader2, Lock, CheckCircle2, XCircle, Sprout, Eye, EyeOff, AlertCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

import { API_BASE } from "@/api/groonabackend";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    number: false,
    match: false
  });

  useEffect(() => {
    if (!token) {
      navigate(createPageUrl("SignIn"));
    }
  }, [token, navigate]);

  useEffect(() => {
    setValidations({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      match: password === confirmPassword && password.length > 0
    });
  }, [password, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!validations.length || !validations.uppercase || !validations.number) {
      setError('Please meet all password requirements');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => {
        navigate(createPageUrl("SignIn"));
      }, 3000);

    } catch (error) {
      console.error('[ResetPassword] Error:', error);
      setError(error.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ isValid, text }) => (
    <div className="flex items-center gap-2.5">
      <div className={`h-4 w-4 rounded-full flex items-center justify-center transition-all duration-300 ${isValid ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        {isValid ? (
          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
        ) : (
          <div className="h-1 w-1 bg-slate-300 rounded-full" />
        )}
      </div>
      <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors duration-300 ${isValid ? 'text-emerald-600' : 'text-slate-400'}`}>
        {text}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-400/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-[440px] relative z-10">
        <Card className="bg-white/70 backdrop-blur-3xl border-white/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden">
          <CardHeader className="text-center pt-10 pb-6 px-8 flex flex-col items-center">
            {/* Logo Container */}
            <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6 border border-white/20">
              <Sprout className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-2">
              <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">
                Reset Password
              </CardTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                {success
                  ? "Identity verified & updated"
                  : "Create a strong new password"
                }
              </p>
            </div>
          </CardHeader>

          <CardContent className="px-10 pb-10">
            {success ? (
              <div className="space-y-6">
                <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-[2rem] flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-1 animate-bounce">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-emerald-900 font-black uppercase tracking-widest text-sm">Success!</h3>
                    <p className="text-emerald-700/80 font-bold text-xs leading-relaxed max-w-[200px]">
                      Your credentials have been securely updated. Redirecting...
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => navigate(createPageUrl("SignIn"))}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  Go To Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] font-black text-red-600 flex items-center gap-2 uppercase tracking-wide">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  </div>
                )}

                <div className="space-y-5">
                  {/* New Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                      New Password
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                        className="h-14 pl-12 pr-12 bg-slate-50/50 border-slate-200/60 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 focus-visible:ring-blue-500/10 focus-visible:border-blue-500/30 transition-all w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                      Confirm Password
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        required
                        className="h-14 pl-12 pr-12 bg-slate-50/50 border-slate-200/60 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 focus-visible:ring-blue-500/10 focus-visible:border-blue-500/30 transition-all w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Requirements - Modern Grid Style */}
                <div className="p-5 bg-slate-50/80 border border-slate-100 rounded-[2rem] space-y-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200/60 pb-2">
                    Security check
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <ValidationItem isValid={validations.length} text="8+ characters" />
                    <ValidationItem isValid={validations.uppercase} text="Uppercase" />
                    <ValidationItem isValid={validations.number} text="Contains number" />
                    <ValidationItem isValid={validations.match} text="Match found" />
                  </div>
                </div>

                <div className="space-y-6 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !Object.values(validations).every(v => v)}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98] border-0"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin opacity-70" />
                        <span>Updating...</span>
                      </div>
                    ) : (
                      'Secure Update'
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => navigate(createPageUrl("SignIn"))}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-all"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer Info */}
        <p className="text-center mt-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
          Powered by Groona AI &bull; Secure Authentication
        </p>
      </div>
    </div>
  );
}

