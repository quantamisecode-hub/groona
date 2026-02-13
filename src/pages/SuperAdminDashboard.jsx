import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Users, FolderKanban, TrendingUp, Shield, Eye, Settings, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CreateTenantDialog from "../components/super-admin/CreateTenantDialog";
import TenantCard from "../components/super-admin/TenantCard";
import TenantConfigManager from "../components/super-admin/TenantConfigManager";
import FeatureFlagManager from "../components/super-admin/FeatureFlagManager";
import IndustryTemplateManager from "../components/super-admin/IndustryTemplateManager";
import TerminologyManager from "../components/super-admin/TerminologyManager";
import SLAGuardrailsManager from "../components/super-admin/SLAGuardrailsManager";
import TenantRecoveryTools from "../components/super-admin/TenantRecoveryTools";
import CrossTenantInsights from "../components/super-admin/CrossTenantInsights";
import SuperAdminAuditViewer from "../components/super-admin/SuperAdminAuditViewer";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SuperAdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("tenants");
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

  // Fetch all tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list('-created_date'),
  });

  // Fetch all users across tenants
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  // Fetch all projects across tenants
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  // Create tenant mutation with proper user creation
  const createTenantMutation = useMutation({
    mutationFn: async (tenantData) => {
      // Step 1: Create the tenant
      const newTenant = await groonabackend.entities.Tenant.create(tenantData);
      
      // Step 2: Create the tenant admin user (separate from Super Admin)
      try {
        // Check if a user with this email already exists
        const existingUsers = await groonabackend.entities.User.filter({ 
          email: tenantData.owner_email 
        });
        
        let tenantAdminUser;
        if (existingUsers.length > 0) {
          // Update existing user to be associated with this tenant
          tenantAdminUser = await groonabackend.entities.User.update(existingUsers[0].id, {
            tenant_id: newTenant.id,
            role: 'admin',
            full_name: tenantData.owner_name || existingUsers[0].full_name,
          });
        } else {
          // Create new user for this tenant
          tenantAdminUser = await groonabackend.entities.User.create({
            email: tenantData.owner_email,
            full_name: tenantData.owner_name || tenantData.owner_email.split('@')[0],
            role: 'admin',
            tenant_id: newTenant.id,
            is_super_admin: false, // CRITICAL: Ensure this is NOT a super admin
            account_status: 'active',
          });
        }
        
        // Step 3: Update tenant with the user's ID
        await groonabackend.entities.Tenant.update(newTenant.id, {
          owner_user_id: tenantAdminUser.id,
        });
        
        return newTenant;
      } catch (error) {
        console.error('Failed to create tenant admin user:', error);
        // If user creation fails, delete the tenant to maintain consistency
        await groonabackend.entities.Tenant.delete(newTenant.id);
        throw new Error('Failed to create tenant admin user: ' + error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setShowCreateDialog(false);
      toast.success("Tenant and admin user created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create tenant: " + error.message);
    },
  });

  // Update tenant mutation with detailed logging
  const updateTenantMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('[SuperAdminDashboard] Updating tenant:', id);
      console.log('[SuperAdminDashboard] Update data:', JSON.stringify(data, null, 2));
      
      const result = await groonabackend.entities.Tenant.update(id, data);
      
      console.log('[SuperAdminDashboard] Update result:', result);
      
      return result;
    },
    onSuccess: (result, variables) => {
      console.log('[SuperAdminDashboard] Update successful!');
      console.log('[SuperAdminDashboard] Variables:', variables);
      
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success("Tenant updated successfully! Changes will take effect immediately.");
    },
    onError: (error, variables) => {
      console.error('[SuperAdminDashboard] Update failed:', error);
      console.error('[SuperAdminDashboard] Failed for tenant:', variables.id);
      console.error('[SuperAdminDashboard] With data:', variables.data);
      
      toast.error("Failed to update tenant: " + error.message);
    },
  });

  // Delete tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (id) => {
      // First, delete all users associated with this tenant
      const tenantUsers = allUsers.filter(u => u.tenant_id === id);
      for (const user of tenantUsers) {
        try {
          await groonabackend.entities.User.delete(user.id);
        } catch (error) {
          console.error('Failed to delete user:', error);
        }
      }
      
      // Then delete the tenant
      await groonabackend.entities.Tenant.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success("Tenant and associated users deleted");
    },
  });

  // Calculate stats
  const activeTenants = tenants.filter(t => t.status === 'active');
  const trialTenants = tenants.filter(t => t.status === 'trial');
  const suspendedTenants = tenants.filter(t => t.status === 'suspended');

  // Filter tenants based on status and search
  const filteredTenants = tenants.filter(tenant => {
    const matchesStatus = !filterStatus || tenant.status === filterStatus;
    const matchesSearch = !searchQuery || 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.owner_email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCardClick = (status) => {
    if (filterStatus === status) {
      setFilterStatus(null); // Clear filter if clicking same card
    } else {
      setFilterStatus(status);
    }
  };

  const clearFilters = () => {
    setFilterStatus(null);
    setSearchQuery("");
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-slate-300 animate-pulse" />
            <p className="text-slate-600">Loading...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <Shield className="h-8 w-8 text-amber-600" />
              Super Admin Dashboard
            </h1>
            <p className="text-slate-600">Manage all tenants and platform settings</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              filterStatus === null ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleCardClick(null)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Tenants</p>
                  <p className="text-3xl font-bold text-slate-900">{tenants.length}</p>
                </div>
                <Building2 className="h-10 w-10 text-blue-600" />
              </div>
              {filterStatus === null && (
                <Badge className="mt-2 bg-blue-100 text-blue-800">Showing All</Badge>
              )}
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              filterStatus === 'active' ? 'ring-2 ring-green-500' : ''
            }`}
            onClick={() => handleCardClick('active')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Active Tenants</p>
                  <p className="text-3xl font-bold text-green-600">{activeTenants.length}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-600" />
              </div>
              {filterStatus === 'active' && (
                <Badge className="mt-2 bg-green-100 text-green-800">Filtered</Badge>
              )}
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              filterStatus === 'trial' ? 'ring-2 ring-amber-500' : ''
            }`}
            onClick={() => handleCardClick('trial')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Trial Tenants</p>
                  <p className="text-3xl font-bold text-amber-600">{trialTenants.length}</p>
                </div>
                <Shield className="h-10 w-10 text-amber-600" />
              </div>
              {filterStatus === 'trial' && (
                <Badge className="mt-2 bg-amber-100 text-amber-800">Filtered</Badge>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-default">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Users</p>
                  <p className="text-3xl font-bold text-purple-600">{allUsers.length}</p>
                </div>
                <Users className="h-10 w-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Governance Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-9 w-full">
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="terminology">Terms</TabsTrigger>
            <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-6 mt-6">
            {/* Search and Filter Bar */}
            <Card className="bg-white/80 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search tenants by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {(filterStatus || searchQuery) && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Active Filters Display */}
            {(filterStatus || searchQuery) && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-sm text-slate-600">Active Filters:</span>
                {filterStatus && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Status: {filterStatus}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterStatus(null);
                      }}
                    />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Search: "{searchQuery}"
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery("");
                      }}
                    />
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {filterStatus 
                  ? `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Tenants` 
                  : 'All Tenants'
                }
                <Badge variant="outline" className="ml-3">
                  {filteredTenants.length} {filteredTenants.length === 1 ? 'tenant' : 'tenants'}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">
                <Shield className="h-12 w-12 mx-auto mb-3 text-slate-300 animate-pulse" />
                <p>Loading tenants...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="mb-2">
                  {tenants.length === 0 
                    ? 'No tenants yet' 
                    : 'No tenants match your filters'
                  }
                </p>
                {tenants.length > 0 && (
                  <Button variant="link" onClick={clearFilters}>
                    Clear filters to see all tenants
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTenants.map(tenant => (
                  <TenantCard
                    key={tenant.id}
                    tenant={tenant}
                    onUpdate={(data) => updateTenantMutation.mutate({ id: tenant.id, data })}
                    onDelete={() => deleteTenantMutation.mutate(tenant.id)}
                    userCount={allUsers.filter(u => u.tenant_id === tenant.id).length}
                    projectCount={allProjects.filter(p => p.tenant_id === tenant.id).length}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6 mt-6">
            <TenantConfigManager />
          </TabsContent>

          <TabsContent value="features" className="space-y-6 mt-6">
            <FeatureFlagManager />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6 mt-6">
            <IndustryTemplateManager />
          </TabsContent>

          <TabsContent value="terminology" className="space-y-6 mt-6">
            <TerminologyManager />
          </TabsContent>

          <TabsContent value="guardrails" className="space-y-6 mt-6">
            <SLAGuardrailsManager />
          </TabsContent>

          <TabsContent value="recovery" className="space-y-6 mt-6">
            <TenantRecoveryTools />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6 mt-6">
            <CrossTenantInsights />
          </TabsContent>

          <TabsContent value="audit" className="space-y-6 mt-6">
            <SuperAdminAuditViewer />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Tenant Dialog */}
      <CreateTenantDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(data) => createTenantMutation.mutate(data)}
        loading={createTenantMutation.isPending}
      />
    </div>
  );
}

