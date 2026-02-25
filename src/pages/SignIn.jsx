import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { createPageUrl } from "@/utils";
import { Sparkles, Mail, Loader2, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
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
    <div className="min-h-screen bg-white flex overflow-hidden">
      {/* Left Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 relative overflow-hidden bg-slate-50/50">
        {/* Subtle Background Shadows/Blobs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-blue-100/50 rounded-full blur-[100px] pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -40, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-100/40 rounded-full blur-[100px] pointer-events-none"
        />

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full mx-auto relative z-10"
        >
          {/* Logo */}
          <div className="mb-12 flex flex-col items-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">Groona</span>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Sign In</h1>
            <p className="text-slate-500">Welcome back! Please enter your details.</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}



          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Email Address
              </Label>
              <div className="relative group">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                  className="pl-0 border-0 border-b-2 border-slate-100 rounded-none focus-visible:ring-0 focus-visible:border-blue-600 transition-all bg-transparent text-lg py-5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Password
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                  className="pl-0 pr-10 border-0 border-b-2 border-slate-100 rounded-none focus-visible:ring-0 focus-visible:border-blue-600 transition-all bg-transparent text-lg py-5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                  {rememberMe && <Check className="h-3 w-3 text-white stroke-[3px]" />}
                </div>
                <span className="text-sm font-medium text-slate-600 select-none">Remember Me</span>
              </div>

              <button
                type="button"
                onClick={() => navigate(createPageUrl("ForgotPassword"))}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked)}
                required
                className="mt-1 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label htmlFor="terms" className="text-xs font-medium text-slate-500 leading-relaxed cursor-pointer select-none">
                I agree to the <a href="#" className="text-blue-600 font-bold hover:underline">Terms</a> and <a href="#" className="text-blue-600 font-bold hover:underline">Privacy Policy</a>.
              </label>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 h-auto text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "LOGIN"
                )}
              </Button>

              <Link to={createPageUrl("Register")} className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-4 h-auto text-base font-bold border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 transition-all active:scale-[0.98]"
                >
                  CREATE ACCOUNT
                </Button>
              </Link>
            </div>
          </form>

          <div className="my-8">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Or login with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={googleLoading}
              onClick={handleGoogleLogin}
              className="w-full py-4 h-auto text-base font-bold border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5" />
                  Sign in with Google
                </>
              )}
            </Button>
          </div>

          <div className="mt-12 text-center text-sm">
            <p className="text-slate-500 mb-4">
              Forgotten your login details?{" "}
              <button
                onClick={() => navigate(createPageUrl("AboutUs"))}
                className="text-blue-600 font-bold hover:underline"
              >
                Get Help Signing In
              </button>
            </p>
          </div>
        </motion.div>
      </div>


      {/* Right Side: Visual Hero */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
        {/* Background Gradient & Animated Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 opacity-90" />

        {/* Abstract Background Shapes */}
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-white/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            rotate: [360, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-3xl"
        />

        {/* Content */}
        <div className="relative z-10 text-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="mb-8 flex justify-center">
              <div className="h-24 w-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
            </div>

            <p className="text-white/60 font-bold tracking-[0.3em] uppercase mb-4">Welcome to</p>
            <h2 className="text-5xl font-extrabold text-white mb-6 tracking-tight">
              Groona Management
            </h2>
            <div className="w-24 h-1.5 bg-white/20 mx-auto rounded-full mb-8" />
            <p className="text-xl text-white/80 max-w-md mx-auto leading-relaxed">
              Login to access your personalized project dashboard and AI-powered insights.
            </p>
          </motion.div>

          {/* Decorative Elements */}
          <div className="mt-16 grid grid-cols-3 gap-6 opacity-40">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-1 bg-white/30 rounded-full" />
            ))}
          </div>
        </div>

        {/* Floating Icons for depth */}
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-20 text-white/10"
        >
          <Sparkles size={120} />
        </motion.div>
      </div>
    </div>
  );
}

