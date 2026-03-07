import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Camera,
  X,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
    gender: '',
    bio: '',
  });
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser, refetch: refetchUser } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const user = await groonabackend.auth.me();
      return user;
    },
    staleTime: 0,
    refetchInterval: isEditing ? false : 10000,
  });

  // Listen for updates
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
      const profiles = await groonabackend.entities.UserProfile.filter({ user_id: currentUser.id });

      if (profiles.length > 0) return profiles[0];

      return await groonabackend.entities.UserProfile.create({
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
    },
    enabled: !!currentUser,
    refetchInterval: isEditing ? false : 10000,
  });

  // Fetch tenant info
  const { data: tenant } = useQuery({
    queryKey: ['user-tenant', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return null;
      const tenants = await groonabackend.entities.Tenant.filter({ id: currentUser.tenant_id });
      return tenants[0] || null;
    },
    enabled: !!currentUser && !currentUser.is_super_admin,
  });

  // Initialize form
  useEffect(() => {
    if (userProfile && !isEditing) {
      setProfileData({
        full_name: userProfile.full_name || currentUser?.full_name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        department: userProfile.department || '',
        job_title: userProfile.job_title || '',
        gender: userProfile.gender || '',
        bio: userProfile.bio || '',
      });
    }
  }, [userProfile, currentUser, isEditing]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      await groonabackend.auth.updateMe({ profile_image_url: file_url });
      if (userProfile?.id) {
        await groonabackend.entities.UserProfile.update(userProfile.id, {
          profile_image_url: file_url
        });
      }
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      window.dispatchEvent(new CustomEvent('profile-updated'));
      toast.success('Profile photo updated!');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      await groonabackend.auth.updateMe({ full_name: data.full_name, gender: data.gender });
      await new Promise(resolve => setTimeout(resolve, 300));
      return await groonabackend.entities.UserProfile.update(userProfile.id, {
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
        department: data.department,
        job_title: data.job_title,
        gender: data.gender,
        bio: data.bio,
      });
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      setTimeout(() => window.location.reload(), 800);
    },
    onError: (error) => {
      toast.error('Failed to update profile', { description: error.message });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!profileData.full_name?.trim()) return toast.error('Full name is required');
    if (!profileData.job_title?.trim()) return toast.error('Job title is required');
    if (!profileData.department?.trim()) return toast.error('Department is required');
    updateProfileMutation.mutate(profileData);
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  if (!currentUser) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Identity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-10 space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Dynamic Breadcrumb/Path UI */}
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        <span className="hover:text-slate-900 cursor-pointer transition-colors">Workspace</span>
        <ChevronRight className="h-3 w-3" />
        <span className="hover:text-slate-900 cursor-pointer transition-colors">Identity</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-blue-600">Profile Settings</span>
      </div>

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-100">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Security Center</h1>
          <p className="text-sm font-medium text-slate-500 max-w-md">Manage your professional identity, security protocols and system integration parameters.</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="h-11 px-6 bg-slate-900 text-white hover:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-slate-200 transition-all active:scale-95 flex items-center gap-2"
            >
              Edit Parameters
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-12">
        {/* Sidebar Panel */}
        <div className="lg:col-span-4 space-y-10">
          <div className="relative flex flex-col items-center group">
            <div className="relative isolate">
              {/* Decorative rings */}
              <div className="absolute inset-0 -m-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full blur-3xl opacity-50 -z-10 group-hover:opacity-80 transition-opacity" />

              <Avatar className="h-44 w-44 border-[10px] border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative transition-transform duration-500 group-hover:scale-[1.02]">
                <AvatarImage
                  src={currentUser.profile_image_url || currentUser.profile_picture_url}
                  className="object-cover"
                />
                <AvatarFallback className="text-5xl bg-slate-900 text-white font-black">
                  {getInitials(profileData.full_name || currentUser.full_name)}
                </AvatarFallback>
              </Avatar>

              <label
                htmlFor="photo-upload"
                className="absolute bottom-2 right-2 z-20 h-10 w-10 bg-white border border-slate-100 rounded-full flex items-center justify-center cursor-pointer shadow-xl hover:bg-slate-50 transition-all hover:scale-110 active:scale-90"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-slate-600" />
                )}
                <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" />
              </label>
            </div>

            <div className="mt-8 text-center space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{currentUser.full_name}</h2>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{currentUser.job_title || "Unassigned"}</span>
                <span className="text-[10px] font-bold text-slate-400 lowercase">{currentUser.email}</span>
              </div>
            </div>

            <div className="mt-8 w-full p-8 bg-white border border-slate-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[40px] space-y-6">
              <div className="flex flex-wrap justify-center gap-2">
                {currentUser.is_super_admin && (
                  <span className="px-2.5 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Superuser</span>
                )}
                {currentUser.custom_role === 'owner' && (
                  <span className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Owner</span>
                )}
                {currentUser.custom_role === 'project_manager' && (
                  <span className="px-2.5 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Project Manager</span>
                )}
                {currentUser.role === 'admin' && currentUser.custom_role !== 'owner' && currentUser.custom_role !== 'project_manager' && (
                  <span className="px-2.5 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Admin</span>
                )}
                {(currentUser.role === 'user' || currentUser.role === 'member') && (
                  <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-full">Member</span>
                )}
                {tenant && (
                  <div className="px-2.5 py-1 bg-slate-50 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-slate-100 flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    {tenant.name}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-50 flex flex-col gap-4">
                <PresenceStatusSelector user={currentUser} />
                <div className="flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Identity Verified</span>
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6 rounded-[40px] bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-blue-400" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Data Context</h4>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Entry ID</span>
                <span className="text-xs font-mono text-slate-300 truncate">{currentUser.id}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Last Access</span>
                <span className="text-xs font-medium text-slate-200">
                  {new Date(currentUser.last_seen || Date.now()).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-16">

          {/* Metadata Section */}
          <section className="space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <h3 className="text-xs font-black text-slate-900 tracking-[0.3em] uppercase">Identity Metadata</h3>
              </div>
              {isEditing && (
                <Button variant="ghost" onClick={() => setIsEditing(false)} className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">
                  <X className="h-3 w-3 mr-1" /> Terminate Edit
                </Button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <UserIcon className="h-3 w-3" /> Full Identity
                    </Label>
                    <Input value={profileData.full_name} onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })} className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-2xl font-semibold px-5 transition-all" required />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 flex items-center gap-2">
                      <Mail className="h-3 w-3" /> Communication Node
                    </Label>
                    <Input value={currentUser.email} disabled className="h-12 bg-white border border-slate-100 rounded-2xl font-semibold px-5 text-slate-300 cursor-not-allowed italic" />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <Phone className="h-3 w-3" /> Audio Link
                    </Label>
                    <Input value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-2xl font-semibold px-5 transition-all" placeholder="Network protocol address" />
                  </div>

                  <div className="space-y-4 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <UserIcon className="h-3 w-3" /> Gender Specification
                    </Label>
                    <Select value={profileData.gender || ""} onValueChange={(value) => setProfileData({ ...profileData, gender: value })}>
                      <SelectTrigger className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-2xl font-semibold px-5 transition-all text-left">
                        <SelectValue placeholder="Binary/Non-Binary Origin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male Origin</SelectItem>
                        <SelectItem value="Female">Female Origin</SelectItem>
                        <SelectItem value="Others">Others / Specified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <Briefcase className="h-3 w-3" /> Strategic Role
                    </Label>
                    <Select value={profileData.job_title || ""} onValueChange={(value) => setProfileData({ ...profileData, job_title: value })} required>
                      <SelectTrigger className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-2xl font-semibold px-5 transition-all text-left">
                        <SelectValue placeholder="Designation Hierarchy" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_TITLES.map((title) => <SelectItem key={title} value={title}>{title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <Building2 className="h-3 w-3" /> Tactical Division
                    </Label>
                    <Select value={profileData.department || ""} onValueChange={(value) => setProfileData({ ...profileData, department: value })} required>
                      <SelectTrigger className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-2xl font-semibold px-5 transition-all text-left">
                        <SelectValue placeholder="Functional Group" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <MapPin className="h-3 w-3" /> Geolocation Coordinate
                    </Label>
                    <Input value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-2xl font-semibold px-5 transition-all" />
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      Professional Abstract
                    </Label>
                    <Textarea value={profileData.bio} onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })} rows={5} className="bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-[32px] font-semibold p-6 transition-all resize-none leading-relaxed" placeholder="Summarize your professional trajectory..." />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-6 pt-10 border-t border-slate-100">
                  <Button type="submit" disabled={updateProfileMutation.isPending} className="h-14 px-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-3">
                    {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4" />}
                    Commit Identity Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-16">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                  {[
                    { label: "Legal Identity", value: profileData.full_name || currentUser.full_name, icon: UserIcon },
                    { label: "Network Protocol", value: currentUser.email, icon: Mail },
                    { label: "Audio Connectivity", value: profileData.phone || "Not Integrated", icon: Phone },
                    { label: "Origin Specification", value: profileData.gender || "Undefined", icon: UserIcon },
                    { label: "Designation Level", value: profileData.job_title || "L0 - Unassigned", icon: Briefcase },
                    { label: "Unit Deployment", value: profileData.department || "General Corps", icon: Building2 },
                    { label: "Station Alignment", value: profileData.address || "Remote Node", icon: MapPin },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-2 group cursor-default">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-blue-600 transition-colors duration-300">
                        <item.icon className="h-3 w-3 stroke-[3px]" />
                        <span>{item.label}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 tracking-tight leading-tight">{item.value}</p>
                    </div>
                  ))}
                </div>

                {profileData.bio && (
                  <div className="p-8 rounded-[40px] bg-slate-50/50 border border-slate-100/50 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Professional Abstract</h4>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                      "{profileData.bio}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Infrastructure & Security */}
          <section className="space-y-10 pt-16 border-t border-slate-100 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 bg-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900">Security Architecture</span>
            </div>
            <SecuritySettings user={currentUser} onUpdate={refetchUser} />
          </section>
        </div>
      </div>
    </div>
  );
}

