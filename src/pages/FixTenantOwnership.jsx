import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function FixTenantOwnership() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("prateek@quantamisecode.com");
  const [newOwnerName, setNewOwnerName] = useState("Prateek Shukla");
  const queryClient = useQueryClient();

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      if (!user.is_super_admin) {
        window.location.href = createPageUrl("Dashboard");
      }
      setCurrentUser(user);
    }).catch(() => {
      window.location.href = createPageUrl("Dashboard");
    });
  }, []);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list('-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  // Find Quantamise Code tenant
  const quantamiseTenant = tenants.find(t => 
    t.name.toLowerCase().includes('quantamise') || 
    t.name.toLowerCase().includes('quantamis')
  );

  const fixOwnershipMutation = useMutation({
    mutationFn: async ({ tenantId, ownerEmail, ownerName }) => {
      // Step 1: Check if user with new email exists
      const existingUsers = await groonabackend.entities.User.filter({ email: ownerEmail });
      
      let tenantAdminUser;
      if (existingUsers.length > 0) {
        // Update existing user
        const existingUser = existingUsers[0];
        
        // Make sure this user is NOT a super admin
        if (existingUser.is_super_admin) {
          throw new Error('Cannot use Super Admin as tenant owner. Please use a different email.');
        }
        
        tenantAdminUser = await groonabackend.entities.User.update(existingUser.id, {
          tenant_id: tenantId,
          role: 'admin',
          full_name: ownerName || existingUser.full_name,
          is_super_admin: false, // Explicitly set to false
        });
      } else {
        // Create new admin user for this tenant
        tenantAdminUser = await groonabackend.entities.User.create({
          email: ownerEmail,
          full_name: ownerName || ownerEmail.split('@')[0],
          role: 'admin',
          tenant_id: tenantId,
          is_super_admin: false, // CRITICAL: Not a super admin
          account_status: 'active',
        });
      }
      
      // Step 2: Update tenant with correct owner info
      await groonabackend.entities.Tenant.update(tenantId, {
        owner_email: ownerEmail,
        owner_name: ownerName,
        owner_user_id: tenantAdminUser.id,
      });
      
      // Step 3: Remove Super Admin from this tenant's users if present
      const superAdminInTenant = allUsers.find(u => 
        u.tenant_id === tenantId && 
        u.is_super_admin === true
      );
      
      if (superAdminInTenant && superAdminInTenant.id !== tenantAdminUser.id) {
        try {
          // Update super admin user to remove tenant association
          await groonabackend.entities.User.update(superAdminInTenant.id, {
            tenant_id: null, // Remove tenant association from super admin
          });
        } catch (error) {
          console.error('Failed to remove super admin from tenant:', error);
        }
      }
      
      return { tenant: tenantId, admin: tenantAdminUser };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success("Tenant ownership fixed successfully!");
    },
    onError: (error) => {
      toast.error("Failed to fix ownership: " + error.message);
    },
  });

  const handleFix = () => {
    const tenantId = selectedTenantId || quantamiseTenant?.id;
    
    if (!tenantId) {
      toast.error("Please select a tenant");
      return;
    }
    
    if (!newOwnerEmail) {
      toast.error("Owner email is required");
      return;
    }
    
    fixOwnershipMutation.mutate({
      tenantId,
      ownerEmail: newOwnerEmail,
      ownerName: newOwnerName,
    });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-600" />
            Fix Tenant Ownership
          </h1>
          <p className="text-slate-600">Resolve tenant ownership conflicts and security issues</p>
        </div>

        {/* Security Alert */}
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Security Issue Detected:</strong> Super Admin account is associated with tenant accounts. 
            This is a major security risk. Use this tool to separate Super Admin from tenant ownership.
          </AlertDescription>
        </Alert>

        {/* Quick Fix for Quantamise Code */}
        {quantamiseTenant && (
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-900">Quick Fix Available</CardTitle>
              <CardDescription className="text-amber-700">
                We detected "Quantamise Code" tenant that needs ownership correction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <p className="text-sm font-medium text-slate-900 mb-2">Current Tenant:</p>
                <p className="text-lg font-bold text-slate-900">{quantamiseTenant.name}</p>
                <p className="text-sm text-slate-600">Current Owner: {quantamiseTenant.owner_email}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>New Owner Email *</Label>
                  <Input
                    type="email"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="prateek@quantamisecode.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>New Owner Name</Label>
                  <Input
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Prateek Shukla"
                  />
                </div>
              </div>

              <Button
                onClick={() => {
                  setSelectedTenantId(quantamiseTenant.id);
                  handleFix();
                }}
                disabled={fixOwnershipMutation.isPending}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                {fixOwnershipMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fixing Ownership...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Fix Quantamise Code Ownership
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manual Fix for Other Tenants */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Tenant Ownership Fix</CardTitle>
            <CardDescription>
              Fix ownership for any tenant by selecting it and providing correct owner details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Tenant</Label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a tenant...</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.owner_email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>New Owner Email *</Label>
              <Input
                type="email"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="owner@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label>New Owner Name</Label>
              <Input
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                placeholder="Owner Name"
              />
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <strong>What this does:</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Creates/updates tenant admin user with provided email</li>
                  <li>Ensures the user is NOT a Super Admin</li>
                  <li>Updates tenant's owner information</li>
                  <li>Removes Super Admin association from tenant</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleFix}
              disabled={fixOwnershipMutation.isPending || !selectedTenantId}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {fixOwnershipMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Fix Ownership
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Security Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Super Admin should never be associated with any tenant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Each tenant should have its own dedicated admin user</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Tenant admin users should have is_super_admin set to false</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Owner email should match the tenant admin user's email</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

