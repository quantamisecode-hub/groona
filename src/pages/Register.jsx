import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageUrl } from "@/utils";
import { Sparkles, Loader2, Eye, EyeOff, CheckCircle2, Mail, ArrowLeft, Check, TrendingUp, Users, Briefcase } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);
  const [showOTPFields, setShowOTPFields] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [resendingOTP, setResendingOTP] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [emailError, setEmailError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    companyName: '',
    teamSize: '',
    acceptTerms: false
  });

  // Reset verification when email changes
  useEffect(() => {
    if (formData.email) {
      setEmailVerified(false);
      setVerificationToken(null);
      setShowOTPFields(false);
      setOtp(['', '', '', '', '', '']);
    }
  }, [formData.email]);

  const handleSendOTP = async () => {
    if (!formData.email) {
      toast.error('Please enter your email address first');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSendingOTP(true);
    setEmailError(false);
    try {
      await groonabackend.auth.sendEmailVerificationOTP(formData.email);
      toast.success('Verification code sent to your email');
      setShowOTPFields(true);
      setResendCooldown(60); // 60 second cooldown
      // Focus first OTP input
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      console.error('Send OTP error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send verification code';
      toast.error(errorMessage);
    } finally {
      setSendingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || resendingOTP) return;

    setResendingOTP(true);
    setEmailError(false);
    try {
      await groonabackend.auth.sendEmailVerificationOTP(formData.email);
      toast.success('New verification code sent to your email');
      setResendCooldown(60); // 60 second cooldown
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      console.error('Resend OTP error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to resend verification code';
      toast.error(errorMessage);
    } finally {
      setResendingOTP(false);
    }
  };

  const handleOTPChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setVerifyingOTP(true);
    try {
      const response = await groonabackend.auth.verifyEmailOTP(formData.email, otpString);
      if (response.success && response.verificationToken) {
        setEmailVerified(true);
        setVerificationToken(response.verificationToken);
        setShowOTPFields(false);
        toast.success('Email verified successfully!');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Invalid verification code';
      toast.error(errorMessage);
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!formData.acceptTerms) {
      toast.error('Please accept the Terms and Privacy Policy');
      return;
    }

    if (!emailVerified || !verificationToken) {
      setEmailError(true);
      toast.error('Please verify your email address before registering');
      return;
    }

    setLoading(true);

    try {
      const response = await groonabackend.auth.register({
        email: formData.email,
        password: formData.password,
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        company_name: formData.companyName,
        team_size: formData.teamSize,
        verificationToken: verificationToken
      });

      if (response.token) {
        localStorage.setItem('auth_token', response.token);
        toast.success("Account created successfully!");
        setTimeout(() => {
          window.location.href = createPageUrl("TenantOnboarding");
        }, 100);
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      {/* Left Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center py-12 px-8 sm:px-12 lg:px-24 overflow-y-auto scrollbar-hide relative overflow-hidden bg-slate-50/50">
        {/* Subtle Background Shadows/Blobs */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 30, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-50/50 rounded-full blur-[120px] pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            x: [0, -20, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-purple-50/40 rounded-full blur-[100px] pointer-events-none"
        />

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full mx-auto relative z-10"
        >
          {/* Back btn */}
          <Link to={createPageUrl("SignIn")} className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-semibold">Back to Login</span>
          </Link>

          {/* Logo */}
          <div className="mb-10 flex flex-col items-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Groona</span>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h1>
            <p className="text-slate-500">Join thousands of teams delivering results with Groona.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSignUp}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fname" className="text-xs font-bold uppercase tracking-widest text-slate-400">First Name</Label>
                <Input
                  id="fname"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="John"
                  className="border-0 border-b-2 border-slate-100 rounded-none focus-visible:ring-0 focus-visible:border-blue-600 transition-all bg-transparent py-4 h-auto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lname" className="text-xs font-bold uppercase tracking-widest text-slate-400">Last Name</Label>
                <Input
                  id="lname"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Doe"
                  className="border-0 border-b-2 border-slate-100 rounded-none focus-visible:ring-0 focus-visible:border-blue-600 transition-all bg-transparent py-4 h-auto"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-400">Work Email</Label>
              <div className="relative group">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={emailVerified}
                  placeholder="name@company.com"
                  className={`border-0 border-b-2 rounded-none focus-visible:ring-0 transition-all bg-transparent py-4 h-auto pr-24 ${emailVerified ? 'border-green-200 text-green-700 bg-green-50/30' : 'border-slate-100 focus-visible:border-blue-600'}`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  {emailVerified ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <Check className="h-3 w-3 stroke-[3px]" /> Verified
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={sendingOTP || !formData.email}
                      className="h-8 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm"
                    >
                      {sendingOTP ? <Loader2 className="h-3 w-3 animate-spin" /> : 'VERIFY'}
                    </Button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {showOTPFields && !emailVerified && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-slate-50 space-y-4"
                  >
                    <div className="text-center">
                      <Label className="text-xs font-bold uppercase tracking-widest text-blue-600">Verification Code</Label>
                      <p className="text-[10px] text-slate-500 mt-1">We sent a 6-digit code to {formData.email}</p>
                    </div>

                    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (otpInputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOTPChange(index, e.target.value)}
                          onKeyDown={(e) => handleOTPKeyDown(index, e)}
                          className="w-10 h-10 text-center text-lg font-bold border-2 border-slate-100 rounded-lg focus:border-blue-600 focus:outline-none transition-all shadow-sm"
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2 justify-center">
                      <Button
                        type="button"
                        onClick={handleVerifyOTP}
                        disabled={verifyingOTP || otp.join('').length !== 6}
                        className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-blue-200 shadow-lg text-xs"
                      >
                        {verifyingOTP ? <Loader2 className="h-3 w-3 animate-spin" /> : 'VERIFY CODE'}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendingOTP || resendCooldown > 0}
                        variant="ghost"
                        className="h-9 px-4 text-xs font-bold text-slate-500"
                      >
                        {resendCooldown > 0 ? `RESEND IN ${resendCooldown}s` : 'RESEND CODE'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-400">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={8}
                  required
                  placeholder="••••••••"
                  className="border-0 border-b-2 border-slate-100 rounded-none focus-visible:ring-0 focus-visible:border-blue-600 transition-all bg-transparent py-4 h-auto pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked })}
                required
                className="mt-1 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label htmlFor="terms" className="text-xs font-medium text-slate-500 leading-relaxed cursor-pointer select-none">
                I agree to the <a href="#" className="text-blue-600 font-bold hover:underline">Terms</a> and <a href="#" className="text-blue-600 font-bold hover:underline">Privacy Policy</a>. We'll use your data to provide our services.
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || !emailVerified}
              className={`w-full py-4 h-auto text-lg font-bold shadow-xl transition-all active:scale-[0.98] ${emailVerified ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-blue-500/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  CREATING ACCOUNT...
                </>
              ) : (
                "CREATE ACCOUNT"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to={createPageUrl("SignIn")} className="text-blue-600 font-bold hover:underline">
              Log in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right Side: Visual Hero */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 opacity-90" />

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-[700px] h-[700px] bg-white/5 rounded-full blur-3xl"
        />

        <div className="relative z-10 w-full max-w-lg px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="mb-12">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-8 shadow-2xl">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-4xl font-extrabold text-white mb-6">
                Redefining Delivery for Modern Teams
              </h2>
              <div className="w-16 h-1 bg-white/20 rounded-full mb-8" />
            </div>

            <div className="space-y-8">
              {[
                { icon: TrendingUp, title: "Velocity Tracking", desc: "Monitor your team's speed and delivery health in real-time." },
                { icon: Users, title: "Client Portals", desc: "Give clients the transparency they need without the meetings." },
                { icon: Briefcase, title: "Resource Planning", desc: "Balance workloads and predict upcoming capacity needs." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <item.icon className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">{item.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

