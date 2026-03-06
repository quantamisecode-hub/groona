import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Crown, Filter, X, Briefcase, Eye, TrendingUp, Building2, Search, Mail, ExternalLink, Sparkles, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PresenceIndicator from "../components/shared/PresenceIndicator";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import { useUser } from "../components/shared/UserContext";

export default function Team() {
  const { user: currentUser, effectiveTenantId } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      const allUsers = await groonabackend.entities.User.list();
      let filteredUsers = effectiveTenantId ? allUsers.filter(u => u.tenant_id === effectiveTenantId) : (currentUser?.is_super_admin ? allUsers : []);

      let allProfiles = [];
      try {
        allProfiles = await groonabackend.entities.UserProfile.list();
      } catch (error) {
        console.error('[Team] Error fetching user profiles:', error);
      }

      const profileMap = new Map();
      allProfiles.forEach(profile => {
        if (profile.user_id) profileMap.set(profile.user_id, profile);
      });

      return filteredUsers.map((user) => {
        const profile = profileMap.get(user.id) || profileMap.get(user._id);
        return {
          ...user,
          job_title: profile?.job_title || user.job_title || '',
          department: profile?.department || user.department || '',
          bio: profile?.bio || user.bio || '',
          phone: profile?.phone || user.phone || '',
        };
      });
    },
    enabled: !!currentUser,
    refetchInterval: 10000,
  });

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => !user.is_super_admin)
      .filter(user => !(user.role === 'member' && user.custom_role === 'client'))
      .filter(user => {
        const searchLower = searchQuery.toLowerCase();
        const searchMatch = (
          user.full_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.role?.toLowerCase().includes(searchLower) ||
          user.custom_role?.toLowerCase().includes(searchLower) ||
          user.department?.toLowerCase().includes(searchLower)
        );

        let roleMatch = true;
        if (roleFilter !== "all") {
          roleMatch = (roleFilter === "project_manager")
            ? (user.role === 'project_manager' || user.custom_role === 'project_manager')
            : (user.role === roleFilter || user.custom_role === roleFilter);
        }
        return searchMatch && roleMatch;
      });
  }, [users, searchQuery, roleFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || roleFilter !== "all";
  const userRole = currentUser?.is_super_admin || currentUser?.role === 'admin' ? 'admin' : 'member';

  if (!currentUser) return null;

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="team">
      <FeatureOnboarding currentUser={currentUser} featureArea="team" userRole={userRole} />

      <div className="min-h-screen bg-[#f8f9fa] w-full flex flex-col">
        {/* Apple-style Premium Header */}
        <header className="pt-8 pb-8 px-6 md:px-12 lg:px-16 sticky top-0 z-30 bg-[#f8f9fa]">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1 mt-2">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                  Team Members
                </h1>
                <p className="text-[15px] text-slate-500 font-medium">
                  {filteredUsers.length} active {filteredUsers.length === 1 ? 'member' : 'members'} in your workspace
                </p>
              </div>

              {/* Refined Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, role, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-white border-slate-200/80 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all rounded-[14px] text-[15px] placeholder:text-slate-400 shadow-sm"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-11 w-full sm:w-[150px] rounded-[14px] bg-white border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors text-[15px]">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="member">Members</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="project_manager">Project Managers</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFilters}
                      className="h-11 w-11 rounded-[14px] hover:bg-slate-200/50 hover:text-slate-700 transition-colors bg-white border border-slate-200/80 shadow-sm text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Members Grid Section */}
        <main className="flex-1 px-6 md:px-12 lg:px-16 py-4">
          <div className="max-w-[1400px] mx-auto h-full">
            {isLoading && users.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="bg-white border text-center border-slate-200/60 rounded-[28px] p-8 shadow-sm flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-slate-100 animate-pulse mb-6" />
                    <div className="h-5 w-3/4 bg-slate-100 animate-pulse rounded-md mb-3" />
                    <div className="h-4 w-1/2 bg-slate-100 animate-pulse rounded-md mb-6" />
                    <div className="w-full flex justify-center gap-3">
                      <div className="h-8 w-8 bg-slate-100 animate-pulse rounded-full" />
                      <div className="h-8 w-8 bg-slate-100 animate-pulse rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-white border border-slate-200 rounded-3xl flex items-center justify-center shadow-sm mb-5">
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No members found</h3>
                <p className="text-[15px] text-slate-500 mb-6 max-w-[300px]">
                  Try adjusting your search or filters to discover other team members.
                </p>
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 h-10 px-6 rounded-xl font-medium"
                >
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start pb-20">
                {filteredUsers.map((member) => (
                  <div
                    key={member.id}
                    className="group relative bg-white border border-slate-200/60 rounded-[28px] p-8 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-slate-300 transition-all duration-300 flex flex-col items-center text-center cursor-pointer"
                  >
                    {/* Role Badges */}
                    <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10">
                      {member.custom_role === 'owner' ? (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-100 font-semibold px-2 py-0.5 mt-0 rounded-lg text-[10px] shadow-none uppercase tracking-wide">
                          <Crown className="w-3 h-3 mr-1" /> Admin
                        </Badge>
                      ) : (member.role === 'project_manager' || member.custom_role === 'project_manager') ? (
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200/50 hover:bg-purple-100 font-semibold px-2 py-0.5 mt-0 rounded-lg text-[10px] shadow-none uppercase tracking-wide">
                          Project Manager
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-100 font-semibold px-2 py-0.5 mt-0 rounded-lg text-[10px] shadow-none uppercase tracking-wide">
                          Member
                        </Badge>
                      )}
                    </div>

                    {/* Avatar with Presence */}
                    <div className="relative mb-5 transition-transform duration-300 group-hover:scale-105">
                      <div className="w-[100px] h-[100px] rounded-full p-[3px] bg-gradient-to-tr from-slate-100 to-slate-200 mx-auto shadow-sm">
                        <Avatar className="w-full h-full rounded-full border-[3px] border-white bg-white">
                          <AvatarImage
                            src={member.profile_image_url || member.profile_picture_url}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-slate-50 text-slate-400 text-2xl font-semibold">
                            {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="absolute right-1 bottom-2 ring-4 ring-white rounded-full">
                        <PresenceIndicator status={member.presence_status || 'offline'} size="md" />
                      </div>
                    </div>

                    {/* Member Details */}
                    <div className="w-full flex-1 flex flex-col items-center min-h-[90px]">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate w-full px-2 mb-1">
                        {member.full_name || 'Anonymous User'}
                      </h3>
                      <p className="text-[13px] font-medium text-slate-500 mb-3 px-2 line-clamp-1 w-full">
                        {member.job_title || 'Team Member'}
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-auto w-full">
                        {member.department && (
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate max-w-[90px]">{member.department}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md" title={member.email}>
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{member.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </OnboardingProvider>
  );
}