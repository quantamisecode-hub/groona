import React, { useState, useEffect, useRef, useMemo } from "react";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, Plus, Shield, Users, Settings, BarChart3 } from "lucide-react";
import { useHasPermission } from "../components/shared/usePermissions";
import ApplyLeaveDialog from "../components/leaves/ApplyLeaveDialog.jsx";
import LeavesList from "../components/leaves/LeavesList.jsx";
import LeaveBalances from "../components/leaves/LeaveBalances.jsx";
import LeaveApprovals from "../components/leaves/LeaveApprovals.jsx";
import LeaveTypesConfig from "../components/leaves/LeaveTypesConfig.jsx";
import CompOffManager from "../components/leaves/CompOffManager.jsx";
import LeaveOverviewDashboard from "../components/leaves/LeaveOverviewDashboard.jsx";
import LeaveGuide from "../components/leaves/LeaveGuide.jsx";
import AnnualAllocationButton from "../components/leaves/AnnualAllocationButton.jsx";
import IndividualAllocationButton from "../components/leaves/IndividualAllocationButton.jsx";
import AllMemberBalances from "../components/leaves/AllMemberBalances.jsx";
import TeamCalendar from "../components/leaves/TeamCalendar.jsx";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { useUser } from "../components/shared/UserContext";

