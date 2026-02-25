import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Save, Building2 } from "lucide-react";
import { toast } from "sonner";
import { JOB_TITLES, DEPARTMENTS } from "@/components/profile/ProfileInformation";

export default function EditUserDialog({ open, onClose, user, currentUser, effectiveTenantId }) {
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    address: '',
    department: '',
    job_title: '',
    bio: '',
  });
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const queryClient = useQueryClient();

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants-for-edit'],
    queryFn: async () => {
      if (currentUser?.is_super_admin) {
        return groonabackend.entities.Tenant.list();
      } else if (effectiveTenantId) {
        const tenantList = await groonabackend.entities.Tenant.filter({ id: effectiveTenantId });
        return tenantList;
      }
      return [];
    },
    enabled: open && !!currentUser,
  });

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile-edit', user.id],
    queryFn: async () => {
      const profiles = await groonabackend.entities.UserProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: open && !!user,
  });

  useEffect(() => {
    if (user) {
      const tenantToUse = user.tenant_id || effectiveTenantId || "";
      setSelectedTenantId(tenantToUse);
      
      // Merge User entity data (priority) with UserProfile data
      setProfileData({
        full_name: user.full_name || '',
        phone: user.phone_number || userProfile?.phone || '',
        address: userProfile?.address || '',
        department: user.department || userProfile?.department || '',
        job_title: user.job_title || userProfile?.job_title || '',
        bio: userProfile?.bio || '',
      });
    }
  }, [userProfile, user, effectiveTenantId]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenantId) throw new Error('Tenant ID is required');
      if (!profileData.full_name?.trim()) throw new Error('Full name is required');
      
      // STEP 1: Update User entity (CRITICAL: Saves job_title to main DB)
      const updatedUser = await groonabackend.entities.User.update(user.id, {
        full_name: profileData.full_name.trim(),
        tenant_id: selectedTenantId,
        job_title: profileData.job_title?.trim(),
        department: profileData.department?.trim(),
        phone_number: profileData.phone?.trim()
      });
      
      // STEP 2: Update or create UserProfile
      // Validate required fields
      if (!profileData.job_title?.trim()) {
        toast.error('Job title is required');
        throw new Error('Job title is required');
      }

      if (!profileData.department?.trim()) {
        toast.error('Department is required');
        throw new Error('Department is required');
      }

      let updatedProfile;
      const commonProfileData = {
        full_name: profileData.full_name.trim(),
        phone: profileData.phone?.trim() || undefined,
        address: profileData.address?.trim() || undefined,
        department: profileData.department.trim(), // Required - don't allow undefined
        job_title: profileData.job_title.trim(), // Required - don't allow undefined
        bio: profileData.bio?.trim() || undefined,
        tenant_id: selectedTenantId,
      };

      if (userProfile?.id) {
        updatedProfile = await groonabackend.entities.UserProfile.update(userProfile.id, commonProfileData);
      } else {
        updatedProfile = await groonabackend.entities.UserProfile.create({
          ...commonProfileData,
          user_id: user.id,
          user_email: user.email,
        });
      }

      return { updatedUser, updatedProfile };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile-edit'] });
      toast.success('User profile updated successfully!');
      onClose();
    },
    onError: (error) => {
      setUpdateError(error?.message || 'Failed to update profile');
      toast.error(`Error: ${error?.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setUpdateError(null);
    updateProfileMutation.mutate();
  };

  if (profileLoading || tenantsLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
          <DialogDescription>Update information for {user.full_name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {updateError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{updateError}</AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" value={user.email} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_title">Job Title *</Label>
              <Select
                value={profileData.job_title || ""}
                onValueChange={(value) => setProfileData({ ...profileData, job_title: value })}
                required
              >
                <SelectTrigger id="job_title">
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={profileData.department || ""}
                onValueChange={(value) => setProfileData({ ...profileData, department: value })}
                required
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={profileData.address}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                placeholder="City, State"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profileData.bio}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

