import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { createPageUrl } from "@/utils";
import { Sparkles, Mail, Loader2, Eye, EyeOff, ArrowRight, Check, Rocket } from "lucide-react";
import { groonabackend } from "@/api/groonabackend";
import { getOtpEmailTemplate } from "@/utils/emailTemplates";
import { motion } from "framer-motion";
import { toast } from "sonner";

const GoogleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

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
      setError("Auto-login failed. Please enter your credentials manually.");
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!acceptTerms) {
      toast.error('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

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

  const handleGoogleLogin = async () => {
    if (!acceptTerms) {
      toast.error('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setGoogleLoading(true);
    // Placeholder for Google Auth logic - would typically redirect to backend oauth path
    setTimeout(() => {
      toast.info("Google Authentication is coming soon!");
      setGoogleLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* Left Panel: Branding & Welcome Message */}
      <div className="hidden md:flex md:w-[35%] lg:w-[30%] bg-slate-950 relative flex-col justify-between p-12 text-white overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-24">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Groona</span>
          </div>

          <div className="space-y-12">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl lg:text-5xl font-bold leading-[1.1] mb-6">
                  Connect to your <span className="text-blue-500">productive world.</span>
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Access your project insights, team updates, and AI-powered performance metrics in one secure place.
                </p>
              </motion.div>
            </div>

            <div className="space-y-8 pt-12 border-t border-white/10">
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Check className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-300">Secure AI-Powered Analytics</span>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Check className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-300">Real-time Team Collaboration</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Trusted by Industry Leaders</p>
          <div className="flex gap-4 opacity-50">
            {/* Simple visual placeholders for social proof */}
            <div className="h-6 w-20 bg-white/20 rounded" />
            <div className="h-6 w-20 bg-white/20 rounded" />
          </div>
        </div>

        {/* Decorative Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] aspect-square rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
      </div>

      {/* Right Panel: Content */}
      <main className="flex-1 flex flex-col relative h-screen bg-white overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg">Groona</span>
          </div>
          <Link to={createPageUrl("Register")} className="text-sm font-bold text-blue-600">
            Sign Up
          </Link>
        </div>

        {/* Top Navigation for Desktop */}
        <header className="hidden md:flex h-20 items-center justify-end px-12 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500">Don't have an account?</span>
            <Link to={createPageUrl("Register")}>
              <Button variant="outline" className="rounded-full px-6 font-bold border-slate-200 hover:border-blue-600 hover:text-blue-600 transition-all">
                Create Account
              </Button>
            </Link>
          </div>
        </header>

        {/* Form Content Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-xl px-8 py-12 md:py-24 space-y-12">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-blue-600 font-bold tracking-widest uppercase text-xs"
              >
                Welcome back
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                Log in to <span className="text-blue-600">Groona.</span>
              </h2>
              <p className="text-slate-500 text-xl leading-relaxed max-w-md">
                Enter your credentials to access your mission center and projects.
              </p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800 rounded-2xl">
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">
                    Work Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={loading}
                      className="h-14 pl-12 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-blue-600 rounded-2xl transition-all text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => navigate(createPageUrl("ForgotPassword"))}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      disabled={loading}
                      className="h-14 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-blue-600 rounded-2xl transition-all text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  <div className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20' : 'border-slate-200 bg-white group-hover:border-blue-400'}`}>
                    {rememberMe && <Check className="h-3.5 w-3.5 text-white stroke-[4px]" />}
                  </div>
                  <span className="text-sm font-bold text-slate-600 select-none">Remember this device</span>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked)}
                    required
                    className="mt-1 border-blue-200 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded-md"
                  />
                  <Label htmlFor="terms" className="text-xs font-medium text-slate-500 leading-relaxed cursor-pointer select-none">
                    I have read and agree to the <a href="#" className="text-blue-600 font-bold hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 font-bold hover:underline">Privacy Policy</a>.
                  </Label>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="flex-1 h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        Sign In Now
                        <ArrowRight className="h-6 w-6" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <div className="space-y-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-6 text-slate-400 font-bold tracking-widest">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={googleLoading}
                onClick={handleGoogleLogin}
                className="w-full h-16 text-lg font-bold border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 rounded-2xl transition-all hover:bg-blue-50/30 flex items-center justify-center gap-4 group"
              >
                {googleLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <GoogleIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                    Sign in with Google
                  </>
                )}
              </Button>
            </div>

            <footer className="pt-12 flex items-center justify-between border-t border-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Groona AI Intelligence
              </p>
              <button
                onClick={() => navigate(createPageUrl("AboutUs"))}
                className="text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors"
              >
                Need help signing in?
              </button>
            </footer>
          </div>
        </div>

        {/* Floating background details for the form area */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-[100px] pointer-events-none opacity-50" />
      </main>
    </div>
  );
}