export default function PlannedLeavesPage() {
  // Use global user context to prevent loading spinner on navigation
  const { user: currentUser, effectiveTenantId } = useUser();

  const [activeTab, setActiveTab] = useState("overview");
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  const isAdmin = useHasPermission('can_manage_team');
  const canApproveLeaves = useHasPermission('can_approve_timesheet');
  const isProjectManager = currentUser?.custom_role === 'project_manager';
  const isOwner = currentUser?.custom_role === 'owner';

  // For project managers: fetch projects they manage to get team members
  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles-leaves', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && isProjectManager,
    staleTime: 5 * 60 * 1000,
  });

  const { data: managedProjects = [] } = useQuery({
    queryKey: ['managed-projects-leaves', projectRoles.map(r => r.project_id)],
    queryFn: async () => {
      if (projectRoles.length === 0) return [];
      const projectIds = projectRoles.map(r => r.project_id);
      const allProjects = await groonabackend.entities.Project.list();
      return allProjects.filter(p => projectIds.includes(p.id));
    },
    enabled: isProjectManager && projectRoles.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Get team member emails from projects managed by project manager
  const teamMemberEmails = useMemo(() => {
    if (!isProjectManager || !managedProjects.length) return [];
    const emails = new Set();
    managedProjects.forEach(project => {
      project.team_members?.forEach(member => {
        if (member.email && member.email !== currentUser?.email) {
          emails.add(member.email);
        }
      });
    });
    return Array.from(emails);
  }, [managedProjects, isProjectManager, currentUser?.email]);

  // === WebSocket Connection ===
  useEffect(() => {
    if (!effectiveTenantId) return;

    const socketUrl = API_BASE;
    socketRef.current = io(socketUrl);

    socketRef.current.on("connect", () => {
      console.log("[PlannedLeaves] Socket connected");
      socketRef.current.emit("join_room", effectiveTenantId);
    });

    socketRef.current.on("leave_change", (data) => {
      console.log("[PlannedLeaves] Update received:", data);
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['all-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['comp-off-credits'] });
      queryClient.invalidateQueries({ queryKey: ['my-leaves-overview'] });
      toast.info("Leave data updated");
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [effectiveTenantId, queryClient]);

  // === Queries ===
  // For project managers: show their own leaves (not admin, so they see their personal leaves)
  const { data: myLeaves = [] } = useQuery({
    queryKey: ['my-leaves', currentUser?.email],
    queryFn: () => groonabackend.entities.Leave.filter({
      user_email: currentUser.email
    }, '-created_date'),
    enabled: !!currentUser && (!isAdmin || isProjectManager), // Project managers see their own leaves
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  // Fetch all users in tenant to identify project managers
  const { data: allTenantUsers = [] } = useQuery({
    queryKey: ['all-tenant-users', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId);
    },
    enabled: !!effectiveTenantId && isProjectManager,
    staleTime: 5 * 60 * 1000,
  });

  // Get emails of all project managers in the tenant (excluding current user)
  const otherProjectManagerEmails = useMemo(() => {
    if (!isProjectManager || !allTenantUsers.length) return [];
    return allTenantUsers
      .filter(u => u.custom_role === 'project_manager' && u.email !== currentUser?.email)
      .map(u => u.email);
  }, [allTenantUsers, isProjectManager, currentUser?.email]);

  // For approvals: owners see all leaves, project managers see all tenant team members' leaves (excluding other project managers and themselves)
  const { data: allLeaves = [] } = useQuery({
    queryKey: ['all-leaves', effectiveTenantId, isProjectManager, otherProjectManagerEmails],
    queryFn: async () => {
      const allLeavesData = await groonabackend.entities.Leave.filter({
        tenant_id: effectiveTenantId
      }, '-created_date');

      // If project manager (not owner), filter to exclude:
      // 1. Their own leaves
      // 2. Other project managers' leaves
      if (isProjectManager && !isOwner) {
        return allLeavesData.filter(leave =>
          leave.user_email !== currentUser?.email && // Exclude project manager's own leaves
          !otherProjectManagerEmails.includes(leave.user_email) // Exclude other project managers' leaves
        );
      }

      return allLeavesData;
    },
    enabled: !!effectiveTenantId && (isAdmin || canApproveLeaves || isProjectManager),
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  // Don't show loader if user is already in context
  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative z-0 h-[calc(100vh-5rem)] overflow-hidden">
      <div className="max-w-10xl mx-auto w-full flex flex-col relative h-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Sticky Header Section */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-200/60 shadow-sm flex-shrink-0 pb-4">
            <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                    Leave Management
                  </h1>
                  <p className="text-slate-600">
                    {isAdmin && !isProjectManager
                      ? "Manage employee leaves, approvals, and configurations"
                      : isProjectManager
                        ? "Apply for leave, track balances, and approve team members' leaves"
                        : "Apply for leave, track balances, and manage approvals"
                    }
                  </p>
                </div>

                {(!isAdmin || isProjectManager) && (
                  <Button
                    onClick={() => setShowApplyDialog(true)}
                    data-onboarding="apply-leave-button"
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Apply Leave
                  </Button>
                )}
              </div>
            </div>

            {/* Sticky Tabs Section */}
            <div className="px-4 md:px-6 lg:px-8 pb-0">
              <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 w-full justify-start overflow-x-auto h-auto p-1 gap-1 hide-scrollbar snap-x">
                <TabsTrigger value="overview" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                  <Calendar className="h-4 w-4" /> Overview
                </TabsTrigger>

                {(!isAdmin || isProjectManager) && (
                  <>
                    <TabsTrigger value="my-leaves" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                      <Calendar className="h-4 w-4" /> My Leaves
                    </TabsTrigger>
                    <TabsTrigger value="balances" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                      <Calendar className="h-4 w-4" /> Balances
                    </TabsTrigger>
                  </>
                )}

                {(isAdmin || canApproveLeaves || isProjectManager) && (
                  <TabsTrigger value="approvals" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                    <Users className="h-4 w-4" /> Approvals
                    {allLeaves.filter(l => l.status === 'submitted').length > 0 && (
                      <Badge className="ml-1 bg-orange-500 text-white h-5 px-1.5 min-w-[1.25rem]">
                        {allLeaves.filter(l => l.status === 'submitted').length}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}

                {(isAdmin || isProjectManager) && (
                  <>
                    <TabsTrigger value="team-calendar" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                      <Calendar className="h-4 w-4" /> Team Calendar
                    </TabsTrigger>
                    <TabsTrigger value="team-balances" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                      <BarChart3 className="h-4 w-4" /> Team Balances
                    </TabsTrigger>
                  </>
                )}

                {isAdmin && !isProjectManager && (
                  <>
                    <TabsTrigger value="comp-off" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                      <Calendar className="h-4 w-4" /> Comp Off
                    </TabsTrigger>
                    <TabsTrigger value="config" className="flex-shrink-0 gap-2 whitespace-nowrap snap-start">
                      <Settings className="h-4 w-4" /> Configuration
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 md:px-6 lg:px-5 pb-24 md:pb-32 pt-4">
              <TabsContent value="overview" className="mt-4 space-y-6">
                <LeaveOverviewDashboard currentUser={currentUser} tenantId={effectiveTenantId} onApplyLeave={() => setShowApplyDialog(true)} />
                <LeaveGuide />
              </TabsContent>

              {(!isAdmin || isProjectManager) && (
                <>
                  <TabsContent value="my-leaves" className="mt-4">
                    <LeavesList leaves={myLeaves} currentUser={currentUser} showActions={true} />
                  </TabsContent>
                  <TabsContent value="balances" className="mt-4">
                    <LeaveBalances currentUser={currentUser} tenantId={effectiveTenantId} />
                  </TabsContent>
                </>
              )}

              {(isAdmin || canApproveLeaves || isProjectManager) && (
                <TabsContent value="approvals" className="mt-4">
                  <LeaveApprovals
                    leaves={allLeaves}
                    currentUser={currentUser}
                    tenantId={effectiveTenantId}
                    isProjectManager={isProjectManager}
                    otherProjectManagerEmails={otherProjectManagerEmails}
                  />
                </TabsContent>
              )}

              {(isAdmin || isProjectManager) && (
                <>
                  <TabsContent value="team-calendar" className="mt-4">
                    <TeamCalendar currentUser={currentUser} tenantId={effectiveTenantId} />
                  </TabsContent>

                  <TabsContent value="team-balances" className="mt-4">
                    <AllMemberBalances tenantId={effectiveTenantId} />
                  </TabsContent>
                </>
              )}

              {isAdmin && !isProjectManager && (
                <>
                  <TabsContent value="comp-off" className="mt-4">
                    <CompOffManager currentUser={currentUser} tenantId={effectiveTenantId} />
                  </TabsContent>

                  <TabsContent value="config" className="mt-4">
                    <div className="flex justify-end mb-4 gap-2">
                      <IndividualAllocationButton tenantId={effectiveTenantId} />
                    </div>
                    <LeaveTypesConfig tenantId={effectiveTenantId} currentUser={currentUser} />
                  </TabsContent>
                </>
              )}
            </div>
          </div>
        </Tabs>
      </div>

      <ApplyLeaveDialog
        open={showApplyDialog}
        onClose={() => setShowApplyDialog(false)}
        currentUser={currentUser}
        tenantId={effectiveTenantId}
      />
    </div>
  );
}