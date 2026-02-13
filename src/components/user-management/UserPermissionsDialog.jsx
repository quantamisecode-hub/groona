import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Users as UsersIcon, UserCircle, AlertCircle, Building2, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getAllPermissionDefinitions } from "../shared/usePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function EmployeeCTCTab({ user, onClose }) {
  const [ctcData, setCtcData] = useState({
    ctc_per_annum: user.ctc_per_annum || '',
    working_days_per_month: user.working_days_per_month || 22,
    working_hours_per_day: user.working_hours_per_day || 8,
    ctc_per_month: 0,
    total_monthly_working_hours: 0,
    hourly_rate: 0,
    ctc_currency: user.ctc_currency || 'INR',
    ctc_effective_from: user.ctc_effective_from ? new Date(user.ctc_effective_from).toISOString().split('T')[0] : '',
  });

  // Derived calculations
  useEffect(() => {
    const annualCTC = parseFloat(ctcData.ctc_per_annum) || 0;
    const workingDays = parseFloat(ctcData.working_days_per_month) || 0;
    const workingHours = parseFloat(ctcData.working_hours_per_day) || 0;

    const monthlyCTC = annualCTC / 12;
    const totalHours = workingDays * workingHours;

    // Hourly Rate = Monthly CTC / Total Monthly Hours
    // Avoid division by zero
    const hourlyRate = totalHours > 0 ? (monthlyCTC / totalHours) : 0;

    setCtcData(prev => ({
      ...prev,
      ctc_per_month: monthlyCTC,
      total_monthly_working_hours: totalHours,
      hourly_rate: hourlyRate
    }));
  }, [ctcData.ctc_per_annum, ctcData.working_days_per_month, ctcData.working_hours_per_day]);

  const queryClient = useQueryClient();

  const updateCTCMutation = useMutation({
    mutationFn: async () => {
      // Basic validation
      if (!ctcData.ctc_per_annum) throw new Error("CTC Per Annum is required");
      if (!ctcData.ctc_effective_from) throw new Error("Effective From Date is required");

      await groonabackend.entities.User.update(user.id, {
        ctc_per_annum: parseFloat(ctcData.ctc_per_annum),
        working_days_per_month: parseFloat(ctcData.working_days_per_month),
        working_hours_per_day: parseFloat(ctcData.working_hours_per_day),
        ctc_per_month: ctcData.ctc_per_month,
        total_monthly_working_hours: ctcData.total_monthly_working_hours,
        hourly_rate: ctcData.hourly_rate,
        ctc_currency: ctcData.ctc_currency,
        ctc_effective_from: ctcData.ctc_effective_from,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Employee CTC details updated!");
      onClose();
    },
    onError: (err) => {
      toast.error(`Failed to update CTC: ${err.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateCTCMutation.mutate();
  };

  return (
    <TabsContent value="ctc" className="space-y-4">
      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
        <div className="flex items-center gap-2 text-emerald-900">
          <Calculator className="h-4 w-4" />
          <p className="text-sm font-semibold">Automatic Calculations Enabled</p>
        </div>
        <p className="text-xs text-emerald-700 mt-1">
          Monthly CTC and Hourly Rate are automatically calculated based on your inputs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ctc_currency">Currency *</Label>
            <Select
              value={ctcData.ctc_currency}
              onValueChange={(value) => setCtcData({ ...ctcData, ctc_currency: value })}
            >
              <SelectTrigger id="ctc_currency">
                <SelectValue placeholder="Select Currency" />
              </SelectTrigger>
              <SelectContent>
                {['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'].map((curr) => (
                  <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ctc_per_annum">CTC Per Annum *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                {ctcData.ctc_currency === 'INR' ? '₹' : ctcData.ctc_currency === 'USD' ? '$' : ctcData.ctc_currency === 'EUR' ? '€' : ctcData.ctc_currency === 'GBP' ? '£' : ctcData.ctc_currency}
              </span>
              <Input
                id="ctc_per_annum"
                type="number"
                min="0"
                step="0.01"
                className="pl-12"
                value={ctcData.ctc_per_annum}
                onChange={(e) => setCtcData({ ...ctcData, ctc_per_annum: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ctc_per_month">CTC Per Month (Auto)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                {ctcData.ctc_currency === 'INR' ? '₹' : ctcData.ctc_currency === 'USD' ? '$' : ctcData.ctc_currency === 'EUR' ? '€' : ctcData.ctc_currency === 'GBP' ? '£' : ctcData.ctc_currency}
              </span>
              <Input
                id="ctc_per_month"
                value={ctcData.ctc_per_month.toFixed(2)}
                disabled
                className="pl-12 bg-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="working_days">Working Days / Month</Label>
            <Input
              id="working_days"
              type="number"
              min="1"
              max="31"
              value={ctcData.working_days_per_month}
              onChange={(e) => setCtcData({ ...ctcData, working_days_per_month: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="working_hours">Working Hours / Day</Label>
            <Input
              id="working_hours"
              type="number"
              min="1"
              max="24"
              value={ctcData.working_hours_per_day}
              onChange={(e) => setCtcData({ ...ctcData, working_hours_per_day: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_hours">Total Monthly Working Hours (Auto)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin hidden" /> {/* Placeholder */}
                ⏱️
              </span>
              <Input
                id="total_hours"
                value={ctcData.total_monthly_working_hours.toFixed(2)}
                disabled
                className="pl-9 bg-slate-100 font-semibold text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hourly_rate">Hourly Rate (Auto)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                {ctcData.ctc_currency === 'INR' ? '₹' : ctcData.ctc_currency === 'USD' ? '$' : ctcData.ctc_currency === 'EUR' ? '€' : ctcData.ctc_currency === 'GBP' ? '£' : ctcData.ctc_currency}
              </span>
              <Input
                id="hourly_rate"
                value={ctcData.hourly_rate.toFixed(2)}
                disabled
                className="pl-12 bg-amber-50 font-bold text-amber-900 border-amber-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ctc_effective_from">Effective From Date *</Label>
            <Input
              id="ctc_effective_from"
              type="date"
              value={ctcData.ctc_effective_from}
              onChange={(e) => setCtcData({ ...ctcData, ctc_effective_from: e.target.value })}
              required
            />
            <p className="text-xs text-slate-500">
              This date will be used for finance auditing and versioning.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={updateCTCMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {updateCTCMutation.isPending ? 'Saving...' : 'Save CTC Details'}
          </Button>
        </DialogFooter>
      </form>
    </TabsContent>
  );
}

// Common Timezones (You might want to move this to a constants file later)
const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST) - UTC+05:30" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "America/New_York", label: "Eastern Time (US & Canada) - UTC-05:00" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada) - UTC-08:00" },
  { value: "Europe/London", label: "London - UTC+00:00" },
  { value: "Europe/Paris", label: "Paris - UTC+01:00" },
  { value: "Asia/Dubai", label: "Dubai - UTC+04:00" },
  { value: "Asia/Singapore", label: "Singapore - UTC+08:00" },
  { value: "Australia/Sydney", label: "Sydney - UTC+11:00" },
];

export default function UserPermissionsDialog({ open, onClose, user, currentUser, effectiveTenantId, groups, memberships }) {
  // State for permissions
  const [permissions, setPermissions] = useState({});

  // State for User Info tab
  const [userInfo, setUserInfo] = useState({
    full_name: user.full_name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    timezone: user.timezone || 'Asia/Kolkata',
  });

  const [updateError, setUpdateError] = useState(null);
  const queryClient = useQueryClient();

  // 1. FETCH: Get the separate Permission Record for this user
  const { data: permissionRecord, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['user-permissions', user.id],
    queryFn: async () => {
      if (!user.id) return null;
      // Fetch specifically from the UserPermission model
      const records = await groonabackend.entities.UserPermission.filter({ user_id: user.id });
      return records?.[0] || null;
    },
    enabled: open && !!user.id, // Only fetch when dialog is open
  });

  // 2. SYNC: Update local state when data arrives
  useEffect(() => {
    if (permissionRecord && permissionRecord.permissions) {
      setPermissions(permissionRecord.permissions);
    } else {
      // Fallback: If no separate record exists yet, try legacy user field or empty
      setPermissions(user.permissions || {});
    }
  }, [permissionRecord, user]);


  // --- MUTATION: Update User Info (Profile) ---
  const updateUserInfoMutation = useMutation({
    mutationFn: async () => {
      try {
        // Direct update to User entity is more reliable and robust
        // Note: 'address' is part of UserProfile, not User entity, so it's not updated here.
        // Use EditUserDialog for full profile updates.
        const updatedUser = await groonabackend.entities.User.update(user.id, {
          full_name: userInfo.full_name,
          email: userInfo.email,
          phone_number: userInfo.phone || null,
          timezone: userInfo.timezone,
        });

        return updatedUser;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User information updated successfully!');
      setUpdateError(null);
    },
    onError: (error) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to update';
      setUpdateError(errorMessage);
      toast.error(errorMessage);
    },
  });

  // --- MUTATION: Update Permissions (The Fix) ---
  const updatePermissionsMutation = useMutation({
    mutationFn: async () => {
      console.log('[UserPermissionsDialog] Saving permissions:', permissions);

      // A. Check if we are updating an existing record or creating a new one
      if (permissionRecord && permissionRecord.id) {
        // UPDATE existing record
        await groonabackend.entities.UserPermission.update(permissionRecord.id, {
          permissions,
          updated_at: new Date()
        });
      } else {
        // CREATE new record
        await groonabackend.entities.UserPermission.create({
          user_id: user.id,
          tenant_id: effectiveTenantId,
          permissions,
          updated_at: new Date()
        });
      }

      // Optional: Audit Log (Keep your existing audit logic)
      try {
        await groonabackend.entities.AuditLog.create({
          tenant_id: effectiveTenantId,
          action: 'permission_change',
          entity_type: 'user',
          entity_id: user.id,
          entity_name: user.full_name,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          description: `Updated permissions for user: ${user.email}`,
          changes: {
            before: permissionRecord?.permissions || {},
            after: permissions,
          },
        });
      } catch (auditError) {
        console.warn('Audit log failed:', auditError);
      }
    },
    onSuccess: () => {
      // Invalidate both users and the specific permission query
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] });
      // Force global permission refresh for the current user if they are editing themselves
      if (currentUser.id === user.id) {
        queryClient.invalidateQueries({ queryKey: ['user-permissions-record'] });
      }

      toast.success('Permissions saved successfully');
      setTimeout(() => onClose(), 500);
    },
    onError: (error) => {
      console.error('Failed to save permissions:', error);
      toast.error('Failed to save permissions. Check console for details.');
    },
  });

  const handlePermissionToggle = (permissionKey, value) => {
    setPermissions(prev => ({
      ...prev,
      [permissionKey]: value,
    }));
  };

  const handleClearPermissions = () => {
    if (confirm('Remove all custom permissions for this user? They will inherit permissions from their groups.')) {
      setPermissions({});
    }
  };

  const handleSubmitUserInfo = (e) => {
    e.preventDefault();
    if (!userInfo.full_name?.trim() || !userInfo.email?.trim()) {
      toast.error('Name and Email are required');
      return;
    }
    updateUserInfoMutation.mutate();
  };

  const handleSubmitPermissions = (e) => {
    e.preventDefault();
    updatePermissionsMutation.mutate();
  };

  const permissionDefinitions = getAllPermissionDefinitions();
  const permissionsByCategory = permissionDefinitions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Manage information and permissions for {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="gap-2">
              <UserCircle className="h-4 w-4" />
              Information
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>

            <TabsTrigger value="ctc" className="gap-2">
              <Building2 className="h-4 w-4" />
              Employee CTC
            </TabsTrigger>
          </TabsList>

          {/* User Information Tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Changes to email address may require the user to re-authenticate.
              </p>
            </div>

            {updateError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{updateError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmitUserInfo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={userInfo.full_name}
                  onChange={(e) => {
                    setUserInfo({ ...userInfo, full_name: e.target.value });
                    setUpdateError(null);
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={userInfo.email}
                  onChange={(e) => {
                    setUserInfo({ ...userInfo, email: e.target.value });
                    setUpdateError(null);
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Time Zone</Label>
                <Select
                  value={userInfo.timezone}
                  onValueChange={(value) => setUserInfo({ ...userInfo, timezone: value })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select Time Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Used for timesheet calculations and activity logs.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={userInfo.phone}
                  onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={userInfo.address}
                  onChange={(e) => setUserInfo({ ...userInfo, address: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={updateUserInfoMutation.isPending}>
                  {updateUserInfoMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            {isLoadingPermissions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">About Custom Permissions</p>
                    <p className="text-xs">
                      These permissions override defaults and group settings.
                    </p>
                  </div>
                  {Object.keys(permissions).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearPermissions}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                <form onSubmit={handleSubmitPermissions} className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="font-semibold text-slate-900 text-sm border-b pb-2">
                        {category}
                      </h3>
                      <div className="space-y-3">
                        {perms.map(perm => {
                          const isSet = permissions.hasOwnProperty(perm.key);
                          const value = permissions[perm.key];

                          return (
                            <div
                              key={perm.key}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isSet
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-white border-slate-200'
                                }`}
                            >
                              <div className="flex-1">
                                <Label htmlFor={perm.key} className="text-sm font-medium cursor-pointer">
                                  {perm.label}
                                  {isSet && (
                                    <Badge className="ml-2 text-xs bg-blue-600 text-white">
                                      Custom
                                    </Badge>
                                  )}
                                </Label>
                              </div>
                              <div className="flex items-center gap-3">
                                <Switch
                                  id={perm.key}
                                  checked={value === true}
                                  onCheckedChange={(checked) => handlePermissionToggle(perm.key, checked)}
                                  disabled={updatePermissionsMutation.isPending}
                                />
                                {isSet && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => {
                                      const newPerms = { ...permissions };
                                      delete newPerms[perm.key];
                                      setPermissions(newPerms);
                                    }}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={updatePermissionsMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updatePermissionsMutation.isPending}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                    >
                      {updatePermissionsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Permissions'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </TabsContent>



          {/* CTC Tab */}
          <EmployeeCTCTab user={user} onClose={onClose} />
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

