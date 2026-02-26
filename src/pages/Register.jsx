import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageUrl } from "@/utils";
import { Sparkles, Loader2, Eye, EyeOff, CheckCircle2, Mail, ArrowLeft, Check, TrendingUp, Users, Briefcase, Rocket, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* Left Panel: Branding & Value Proposition */}
      <div className="hidden md:flex md:w-[35%] lg:w-[30%] bg-slate-950 relative flex-col justify-between p-12 text-white overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-24">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Groona</span>
          </div>

          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl lg:text-5xl font-bold leading-[1.1] mb-6">
                Start your <span className="text-blue-500">delivery journey.</span>
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed">
                Join thousands of high-performing teams using Groona to accelerate project delivery and team collaboration.
              </p>
            </motion.div>

            <div className="space-y-8 pt-12 border-t border-white/10">
              {[
                { icon: TrendingUp, title: "Velocity Tracking", desc: "Real-time delivery health monitoring." },
                { icon: Users, title: "Client Portals", desc: "Seamless transparency for partners." },
                { icon: Briefcase, title: "Capacity Planning", desc: "Smart resource balancing." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <p className="text-xs font-medium text-slate-400 italic">
              "Groona has completely transformed how our team manages complex projects. The AI insights are a game changer."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10" />
              <div>
                <p className="text-[10px] font-bold">Sarah Chen</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">VP of Ops at TechFlow</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none text-white/5">
          <Sparkles className="absolute top-20 right-[-40px] w-64 h-64 -rotate-12" />
          <div className="absolute top-[-20%] left-[-20%] w-[80%] aspect-square rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] aspect-square rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
      </div>

      {/* Right Panel: Registration Form */}
      <main className="flex-1 flex flex-col relative h-full bg-white overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg">Groona</span>
          </div>
          <Link to={createPageUrl("SignIn")} className="text-sm font-bold text-blue-600">
            Log In
          </Link>
        </div>

        {/* Top Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-12 shrink-0">
          <Link to={createPageUrl("SignIn")} className="group flex items-center gap-4 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">
            <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Login
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500">Already a member?</span>
            <Link to={createPageUrl("SignIn")}>
              <Button variant="outline" className="rounded-full px-6 font-bold border-slate-200">
                Sign In
              </Button>
            </Link>
          </div>
        </header>

        {/* Form Area */}
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-8 py-12 md:py-20 space-y-12">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-blue-600 font-bold tracking-widest uppercase text-xs"
            >
              Get Started for Free
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
              Create your <span className="text-blue-600">workspace.</span>
            </h2>
            <p className="text-slate-500 text-xl max-w-md leading-relaxed">
              Let's set up your environment and invite your team. No credit card required.
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-10">
            {/* Identity Group */}
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fname" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">First Name</Label>
                  <Input
                    id="fname"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    placeholder="John"
                    className="h-14 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-blue-600 rounded-2xl transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lname" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Last Name</Label>
                  <Input
                    id="lname"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    placeholder="Doe"
                    className="h-14 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-blue-600 rounded-2xl transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Work Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={emailVerified}
                    placeholder="name@company.com"
                    className={`h-14 pl-12 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-blue-600 rounded-2xl transition-all pr-28 ${emailVerified ? 'bg-green-50/30' : ''}`}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    {emailVerified ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                      </div>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={sendingOTP || !formData.email}
                        variant="ghost"
                        className="h-9 px-4 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 rounded-xl transition-all"
                      >
                        {sendingOTP ? <Loader2 className="h-4 w-4 animate-spin" /> : 'VERIFY'}
                      </Button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {showOTPFields && !emailVerified && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-6 p-6 rounded-3xl bg-blue-50/50 border border-blue-100/50 space-y-6"
                    >
                      <div className="text-center space-y-1">
                        <Label className="text-xs font-bold uppercase tracking-widest text-blue-600">Enter Verification Code</Label>
                        <p className="text-[10px] text-slate-500 font-medium tracking-tight">Sent to {formData.email}</p>
                      </div>

                      <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
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
                            className="w-12 h-14 text-center text-xl font-bold border-2 border-white bg-white rounded-xl focus:border-blue-600 focus:outline-none transition-all shadow-sm"
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-3 justify-center">
                        <Button
                          type="button"
                          onClick={handleVerifyOTP}
                          disabled={verifyingOTP || otp.join('').length !== 6}
                          className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 text-xs"
                        >
                          {verifyingOTP ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Account'}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={resendingOTP || resendCooldown > 0}
                          variant="ghost"
                          className="h-10 px-4 text-xs font-bold text-slate-400 hover:text-slate-600"
                        >
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    minLength={8}
                    required
                    placeholder="••••••••"
                    className="h-14 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-blue-600 rounded-2xl transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[10px] font-medium text-slate-400 ml-1">Must be at least 8 characters</p>
              </div>
            </div>

            {/* Terms and Action */}
            <div className="space-y-8">
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked })}
                  required
                  className="mt-1 border-blue-200 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded-md"
                />
                <Label htmlFor="terms" className="text-xs font-medium text-slate-500 leading-relaxed cursor-pointer select-none">
                  By clicking Create Account, I agree to Groona's <a href="#" className="font-bold text-blue-600 hover:underline">Terms of Service</a> and acknowledge the <a href="#" className="font-bold text-blue-600 hover:underline">Privacy Policy</a>.
                </Label>
              </div>

              <div className="flex flex-col gap-6">
                <Button
                  type="submit"
                  disabled={loading || !emailVerified}
                  className={`h-16 text-lg font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 group flex items-center justify-center gap-3 ${emailVerified
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                >
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      Create My Workspace
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <p className="text-center text-sm font-medium text-slate-400">
                  Secured by enterprise-grade encryption and AI guardrails.
                </p>
              </div>
            </div>
          </form>

          <footer className="pt-12 text-center">
            <div className="flex items-center justify-center gap-8 opacity-20 filter grayscale mb-8">
              {/* Visual Brand logos mockup */}
              <div className="h-6 w-20 bg-slate-900 rounded" />
              <div className="h-6 w-20 bg-slate-900 rounded" />
              <div className="h-6 w-20 bg-slate-900 rounded" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">
              Powered by Groona Intelligence Platform
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

