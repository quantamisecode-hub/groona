import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageUrl } from "@/utils";
import { Sprout, Loader2, Eye, EyeOff, CheckCircle2, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";

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
    // Only allow numeric input
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index, e) => {
    // Handle backspace
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

    // STRICT: Check email verification
    if (!emailVerified || !verificationToken) {
      setEmailError(true);
      toast.error('Please verify your email address before registering', {
        style: {
          background: '#fee2e2',
          color: '#dc2626',
          border: '1px solid #fca5a5'
        }
      });
      return;
    }

    setEmailError(false);

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
          navigate(createPageUrl("TenantOnboarding"));
        }, 100);
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed. Please try again or use a different email.';
      toast.error(errorMessage);
    } finally {
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
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Get started with Aivora in minutes
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/60 sm:rounded-lg sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSignUp}>
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fname">First Name</Label>
                  <div className="mt-1">
                    <Input 
                      id="fname" 
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                 <div>
                  <Label htmlFor="lname">Last Name</Label>
                  <div className="mt-1">
                    <Input 
                      id="lname" 
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      required 
                    />
                  </div>
                </div>
            </div>

            <div>
              <Label htmlFor="email">Work Email</Label>
              <div className="mt-1 relative">
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({...formData, email: e.target.value});
                    setEmailError(false);
                  }}
                  required
                  disabled={emailVerified}
                  className={
                    emailError 
                      ? "pr-10 bg-red-50 border-red-300 focus:border-red-500 focus:ring-red-500" 
                      : emailVerified 
                        ? "pr-10 bg-green-50 border-green-300" 
                        : "pr-24"
                  }
                  placeholder="Enter your work email"
                />
                {emailVerified ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                ) : (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={sendingOTP || !formData.email}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      {sendingOTP ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </Button>
                  </div>
                )}
              </div>
              {emailError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  Please verify your email address before registering
                </p>
              )}
              {emailVerified && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Email verified
                </p>
              )}
              
              {/* OTP Input Fields */}
              {showOTPFields && !emailVerified && (
                <div className="mt-4 space-y-3">
                  <Label className="text-sm font-medium">Enter verification code</Label>
                  <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => (otpInputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        className="text-center text-base font-semibold h-11 w-11"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={verifyingOTP || otp.join('').length !== 6}
                      size="sm"
                      className="h-8 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {verifyingOTP ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify Code'
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={resendingOTP || resendCooldown > 0}
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-sm border-slate-300 hover:bg-slate-50"
                    >
                      {resendingOTP ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          Sending...
                        </>
                      ) : resendCooldown > 0 ? (
                        `Resend (${resendCooldown}s)`
                      ) : (
                        'Resend Code'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Check your email for the 6-digit code
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-1 relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} // Toggle type
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  minLength={8}
                  required 
                  className="pr-10" // Add padding
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
              <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>
            </div>

            <div className="flex items-start">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => setFormData({...formData, acceptTerms: checked})}
                required
              />
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="font-medium text-slate-700">
                  I agree to the <a href="#" className="text-blue-600 hover:text-blue-500">Terms</a> and <a href="#" className="text-blue-600 hover:text-blue-500">Privacy Policy</a>
                </label>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </div>
          </form>

           <div className="mt-6 text-center text-sm">
              <span className="text-slate-600">Already have an account?</span>{' '}
              <Link to={createPageUrl("SignIn")} className="font-medium text-blue-600 hover:text-blue-500">
                Log in
              </Link>
            </div>
        </div>
      </div>
    </div>
  );
}

