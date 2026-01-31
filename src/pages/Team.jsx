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
import { Users, Crown, Filter, X, Briefcase, Eye, TrendingUp, Building2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PresenceIndicator from "../components/shared/PresenceIndicator";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import { useUser } from "../components/shared/UserContext";

export default function Team() {
  // Use global user context to prevent loading spinner on navigation
  const { user: currentUser, effectiveTenantId } = useUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', effectiveTenantId],
    queryFn: async () => {
      const allUsers = await groonabackend.entities.User.list();

      let filteredUsers = [];
      if (effectiveTenantId) {
        filteredUsers = allUsers.filter(u => u.tenant_id === effectiveTenantId);
      } else {
        // If Super Admin in platform mode, show all (or handle as needed)
        filteredUsers = currentUser?.is_super_admin ? allUsers : [];
      }

      // Fetch all UserProfile data at once for better performance
      let allProfiles = [];
      try {
        allProfiles = await groonabackend.entities.UserProfile.list();
      } catch (error) {
        console.error('[Team] Error fetching user profiles:', error);
      }

      // Create a map of user_id to profile for quick lookup
      const profileMap = new Map();
      allProfiles.forEach(profile => {
        if (profile.user_id) {
          profileMap.set(profile.user_id, profile);
        }
      });

      // Merge UserProfile data with User data, prioritizing UserProfile
      const usersWithProfiles = filteredUsers.map((user) => {
        const profile = profileMap.get(user.id) || profileMap.get(user._id);

        return {
          ...user,
          job_title: profile?.job_title || user.job_title || '',
          department: profile?.department || user.department || '',
          bio: profile?.bio || user.bio || '',
          phone: profile?.phone || user.phone || '',
        };
      });

      return usersWithProfiles;
    },
    enabled: !!currentUser,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => !user.is_super_admin) // Exclude Super Admins
      .filter(user => !(user.role === 'member' && user.custom_role === 'client')) // Exclude Clients
      .filter(user => {
        const searchLower = searchQuery.toLowerCase();
        const searchMatch = (
          user.full_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.role?.toLowerCase().includes(searchLower) ||
          user.custom_role?.toLowerCase().includes(searchLower) ||
          user.department?.toLowerCase().includes(searchLower)
        );

        // Check against both system role and custom_role for flexible filtering
        let roleMatch = true;
        if (roleFilter !== "all") {
          if (roleFilter === "project_manager") {
            roleMatch = user.role === 'project_manager' || user.custom_role === 'project_manager';
          } else {
            roleMatch = user.role === roleFilter || user.custom_role === roleFilter;
          }
        }

        return searchMatch && roleMatch;
      });
  }, [users, searchQuery, roleFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || roleFilter !== "all";

  const userRole = currentUser?.is_super_admin || currentUser?.role === 'admin' ? 'admin' : 'user';

  if (!currentUser) {
    return null; // Don't show loader, assume context handles initial load or is ready
  }

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="team">
      <FeatureOnboarding
        currentUser={currentUser}
        featureArea="team"
        userRole={userRole}
      />
      <div className="h-[calc(100vh-64px)] flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
        <div className="max-w-7xl mx-auto w-full flex flex-col h-full overflow-hidden relative" style={{ maxWidth: '100%' }}>
          {/* Fixed Header Section */}
          <div className="flex-none z-20 bg-white border-b border-slate-200/60 shadow-sm">
            <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Team Members</h1>
                  <p className="text-slate-600">
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'} in your organization
                  </p>
                </div>

                {/* Search and Filter aligned to the right */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-initial md:w-[300px]">
                    <Input
                      placeholder="Search by name, email, role, or department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/80 backdrop-blur-xl h-9"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-9 px-3 text-sm text-slate-600 hover:shadow-sm flex-shrink-0"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}

                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 w-[140px] text-sm bg-white/80 flex-shrink-0">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-4">

              {/* Team Grid */}
              {isLoading && users.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-48 bg-white/60 backdrop-blur-xl rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
                  <CardContent className="py-12 text-center">
                    <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-600">
                      {searchQuery ? 'No members found matching your search' : 'No team members yet'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredUsers.map((member) => (
                    <Card key={member.id} className="bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Avatar on Left Side */}
                          <div className="relative flex-shrink-0">
                            <Avatar className="h-16 w-16 border-2 border-slate-200 shadow-md">
                              <AvatarImage src={member.profile_image_url || member.profile_picture_url} alt={member.full_name} />
                              <AvatarFallback className="text-base font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1">
                              <PresenceIndicator status={member.presence_status || 'offline'} size="sm" />
                            </div>
                          </div>

                          {/* Information on Right Side */}
                          <div className="flex-1 min-w-0">
                            {/* Name and Role Badges */}
                            <div className="flex items-start gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-slate-900 text-base leading-tight">{member.full_name || 'No Name'}</h3>

                              {/* Role Badges */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Owner: Show both Admin and Owner badges */}
                                {member.custom_role === 'owner' && (
                                  <>
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1.5 py-0">
                                      <Crown className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs px-1.5 py-0">
                                      <Crown className="h-3 w-3 mr-1" />
                                      Owner
                                    </Badge>
                                  </>
                                )}

                                {/* Project Manager: Only show Project Manager badge, NOT Admin */}
                                {member.custom_role === 'project_manager' && (
                                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs px-1.5 py-0">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    Project Manager
                                  </Badge>
                                )}

                                {/* Admin: Only show if NOT owner and NOT project_manager */}
                                {member.role === 'admin' && member.custom_role !== 'owner' && member.custom_role !== 'project_manager' && (
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1.5 py-0">
                                    <Crown className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}

                                {/* Sales */}
                                {(member.role === 'sales' || member.custom_role === 'sales') && (
                                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs px-1.5 py-0">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Sales
                                  </Badge>
                                )}

                                {/* Team Member: Show for regular members */}
                                {((member.role === 'member' || member.role === 'user' || member.role === 'viewer' || member.custom_role === 'member') &&
                                  !['owner', 'sales', 'project_manager', 'admin', 'client'].includes(member.custom_role) &&
                                  member.role !== 'admin' &&
                                  member.custom_role !== 'project_manager') && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-xs px-1.5 py-0">
                                      <Users className="h-3 w-3 mr-1" />
                                      Member
                                    </Badge>
                                  )}
                              </div>
                            </div>

                            {/* Email */}
                            <p className="text-sm text-slate-600 mb-3 truncate">{member.email}</p>

                            {/* Job Title */}
                            {member.job_title && (
                              <div className="mb-2">
                                <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                                  <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                                  {member.job_title}
                                </p>
                              </div>
                            )}

                            {/* Department */}
                            {member.department && (
                              <div className="mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                  <Building2 className="h-3 w-3 text-slate-500" />
                                  {member.department}
                                </span>
                              </div>
                            )}

                            {/* Bio */}
                            {member.bio && (
                              <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                                {member.bio}
                              </p>
                            )}

                            {/* Presence Status */}
                            {member.presence_status && (
                              <div className="mt-3">
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-2 py-0.5 ${member.presence_status === 'online' ? 'bg-green-50 text-green-700 border-green-200' :
                                    member.presence_status === 'busy' ? 'bg-red-50 text-red-700 border-red-200' :
                                      member.presence_status === 'away' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                        'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                >
                                  {member.presence_status.charAt(0).toUpperCase() + member.presence_status.slice(1)}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}