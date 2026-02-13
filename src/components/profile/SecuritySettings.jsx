import React, { useState, useEffect, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Lock, 
  LogOut, 
  Loader2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Check, 
  X,
  Laptop,
  Smartphone,
  Globe,
  Clock
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SecuritySettings({ user, onUpdate }) {
  const queryClient = useQueryClient();
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [currentPublicIp, setCurrentPublicIp] = useState(null);
  
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(null);

  // --- 1. Fetch Public IP for Display Correction ---
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setCurrentPublicIp(data.ip))
      .catch(() => setCurrentPublicIp(null));
  }, []);

  // --- 2. Helper to Fix Localhost/Proxy IPs for Display ---
  const formatSessionDisplay = (session) => {
    // If backend reports localhost, show the fetched public IP if available
    const isLocal = session.ip_address === '::1' || session.ip_address === '127.0.0.1';
    const displayIp = (isLocal && currentPublicIp) ? currentPublicIp : session.ip_address;
    
    // If location is unknown/local, make it look better
    let displayLocation = session.location;
    if (displayLocation === 'Localhost' || displayLocation === 'Unknown Location') {
        displayLocation = isLocal ? 'Local Development' : 'Unknown Location';
    }

    return {
        ...session,
        displayIp,
        displayLocation
    };
  };

  // --- QUERIES (REAL DATA) ---
  const { data: rawSessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: () => groonabackend.auth.getSessions(),
  });

  // --- COMPUTED: Process Sessions ---
  const { currentSession, otherSessions } = useMemo(() => {
    // Apply formatting fix to all sessions
    const formattedSessions = rawSessions.map(formatSessionDisplay);
    
    const current = formattedSessions.find(s => s.is_current);
    const others = formattedSessions.filter(s => !s.is_current);

    // Fallback if no session is marked current (e.g. before re-login)
    if (!current) {
         // Create a temporary "fallback" session object for UI
         return { 
             currentSession: {
                 id: 'fallback',
                 is_current: true,
                 device_type: 'desktop',
                 browser: 'Current Browser',
                 os: 'Current OS',
                 displayIp: currentPublicIp || 'Loading...',
                 displayLocation: 'Current Device',
                 last_active: new Date().toISOString(),
                 is_fallback: true
             }, 
             otherSessions: others 
         };
    }

    return { currentSession: current, otherSessions: others };
  }, [rawSessions, currentPublicIp]);

  // --- MUTATIONS ---

  const changePasswordMutation = useMutation({
    mutationFn: async (data) => {
      await groonabackend.auth.changePassword(data.current_password, data.new_password);
    },
    onSuccess: () => {
      toast.success("Password changed successfully! Please log in again.");
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => groonabackend.auth.logout(), 2000);
    },
    onError: (err) => {
      const msg = err.response?.data?.msg || "Failed to change password.";
      toast.error(msg);
    }
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId) => groonabackend.auth.revokeSession(sessionId),
    onSuccess: () => {
      toast.success("Session logged out successfully");
      setShowRevokeDialog(null);
      queryClient.invalidateQueries(['active-sessions']);
    },
    onError: () => toast.error("Failed to revoke session")
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: () => groonabackend.auth.revokeOtherSessions(),
    onSuccess: () => {
      toast.success("All other sessions logged out");
      setShowLogoutDialog(false);
      queryClient.invalidateQueries(['active-sessions']);
    },
    onError: () => toast.error("Failed to log out other devices")
  });

  // --- LOGIC ---

  const validatePassword = (password) => {
    if (!password) return { isValid: false, errors: [], strength: 0, checks: {} };
    
    const checks = {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const strength = (passedChecks / Object.keys(checks).length) * 100;

    return { 
      isValid: passedChecks === 5, 
      strength,
      checks,
    };
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (!passwordData.current_password) {
      toast.error("Please enter your current password");
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }
    changePasswordMutation.mutate(passwordData);
  };

  const handleLogout = () => {
    groonabackend.auth.logout();
    toast.success("Signing out...");
  };

  const toggle2FA = async () => {
    setIs2FALoading(true);
    try {
      const newValue = !user.is_two_factor_enabled;
      const updatedUser = await groonabackend.auth.updateMe({ is_two_factor_enabled: newValue });
      toast.success(`Two-factor authentication ${newValue ? 'enabled' : 'disabled'}`);
      if (onUpdate) onUpdate(updatedUser);
    } catch (error) {
      toast.error("Failed to update 2FA settings");
    } finally {
      setIs2FALoading(false);
    }
  };

  const getDeviceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'mobile': return <Smartphone className="h-5 w-5 text-slate-500" />;
      case 'tablet': return <Smartphone className="h-5 w-5 text-slate-500" />;
      case 'desktop': return <Laptop className="h-5 w-5 text-slate-500" />;
      default: return <Globe className="h-5 w-5 text-slate-500" />;
    }
  };

  const passwordValidation = passwordData.new_password ? validatePassword(passwordData.new_password) : null;
  const passwordsMatch = passwordData.new_password && passwordData.confirm_password && passwordData.new_password === passwordData.confirm_password;

  const getStrengthColor = (strength) => {
    if (strength >= 80) return { bg: 'bg-green-500', text: 'text-green-600', label: 'Strong' };
    if (strength >= 60) return { bg: 'bg-blue-500', text: 'text-blue-600', label: 'Good' };
    if (strength >= 40) return { bg: 'bg-yellow-500', text: 'text-yellow-600', label: 'Fair' };
    return { bg: 'bg-red-500', text: 'text-red-600', label: 'Weak' };
  };

  const strengthColor = passwordValidation ? getStrengthColor(passwordValidation.strength) : null;

  return (
    <div className="space-y-6">
       {/* 2FA Settings */}
       <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-100 rounded-lg">
            <div className="space-y-1">
              <div className="font-medium text-purple-900">Email Verification</div>
              <div className="text-sm text-purple-700">
                Receive a verification code via email when signing in.
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user.is_two_factor_enabled && (
                <Badge className="bg-green-600">Enabled</Badge>
              )}
              <Button 
                variant={user.is_two_factor_enabled ? "outline" : "default"}
                onClick={toggle2FA}
                disabled={is2FALoading}
                className={user.is_two_factor_enabled ? "" : "bg-purple-600 hover:bg-purple-700"}
              >
                {is2FALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {user.is_two_factor_enabled ? "Disable 2FA" : "Enable 2FA"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password *</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                  placeholder="Enter your current password"
                  disabled={changePasswordMutation.isPending}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full hover:bg-transparent"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">New Password *</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                  placeholder="Enter a strong new password"
                  disabled={changePasswordMutation.isPending}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full hover:bg-transparent"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
              
              {passwordValidation && passwordData.new_password && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Password Strength:</span>
                    <span className={`font-semibold ${strengthColor.text}`}>
                      {strengthColor.label}
                    </span>
                  </div>
                  <Progress value={passwordValidation.strength} className={`h-2 ${strengthColor.bg}`} />
                  
                  {/* Requirements Checklist */}
                  <div className="text-xs space-y-1 mt-2 p-3 bg-slate-50 rounded-lg grid grid-cols-2 gap-2">
                    {Object.entries(passwordValidation.checks).map(([key, passed]) => (
                      <div key={key} className={`flex items-center gap-2 ${passed ? 'text-green-600' : 'text-slate-400'}`}>
                        {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>
                          {key === 'minLength' && 'At least 8 characters'}
                          {key === 'hasUpperCase' && 'One uppercase letter (A-Z)'}
                          {key === 'hasLowerCase' && 'One lowercase letter (a-z)'}
                          {key === 'hasNumber' && 'One number (0-9)'}
                          {key === 'hasSpecial' && 'One special character (!@#...)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password *</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                  placeholder="Re-enter your new password"
                  disabled={changePasswordMutation.isPending}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full hover:bg-transparent"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
              
              {passwordData.confirm_password && passwordData.new_password && (
                <div className="flex items-center gap-1 mt-1">
                  {passwordsMatch ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Passwords match
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 text-sm">
                <strong>Security Notice:</strong> After changing your password, you'll be automatically 
                logged out and will need to sign in again with your new password.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={
                  changePasswordMutation.isPending || 
                  !passwordData.current_password ||
                  !passwordData.new_password ||
                  !passwordData.confirm_password ||
                  !passwordValidation?.isValid ||
                  !passwordsMatch
                }
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Session Management
          </CardTitle>
          <CardDescription>
            Manage devices where you are currently logged in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {isLoadingSessions ? (
            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400"/></div>
          ) : (
            <div className="space-y-6">
               
               {/* Current Session - Highlighted */}
               <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100 rounded-full">
                      {getDeviceIcon(currentSession.device_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-green-900">Current Session</h4>
                        <div className="flex items-center gap-2">
                          {currentSession.is_fallback && (
                             <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700 text-[10px]">
                               Tracking Inactive
                             </Badge>
                          )}
                          <Badge className="bg-green-600 hover:bg-green-700 text-[10px]">Active Now</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-green-800 space-y-1">
                        <p className="font-medium">{currentSession.os} • {currentSession.browser}</p>
                        <p className="text-green-700 flex items-center gap-1 opacity-80">
                          {currentSession.displayLocation} • {currentSession.displayIp}
                        </p>
                        {currentSession.is_fallback && (
                          <p className="text-xs text-yellow-700 mt-1 italic">
                            * Please log out and back in to enable full session tracking.
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="flex-shrink-0 border-green-300 hover:bg-green-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
               </div>

               {/* Other Sessions List */}
               <div className="space-y-3">
                 <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                   <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                     Other Devices ({otherSessions.length})
                   </h4>
                   {otherSessions.length > 0 && (
                     <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => setShowLogoutDialog(true)}
                        className="h-8 text-xs"
                      >
                       Log out all others
                     </Button>
                   )}
                 </div>
                 
                 {otherSessions.length === 0 ? (
                   <p className="text-sm text-slate-500 italic py-2">No other active sessions.</p>
                 ) : (
                   <div className="grid gap-2">
                     {otherSessions.map(session => (
                       <div key={session._id || session.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-full text-slate-500 group-hover:bg-white group-hover:text-blue-500 transition-colors">
                              {getDeviceIcon(session.device_type)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{session.os} • {session.browser}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{session.displayLocation} • {session.displayIp}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Active {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowRevokeDialog(session.id || session._id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Log out
                          </Button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout All Devices Confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Sign Out From All Other Devices?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will immediately end active sessions on all other browsers and devices 
                except this current one.
              </p>
              <p className="font-medium text-slate-900">
                You will need to sign in again on those devices to regain access.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeAllSessionsMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeAllSessionsMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={revokeAllSessionsMutation.isPending}
            >
              {revokeAllSessionsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging Out...
                </>
              ) : (
                'Log Out Others'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Single Session Confirmation */}
      <AlertDialog open={!!showRevokeDialog} onOpenChange={() => setShowRevokeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out device?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out this device? They will need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showRevokeDialog) revokeSessionMutation.mutate(showRevokeDialog);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Log Out Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

