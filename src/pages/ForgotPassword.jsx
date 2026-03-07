import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
// CHANGED: Replaced Sparkles with Sprout
import { Loader2, Mail, ArrowLeft, CheckCircle2, Sprout, AlertCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

import { API_BASE } from "@/api/groonabackend";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setSubmitted(true);
      toast.success('Reset link sent!');

    } catch (error) {
      console.error('[ForgotPassword] Error:', error);
      setError(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-[440px] relative z-10">
        <Card className="bg-white/70 backdrop-blur-3xl border-white/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden">
          <CardHeader className="text-center pt-12 pb-8 px-8 flex flex-col items-center">
            {/* Logo Container */}
            <div className="h-20 w-20 rounded-[1.75rem] bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-8 border border-white/20 transform hover:scale-105 transition-transform duration-300">
              <Sprout className="h-10 w-10 text-white" />
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl font-black text-slate-900 tracking-tight">
                Forgot Password?
              </CardTitle>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                {submitted
                  ? "Check your inbox for instructions"
                  : "We'll send you a secure link to reset it"
                }
              </p>
            </div>
          </CardHeader>

          <CardContent className="px-10 pb-12">
            {submitted ? (
              <div className="space-y-8">
                <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-[2rem] flex flex-col items-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-1">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-emerald-900 font-bold text-sm leading-relaxed">
                    If an account exists for <span className="text-emerald-600 break-all">{email}</span>, you'll see a reset link in your inbox shortly.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSubmitted(false)}
                    className="w-full h-14 rounded-2xl border-slate-200 font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Try another email
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(createPageUrl("SignIn"))}
                    className="w-full h-12 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Account Email
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none group-focus-within:text-blue-600 transition-colors text-slate-400">
                      <Mail className="h-5 w-5" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      className="h-14 pl-12 pr-4 bg-slate-50/50 border-slate-200/60 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 focus-visible:ring-blue-500/10 focus-visible:border-blue-500/30 transition-all w-full"
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98] border-0"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin opacity-70" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => navigate(createPageUrl("SignIn"))}
                      className="inline-flex items-center gap-2 text-[11px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-all duration-200 group"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                      Return to Secure Login
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

