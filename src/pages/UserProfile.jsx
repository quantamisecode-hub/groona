import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JOB_TITLES, DEPARTMENTS } from "@/components/profile/ProfileInformation";
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Building2,
  Loader2, 
  Save,
  AlertCircle,
  Upload,
  Camera
} from "lucide-react";
import { toast } from "sonner";
import PresenceStatusSelector from "../components/shared/PresenceStatusSelector";
import SecuritySettings from "../components/profile/SecuritySettings";

export default function UserProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    address: '',
    department: '',
    job_title: '',
    bio: '',
  });
  const queryClient = useQueryClient();

  // Fetch current user with useQuery for better caching and real-time updates
  const { data: currentUser, refetch: refetchUser } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const user = await groonabackend.auth.me();
      return user;
    },
    staleTime: 0, // Always fetch fresh data
    refetchInterval: isEditing ? false : 10000, // Disable refetch when editing to prevent form reset
  });

  // Listen for profile update events (including presence and photo updates)
  useEffect(() => {
    const handleProfileUpdate = () => {
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
    };

    const handlePresenceUpdate = () => {
      refetchUser();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    window.addEventListener('presence-updated', handlePresenceUpdate);
    
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
      window.removeEventListener('presence-updated', handlePresenceUpdate);
    };
  }, [refetchUser, queryClient, currentUser?.id]);

  // Fetch user profile
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      
      console.log('[UserProfile] Fetching profile for user:', currentUser.id);
      const profiles = await groonabackend.entities.UserProfile.filter({ user_id: currentUser.id });
      
      if (profiles.length > 0) {
        console.log('[UserProfile] Profile found:', profiles[0]);
        return profiles[0];
      }
      
      // Create profile if it doesn't exist
      console.log('[UserProfile] No profile found, creating new one');
      const newProfile = await groonabackend.entities.UserProfile.create({
        user_id: currentUser.id,
        user_email: currentUser.email,
        tenant_id: currentUser.tenant_id,
        full_name: currentUser.full_name,
        phone: '',
        address: '',
        profile_image_url: currentUser.profile_image_url || '',
        preferences: {
          theme: 'system',
          notifications_enabled: true,
          email_notifications: true,
        }
      });
      console.log('[UserProfile] New profile created:', newProfile);
      return newProfile;
    },
    enabled: !!currentUser,
    refetchInterval: isEditing ? false : 10000, // Disable refetch when editing to prevent form reset
  });

  // Fetch tenant information
  const { data: tenant } = useQuery({
    queryKey: ['user-tenant', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return null;
      const tenants = await groonabackend.entities.Tenant.filter({ id: currentUser.tenant_id });
      return tenants[0] || null;
    },
    enabled: !!currentUser && !currentUser.is_super_admin,
  });

  // Initialize form data when profile loads
  // Only reset form when NOT editing to prevent losing user input
  useEffect(() => {
    if (userProfile && !isEditing) {
      setProfileData({
        full_name: userProfile.full_name || currentUser?.full_name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        department: userProfile.department || '',
        job_title: userProfile.job_title || '',
        bio: userProfile.bio || '',
      });
    }
  }, [userProfile, currentUser, isEditing]);

  // Handle profile photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      console.log('[UserProfile] Uploading photo...');
      
      // Upload file to groonabackend
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      console.log('[UserProfile] Photo uploaded:', file_url);

      // Update User entity via auth API
      await groonabackend.auth.updateMe({ profile_image_url: file_url });
      console.log('[UserProfile] User profile_image_url updated');

      // Update UserProfile entity
      if (userProfile?.id) {
        await groonabackend.entities.UserProfile.update(userProfile.id, {
          profile_image_url: file_url
        });
        console.log('[UserProfile] UserProfile profile_image_url updated');
      }

      // Invalidate queries and trigger real-time update
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      
      // Dispatch event for real-time updates
      window.dispatchEvent(new CustomEvent('profile-updated'));
      
      toast.success('Profile photo updated!');
      setUploadingPhoto(false);
    } catch (error) {
      console.error('[UserProfile] Failed to upload photo:', error);
      toast.error('Failed to upload photo. Please try again.');
      setUploadingPhoto(false);
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      console.log('[UserProfile] Updating profile with data:', data);
      
      // CRITICAL FIX: Update User entity's full_name directly
      console.log('[UserProfile] Step 1: Updating User.full_name via auth API...');
      await groonabackend.auth.updateMe({ full_name: data.full_name });
      console.log('[UserProfile] User.full_name updated');

      // Wait for backend sync
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Update UserProfile entity
      console.log('[UserProfile] Step 2: Updating UserProfile entity...');
      const updatedProfile = await groonabackend.entities.UserProfile.update(userProfile.id, {
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
        department: data.department,
        job_title: data.job_title,
        bio: data.bio,
      });
      console.log('[UserProfile] Profile updated:', updatedProfile);

      return { updatedProfile, newFullName: data.full_name };
    },
    onSuccess: async ({ newFullName }) => {
      console.log('[UserProfile] Profile update successful, reloading page...');
      
      // Show success message
      toast.success('Profile updated successfully! Refreshing page...');
      
      // CRITICAL FIX: Force page reload to ensure all components refresh with new data
      // This is the most reliable way to ensure the sidebar and all other components update
      setTimeout(() => {
        window.location.reload();
      }, 800);
    },
    onError: (error) => {
      console.error('[UserProfile] Failed to update profile:', error);
      toast.error('Failed to update profile', {
        description: error.message || 'Please try again.'
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!profileData.full_name || !profileData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }

    if (!profileData.job_title || !profileData.job_title.trim()) {
      toast.error('Job title is required');
      return;
    }

    if (!profileData.department || !profileData.department.trim()) {
      toast.error('Department is required');
      return;
    }

    updateProfileMutation.mutate(profileData);
  };

  const handleCancel = () => {
    if (userProfile) {
      setProfileData({
        full_name: userProfile.full_name || currentUser?.full_name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        department: userProfile.department || '',
        job_title: userProfile.job_title || '',
        bio: userProfile.bio || '',
      });
    }
    setIsEditing(false);
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  // Show loading only if user is not loaded yet (not waiting for profile)
  if (!currentUser) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Profile & Settings</h1>
          <p className="text-slate-600">Manage your account information and preferences</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Summary Card */}
        <Card className="lg:col-span-1 bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Profile Photo with Upload */}
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-slate-200">
                  <AvatarImage 
                    src={currentUser.profile_image_url || currentUser.profile_picture_url} 
                    alt={currentUser.full_name}
                    key={`${currentUser.id}-${currentUser.profile_image_url || currentUser.profile_picture_url}`}
                  />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {getInitials(profileData.full_name || currentUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Upload button overlay */}
                <label 
                  htmlFor="photo-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  ) : (
                    <Camera className="h-8 w-8 text-white" />
                  )}
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-900">
                  {profileData.full_name || currentUser.full_name}
                </h2>
                <p className="text-slate-600">{currentUser.email}</p>
                {profileData.job_title && (
                  <p className="text-sm text-slate-500">{profileData.job_title}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {currentUser.is_super_admin && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    Super Admin
                  </span>
                )}
                {/* Owner: Show both Admin and Owner badges */}
                {!currentUser.is_super_admin && currentUser.custom_role === 'owner' && (
                  <>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      Admin
                    </span>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      Owner
                    </span>
                  </>
                )}
                {/* Project Manager: Show only Project Manager badge, not Admin */}
                {!currentUser.is_super_admin && currentUser.custom_role === 'project_manager' && (
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    Project Manager
                  </span>
                )}
                {/* Regular Admin: Show Admin badge (not owner, not project manager) */}
                {!currentUser.is_super_admin && currentUser.role === 'admin' && currentUser.custom_role !== 'owner' && currentUser.custom_role !== 'project_manager' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Admin
                  </span>
                )}
                {currentUser.role === 'user' && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    User
                  </span>
                )}
                {tenant && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {tenant.name}
                  </span>
                )}
              </div>

              <div className="w-full pt-4 border-t border-slate-200">
                <PresenceStatusSelector user={currentUser} />
              </div>

              {profileData.bio && (
                <div className="w-full pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 text-left">{profileData.bio}</p>
                </div>
              )}

              <div className="w-full pt-4 border-t border-slate-200 space-y-2 text-left text-sm">
                {tenant && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-xs text-slate-500">
                        {tenant.subscription_plan.charAt(0).toUpperCase() + tenant.subscription_plan.slice(1)} Plan
                      </div>
                    </div>
                  </div>
                )}
                {profileData.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4" />
                    <span>{profileData.phone}</span>
                  </div>
                )}
                {profileData.address && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="h-4 w-4" />
                    <span>{profileData.address}</span>
                  </div>
                )}
                {profileData.department && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Briefcase className="h-4 w-4" />
                    <span>{profileData.department}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Profile Details */}
          <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Profile Information</CardTitle>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} variant="outline">
                Edit Profile
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900 text-sm">
                    Changes to your profile will be reflected everywhere. The page will refresh automatically after saving.
                  </AlertDescription>
                </Alert>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      placeholder="John Doe"
                      required
                      disabled={updateProfileMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={currentUser.email}
                      disabled
                      className="bg-slate-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">Email cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      disabled={updateProfileMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title *</Label>
                    <Select
                      value={profileData.job_title || ""}
                      onValueChange={(value) => setProfileData({ ...profileData, job_title: value })}
                      disabled={updateProfileMutation.isPending}
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
                      disabled={updateProfileMutation.isPending}
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
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      placeholder="123 Main St, City, State"
                      disabled={updateProfileMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    disabled={updateProfileMutation.isPending}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <UserIcon className="h-4 w-4" />
                      <span>Full Name</span>
                    </div>
                    <p className="font-medium text-slate-900">{profileData.full_name || currentUser.full_name || '—'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </div>
                    <p className="font-medium text-slate-900">{currentUser.email}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Phone className="h-4 w-4" />
                      <span>Phone</span>
                    </div>
                    <p className="font-medium text-slate-900">{profileData.phone || '—'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Briefcase className="h-4 w-4" />
                      <span>Job Title</span>
                    </div>
                    <p className="font-medium text-slate-900">{profileData.job_title || '—'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Briefcase className="h-4 w-4" />
                      <span>Department</span>
                    </div>
                    <p className="font-medium text-slate-900">{profileData.department || '—'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>Address</span>
                    </div>
                    <p className="font-medium text-slate-900">{profileData.address || '—'}</p>
                  </div>

                  {tenant && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Building2 className="h-4 w-4" />
                        <span>Organization</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{tenant.name}</p>
                        <p className="text-xs text-slate-500">
                          {tenant.subscription_plan.charAt(0).toUpperCase() + tenant.subscription_plan.slice(1)} Plan
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {profileData.bio && (
                  <div className="space-y-2 pt-4 border-t border-slate-200">
                    <div className="text-slate-500 text-sm">Bio</div>
                    <p className="text-slate-900">{profileData.bio}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <SecuritySettings user={currentUser} onUpdate={refetchUser} />
        </div>
      </div>
    </div>
  );
}

