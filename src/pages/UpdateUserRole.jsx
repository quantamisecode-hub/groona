
import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Loader2, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function UpdateUserRole() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchEmail, setSearchEmail] = useState("pratik.ceh@gmail.com");
  const [targetUser, setTargetUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      setCurrentUser(user);
      // Removed this toast as the access denied screen is more appropriate.
      // if (!user.is_super_admin) {
      //   toast.error("Access denied. This page is for Super Admins only.");
      // }
    });
  }, []);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSearching(true);
    setTargetUser(null);
    setSelectedRole("");
    setUpdateSuccess(false);

    try {
      const userData = await groonabackend.auth.me();
      
      // Since we can't directly query other users, we'll update the current user if email matches
      if (userData.email === searchEmail.trim()) {
        setTargetUser(userData);
        // Determine current role
        const currentRole = userData.is_super_admin ? "super_admin" : (userData.role || "user");
        setSelectedRole(currentRole);
        toast.success("User found!");
      } else {
        toast.error("Can only update your own user role through this interface. Please login as the target user.");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to find user");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdate = async () => {
    if (!targetUser || !selectedRole) {
      toast.error("Please select a role");
      return;
    }

    setIsUpdating(true);

    try {
      const updateData = {
        role: selectedRole,
        is_super_admin: selectedRole === "super_admin"
      };

      await groonabackend.auth.updateMe(updateData);
      
      toast.success("User role updated successfully!");
      setUpdateSuccess(true);
      
      // Refresh user data
      const updatedUser = await groonabackend.auth.me();
      setTargetUser(updatedUser);
      
      // Reload page after 2 seconds to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update user role: " + (error?.message || "Please try again"));
    } finally {
      setIsUpdating(false);
    }
  };

  // Determine current role for comparison
  const getCurrentRole = () => {
    if (!targetUser) return null;
    return targetUser.is_super_admin ? "super_admin" : (targetUser.role || "user");
  };

  const currentRole = getCurrentRole();
  const hasRoleChanged = selectedRole && currentRole && selectedRole !== currentRole;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // The condition should be `!currentUser.is_super_admin` to prevent non-super admins from accessing.
  // The original code `!currentUser.is_super_admin && currentUser.role !== 'admin'` was a bit ambiguous
  // as an admin might not be a super admin. For this specific page which states "Super Admin Utility",
  // it should strictly be for super admins.
  if (!currentUser.is_super_admin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <h3 className="font-semibold text-slate-900 mb-2">Access Denied</h3>
            <p className="text-sm text-slate-600">
              This utility page is only accessible to Super Admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-600" />
            Update User Role
          </h1>
          <p className="text-slate-600">Super Admin Utility - Change user roles and permissions</p>
        </div>

        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Note:</strong> Due to security restrictions, you can only update your own user role through this interface.
            For other users, please use the database admin panel or contact support.
          </AlertDescription>
        </Alert>

        {/* Search Card */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Search User
            </CardTitle>
            <CardDescription>
              Enter the email address of the user whose role you want to update
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-email">Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="search-email"
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="user@example.com"
                  disabled={isSearching}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchEmail.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Details & Role Update */}
        {targetUser && (
          <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                User Found
              </CardTitle>
              <CardDescription>
                Update the role for this user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User Info */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-700">Name:</span>
                    <p className="text-slate-900">{targetUser.full_name}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Email:</span>
                    <p className="text-slate-900">{targetUser.email}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Current Role:</span>
                    <p className="text-slate-900 font-medium">
                      {currentRole === "super_admin" ? "Super Admin" : 
                       currentRole === "admin" ? "Admin" : "User"}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Account Status:</span>
                    <p className="text-slate-900">{targetUser.account_status || "active"}</p>
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="role-select">New Role *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole} disabled={isUpdating || updateSuccess}>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-400" />
                        <span>User - Regular access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-400" />
                        <span>Admin - Tenant administration</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="super_admin">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-400" />
                        <span>Super Admin - Platform-wide access</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <p className="text-xs text-slate-600">
                    Selected: <strong>{selectedRole === "super_admin" ? "Super Admin" : selectedRole === "admin" ? "Admin" : "User"}</strong>
                  </p>
                )}
              </div>

              {/* Role Change Indicator */}
              {hasRoleChanged && (
                <Alert className="border-amber-200 bg-amber-50">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 text-sm">
                    <strong>Role will change from:</strong> {currentRole === "super_admin" ? "Super Admin" : currentRole === "admin" ? "Admin" : "User"} → {selectedRole === "super_admin" ? "Super Admin" : selectedRole === "admin" ? "Admin" : "User"}
                  </AlertDescription>
                </Alert>
              )}

              {/* Role Descriptions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h4 className="font-semibold text-blue-900 mb-2">Role Permissions:</h4>
                <ul className="text-blue-800 space-y-1">
                  <li><strong>User:</strong> Access to own projects and tasks, basic features</li>
                  <li><strong>Admin:</strong> Full access within tenant, user management, settings</li>
                  <li><strong>Super Admin:</strong> Platform-wide access, manage all tenants, system settings</li>
                </ul>
              </div>

              {updateSuccess && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900">
                    <strong>Success!</strong> User role has been updated. Page will reload to reflect changes...
                  </AlertDescription>
                </Alert>
              )}

              {/* Update Button */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTargetUser(null);
                    setSelectedRole("");
                    setSearchEmail("");
                  }}
                  disabled={isUpdating || updateSuccess}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={isUpdating || !hasRoleChanged || updateSuccess}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating Role...
                    </>
                  ) : updateSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Updated!
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Update Role {!hasRoleChanged && "(No change)"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-2">
            <p><strong>Current User:</strong> {currentUser.email}</p>
            <p><strong>Your Role:</strong> {currentUser.is_super_admin ? "Super Admin" : currentUser.role === "admin" ? "Admin" : "User"}</p>
            <hr className="my-4" />
            <p className="text-xs text-slate-600 font-semibold mb-2">
              ⚠️ Important: Due to security restrictions, you can only update YOUR OWN role.
            </p>
            <p className="text-xs text-slate-600">
              To update pratik.ceh@gmail.com to Super Admin:
            </p>
            <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1 ml-2">
              <li>Login as <strong>pratik.ceh@gmail.com</strong></li>
              <li>Navigate to this page (<code>/UpdateUserRole</code>)</li>
              <li>Search for your email (it will be pre-filled)</li>
              <li>Select <strong>Super Admin</strong> from dropdown</li>
              <li>Click <strong>Update Role</strong></li>
              <li>Page will reload with Super Admin access</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

