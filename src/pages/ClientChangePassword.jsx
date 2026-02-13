import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, CheckCircle, AlertCircle, Sprout } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { API_BASE } from '@/api/groonabackend';

const ClientChangePassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get data from URL
  const emailParam = searchParams.get('email') || '';
  const oldPasswordParam = searchParams.get('oldPassword') || '';

  useEffect(() => {
    if (oldPasswordParam) {
      setValue('oldPassword', oldPasswordParam);
    }
  }, [oldPasswordParam, setValue]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Call the special endpoint we created
      const response = await fetch(`${API_BASE}/api/clients/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParam,
          oldPassword: data.oldPassword,
          newPassword: data.newPassword
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update password');
      }

      setSuccess('Password updated successfully! Redirecting to login...');
      
      // Redirect after short delay
      setTimeout(() => {
        navigate(`/SignIn?email=${encodeURIComponent(emailParam)}`); // Send them back to login to use new password
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {/* Branding Logo - Matching SignIn style */}
             <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sprout className="h-5 w-5 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Set New Password</CardTitle>
          <CardDescription>
            Secure your account by setting a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Old Password (Prefilled & Read-Only) */}
            {/* Displayed at the top as requested */}
            <div className="space-y-2">
              <Label htmlFor="oldPassword" className="text-slate-500">Current Password (Temporary)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="oldPassword" 
                  type="text" 
                  className="pl-9 bg-slate-100 text-slate-600 font-mono border-slate-200 cursor-not-allowed focus-visible:ring-0"
                  readOnly
                  tabIndex={-1} // Prevent focus
                  {...register("oldPassword", { required: "Current password is missing from link" })} 
                />
              </div>
              <p className="text-xs text-slate-400">This is the temporary password sent to your email.</p>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="newPassword" 
                  type="password" 
                  placeholder="Enter new password"
                  className="pl-9"
                  {...register("newPassword", { 
                    required: "New password is required",
                    minLength: { value: 6, message: "Password must be at least 6 characters" }
                  })} 
                />
              </div>
              {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  placeholder="Confirm new password"
                  className="pl-9"
                  {...register("confirmPassword", { 
                    validate: (val) => {
                      if (watch('newPassword') != val) {
                        return "Your passwords do not match";
                      }
                    }
                  })} 
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientChangePassword;
