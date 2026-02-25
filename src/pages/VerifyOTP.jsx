import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { groonabackend } from "@/api/groonabackend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, ArrowLeft, Shield } from "lucide-react";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { getOtpEmailTemplate } from "@/utils/emailTemplates"; // Import the template

export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef([]);

  // Get email from location state
  const email = location.state?.email;

  useEffect(() => {
    // Redirect if no email in state
    if (!email) {
      navigate(createPageUrl("SignIn"));
      return;
    }

    // Start resend countdown
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5 && newOtp.every(digit => digit)) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    
    // Focus last filled input or submit if complete
    const lastIndex = Math.min(pastedData.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();
    
    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (otpCode = otp.join('')) => {
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await groonabackend.functions.invoke('verifyOTP', {
        email,
        otp: otpCode
      });

      if (response.success) {
        toast.success('Verification successful!');
        
        // FIX: Store the token so Layout.jsx knows we are logged in
        if (response.token) {
          localStorage.setItem('auth_token', response.token);
        }
        
        // Force full reload to ensure Layout picks up the new user session
        setTimeout(() => {
          // CHANGE: Redirect to UserOnboarding so the setup flow can initialize the tenant
          // UserOnboarding.jsx handles redirecting to Dashboard if setup is already complete.
          window.location.href = createPageUrl("UserOnboarding");
        }, 500);
      }
    } catch (error) {
      console.error('[VerifyOTP] Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Invalid verification code';
      setError(errorMessage);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;

    setResending(true);
    setError('');
    setOtp(['', '', '', '', '', '']);

    try {
      // Pass the template here as well
      await groonabackend.functions.invoke('sendOTP', { 
        email,
        emailTemplate: getOtpEmailTemplate('{{OTP}}') 
      });
      
      toast.success('New code sent to your email');
      
      // Reset countdown
      setCanResend(false);
      setCountdown(30);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('[VerifyOTP] Resend error:', error);
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("SignIn"))}
          className="mb-4 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back To Login
        </Button>

        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-xl">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Verify Your Identity
              </CardTitle>
              <CardDescription className="text-base mt-2">
                We've sent a 6-digit verification code to
                <div className="font-medium text-slate-700 mt-1 flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  {email}
                </div>
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* OTP Input */}
            <div className="space-y-4">
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={loading}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
            <Button
              onClick={() => handleVerify()}
              disabled={loading || otp.some(digit => !digit)}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Continue'
              )}
            </Button>

            {/* Resend Code */}
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600">
                Didn't receive the code?
              </p>
              <Button
                variant="ghost"
                onClick={handleResend}
                disabled={!canResend || resending}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : canResend ? (
                  'Resend Code'
                ) : (
                  `Resend in ${countdown}s`
                )}
              </Button>
            </div>

            {/* Security Note */}
            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                Code expires in 5 minutes. Maximum 5 attempts allowed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

