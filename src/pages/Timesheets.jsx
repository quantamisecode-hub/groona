
import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  FileText,
  Loader2,
  Briefcase,
  ShieldAlert
} from "lucide-react";

import TimesheetEntryForm from "../components/timesheets/TimesheetEntryForm";
import TimesheetList from "../components/timesheets/TimesheetList";
import AdminTimesheetDashboard from "../components/timesheets/AdminTimesheetDashboard";
import ApprovalDashboard from "../components/timesheets/ApprovalDashboard";
import SubmitTimesheetsDialog from "../components/timesheets/SubmitTimesheetsDialog";
import TimesheetReportGenerator from "../components/timesheets/TimesheetReportGenerator";
import AlarmsTab from "../components/timesheets/AlarmsTab";
import { toast } from "sonner";
import { useHasPermission } from "../components/shared/usePermissions";
import { useUser } from "../components/shared/UserContext";

import { useNavigate, useSearchParams } from "react-router-dom";
import TimesheetFilters from "../components/timesheets/TimesheetFilters";


export default function TimesheetsPage() {
  // Use global user context to prevent loading spinner on navigation
  const { user: currentUser, effectiveTenantId } = useUser();

  // --- CHECK FOR MISSING TIMESHEET ALERT (Top Level) ---
  const { data: timesheetRestriction } = useQuery({
    queryKey: ['check-restriction', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return false;
      const alerts = await groonabackend.entities.Notification.filter({
        recipient_email: currentUser.email,
        type: 'timesheet_missing_alert',
        status: 'OPEN'
      });
      return alerts.length > 0;
    },
    // STRICTLY ONLY FOR 'viewer' CUSTOM ROLE
    enabled: !!currentUser?.id && currentUser?.custom_role === 'viewer',
    staleTime: 5000
  });

  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeTab, setActiveTab] = useState(
    tabParam === "approvals" ||
      tabParam === "team-timesheets" ||
      tabParam === "reports" ||
      tabParam === "alarms"
      ? tabParam : "my-timesheets"
  );

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const queryClient = useQueryClient();

  const canApproveTimesheets = useHasPermission('can_approve_timesheet');
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_super_admin || currentUser?.custom_role === 'owner';

  // Check if user is PM and get their managed project IDs
  const { data: pmData = { isPM: false, projectIds: [] } } = useQuery({
    queryKey: ['pm-data', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { isPM: false, projectIds: [] };

      const pmRoles = await groonabackend.entities.ProjectUserRole.filter({
        user_id: currentUser.id,
        role: 'project_manager'
      });

      return {
        isPM: pmRoles.length > 0,
        projectIds: pmRoles.map(p => p.project_id)
      };
    },
    enabled: !!currentUser,
  });

  const isPM = pmData.isPM || currentUser?.custom_role === 'project_manager';

  // Fetch user's timesheets (Needed for the "Submit Drafts" button)
  const { data: myTimesheets = [], isLoading: myLoading } = useQuery({
    queryKey: ['my-timesheets', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return groonabackend.entities.Timesheet.filter(
        { user_email: currentUser.email },
        '-date'
      );
    },
    enabled: !!currentUser,
    staleTime: 0, // Ensure fresh data on mount
    refetchInterval: 5000, // Poll every 5s for real-time updates
  });

  // Fetch all timesheets for admin OR Project Manager (PM needs it to see team's work)
  const { data: allTimesheets = [], isLoading: allLoading } = useQuery({
    queryKey: ['all-timesheets', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Timesheet.filter(
        { tenant_id: effectiveTenantId },
        '-date'
      );
    },
    // ENABLE FOR PM AS WELL
    enabled: !!currentUser && (isAdmin || isPM),
    refetchInterval: 5000,
  });

  // Fetch users for reports
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-reports', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      const allUsers = await groonabackend.entities.User.list();
      return allUsers.filter(u => u.tenant_id === effectiveTenantId && !u.is_super_admin && u.custom_role !== 'client');
    },
    enabled: !!currentUser && (isAdmin || isPM) && !!effectiveTenantId,
    refetchInterval: 5000, // Poll every 5s for real-time updates
  });

  // Fetch all managed project IDs (for PM check of unmanaged projects)
  const { data: allManagedProjectIds = new Set() } = useQuery({
    queryKey: ['all-managed-projects', effectiveTenantId],
    queryFn: async () => {
      const allPmAssignments = await groonabackend.entities.ProjectUserRole.filter({
        role: 'project_manager'
      });
      return new Set(allPmAssignments.map(p => p.project_id));
    },
    enabled: !!currentUser && currentUser?.custom_role === 'project_manager',
    staleTime: 60000
  });

  // Switch Data Source Based on Role - PMs now see all sheets too
  const targetTimesheets = (isAdmin || isPM) ? allTimesheets : myTimesheets;
  const isLoading = (isAdmin || isPM) ? allLoading : myLoading;

  const saveTimesheetMutation = useMutation({
    mutationFn: async (data) => {
      if (editingEntry) {
        // Add audit fields on update
        const auditData = {
          ...data,
          last_modified_by_name: currentUser.full_name,
          last_modified_at: new Date().toISOString()
        };
        return groonabackend.entities.Timesheet.update(editingEntry.id, auditData);
      }
      return groonabackend.entities.Timesheet.create(data);
    },
    onSuccess: async (newEntry) => {
      // === NOTIFICATION LOGIC ===
      const wasDraft = !editingEntry || editingEntry.status === 'draft';
      const isSubmission = newEntry.status === 'pending_pm' || newEntry.status === 'pending_admin' || newEntry.status === 'approved';

      if (isSubmission && wasDraft) {
        try {
          // 1. Notify the Submitter (User)
          await groonabackend.entities.Notification.create({
            tenant_id: effectiveTenantId,
            recipient_email: currentUser.email,
            type: 'timesheet_submission',
            title: 'Timesheet Submitted',
            message: `You have successfully submitted a timesheet for task: ${newEntry.task_title}`,
            entity_type: 'timesheet', // Explicitly timesheet
            entity_id: newEntry.id,
            project_id: newEntry.project_id, // Add project_id for routing
            sender_name: 'System'
          });

          // 2. Notify Project Manager(s) if Pending PM
          if (newEntry.status === 'pending_pm') {
            const pmRoles = await groonabackend.entities.ProjectUserRole.filter({
              project_id: newEntry.project_id?.id || newEntry.project_id?._id || newEntry.project_id,
              role: 'project_manager'
            });

            const pmEmails = [...new Set(pmRoles.map(r => r.user_email))];

            await Promise.all(pmEmails.map(email => {
              if (email === currentUser.email) return Promise.resolve();

              return groonabackend.entities.Notification.create({
                tenant_id: effectiveTenantId,
                recipient_email: email,
                type: 'timesheet_approval_needed',
                title: 'Pending PM Approval',
                message: `Task: ${newEntry.task_title} from ${currentUser.full_name} is pending PM approval.`,
                entity_type: 'timesheet',
                entity_id: newEntry.id,
                project_id: newEntry.project_id?.id || newEntry.project_id?._id || newEntry.project_id,
                sender_name: currentUser.full_name
              });
            }));
          }
          // 3. Notify Admin/Owner if Pending Admin (e.g. PM submitted it)
          else if (newEntry.status === 'pending_admin') {
            const allUsers = await groonabackend.entities.User.list();
            const approvers = allUsers.filter(u =>
              u.tenant_id === effectiveTenantId && u.custom_role === 'owner'
            );

            await Promise.all(approvers.map(approver => {
              if (approver.email === currentUser.email) return Promise.resolve(); // Don't notify self

              return groonabackend.entities.Notification.create({
                tenant_id: effectiveTenantId,
                recipient_email: approver.email,
                type: 'timesheet_approval_needed',
                title: 'Pending Admin Approval',
                message: `There is a pending admin timesheet for task: ${newEntry.task_title} by ${currentUser.full_name}`,
                entity_type: 'timesheet',
                entity_id: newEntry.id,
                project_id: newEntry.project_id,
                sender_name: currentUser.full_name
              });
            }));
          }
        } catch (error) {
          console.error("Failed to send submission notifications:", error);
        }
      }

      // === REAL-TIME UPDATE LOGIC ===
      // 1. Determine which cache key to update based on role
      const cacheKey = (isAdmin || isPM)
        ? ['all-timesheets', effectiveTenantId]
        : ['my-timesheets', currentUser?.email];

      // 2. Optimistically update the cache
      queryClient.setQueryData(cacheKey, (oldData) => {
        const list = Array.isArray(oldData) ? oldData : [];
        if (editingEntry) {
          return list.map(item => item.id === newEntry.id ? newEntry : item);
        } else {
          return [newEntry, ...list];
        }
      });

      // 3. Trigger background refreshes to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['bi-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['pending-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['report-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['project-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['task-notifications'] }); // Update notifications immediately

      try {
        await groonabackend.entities.Activity.create({
          tenant_id: effectiveTenantId,
          action: editingEntry ? 'updated' : 'created',
          entity_type: 'task',
          entity_id: newEntry.task_id,
          entity_name: newEntry.task_title,
          project_id: newEntry.project_id,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          details: `Logged ${newEntry.hours}h ${newEntry.minutes}m on ${newEntry.task_title}`,
        });
      } catch (error) {
        console.error('[Timesheets] Failed to log activity:', error);
      }

      // Send email asynchronously after timesheet is successfully logged/submitted
      // This ensures timesheet creation is not affected by email failures
      // Send email for all new timesheet entries (not edits), regardless of status
      if (!editingEntry) {
        // Fire and forget - send email asynchronously after timesheet is created
        setTimeout(async () => {
          try {
            await groonabackend.email.sendTemplate({
              to: currentUser.email,
              templateType: 'timesheet_submitted',
              data: {
                memberName: currentUser.full_name,
                memberEmail: currentUser.email,
                taskTitle: newEntry.task_title || 'N/A',
                date: newEntry.date || new Date().toISOString().split('T')[0],
                hours: newEntry.hours || 0,
                minutes: newEntry.minutes || 0,
                projectName: newEntry.project_name,
                entryCount: 1
              }
            });
          } catch (emailError) {
            console.error('[Timesheets] Failed to send submission email:', emailError);
            // Email failure does not affect timesheet creation
          }
        }, 0);
      }

      toast.success(editingEntry ? 'Timesheet updated!' : 'Time logged successfully!');
      setShowForm(false);
      setEditingEntry(null);
    },
    onError: (error) => {
      console.error('[Timesheets] Save error:', error);
      toast.error('Failed to save timesheet entry');
    },
  });

  const deleteTimesheetMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.Timesheet.delete(id),
    onSuccess: (_, deletedId) => {
      // Optimistic delete
      const cacheKey = (isAdmin || isPM)
        ? ['all-timesheets', effectiveTenantId]
        : ['my-timesheets', currentUser?.email];

      queryClient.setQueryData(cacheKey, (oldData) => {
        return Array.isArray(oldData) ? oldData.filter(t => t.id !== deletedId) : [];
      });

      queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      toast.success('Timesheet entry deleted');
    },
    onError: () => {
      toast.error('Failed to delete timesheet entry');
    },
  });

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    deleteTimesheetMutation.mutate(id);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  // Check if user is PM (moved up or ensured this runs before usage)

  // Fetch all PM emails to exclude their timesheets from other PMs' approval lists
  const { data: allPMEmails = [] } = useQuery({
    queryKey: ['all-pm-emails'],
    queryFn: async () => {
      const users = await groonabackend.entities.User.filter({ custom_role: 'project_manager' });
      return users.map(u => u.email);
    },
    enabled: isPM, // Only need this if we are a PM
  });

  // Stats calculation
  const draftTimesheets = targetTimesheets.filter(t => t.status === 'draft');
  const draftCount = draftTimesheets.length;
  // Count both pending states as "Submitted" for the user stats
  const submittedCount = targetTimesheets.filter(t => t.status === 'pending_pm' || t.status === 'pending_admin' || t.status === 'submitted').length;
  const approvedCount = targetTimesheets.filter(t => t.status === 'approved').length;

  const totalHours = targetTimesheets
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

  const billableHours = targetTimesheets
    .filter(t => t.status === 'approved' && t.is_billable)
    .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

  const nonBillableHours = targetTimesheets
    .filter(t => t.status === 'approved' && !t.is_billable)
    .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

  // Calculate Pending Approvals with strict role logic
  const pendingApprovals = useMemo(() => {
    // 1. Project Managers (Priority check: strictly PM role, even if they are admin)
    if (currentUser?.custom_role === 'project_manager') {
      return allTimesheets.filter(t =>
        (t.status === 'pending_pm' || t.status === 'submitted') &&
        t.user_email !== currentUser.email &&
        !allPMEmails.includes(t.user_email)
      ).length;
    }

    // 2. Owner/Admin sees 'pending_admin'
    if (currentUser?.custom_role === 'owner' || currentUser?.role === 'admin' || currentUser?.is_super_admin) {
      return allTimesheets.filter(t => t.status === 'pending_admin' || t.status === 'submitted').length;
    }

    return 0;
  }, [allTimesheets, currentUser, pmData, allPMEmails, isAdmin]);

  // Fetch appealed alarms count for the badge
  const { data: appealedAlarmsCount = 0 } = useQuery({
    queryKey: ['appealed-alarms-count'],
    queryFn: async () => {
      const appealed = await groonabackend.entities.Notification.filter({ status: 'APPEALED' });
      return appealed.length;
    },
    enabled: isAdmin || isPM,
    refetchInterval: 10000,
  });

  const myDraftEntries = myTimesheets.filter(t => t.status === 'draft');
  const myDraftCount = myDraftEntries.length;

  const uniqueProjects = useMemo(() => {
    const projects = new Map();
    targetTimesheets.forEach(t => {
      if (t.project_id && t.project_name) {
        projects.set(t.project_id, t.project_name);
      }
    });
    return Array.from(projects.entries());
  }, [targetTimesheets]);

  // === CORRECTED: Sorting Logic (Pending First) ===
  const filteredTimesheets = useMemo(() => {
    const result = targetTimesheets.filter(timesheet => {
      const statusMatch = statusFilter === "all" || timesheet.status === statusFilter;
      const projectMatch = projectFilter === "all" || timesheet.project_id === projectFilter;
      const userMatch = userFilter === "all" || timesheet.user_email === userFilter;

      let dateMatch = true;
      if (dateRangeFilter !== "all" && timesheet.date) {
        const timesheetDate = new Date(timesheet.date);
        const now = new Date();
        const daysAgo = Math.floor((now - timesheetDate) / (1000 * 60 * 60 * 24));

        if (dateRangeFilter === "today") dateMatch = daysAgo === 0;
        else if (dateRangeFilter === "week") dateMatch = daysAgo <= 7;
        else if (dateRangeFilter === "month") dateMatch = daysAgo <= 30;
      }

      return statusMatch && projectMatch && dateMatch && userMatch;
    });

    // Custom Sort: 
    // 1. Submitted (Pending) -> High priority
    // 2. Drafts -> High priority
    // 3. Rejected -> Medium priority
    // 4. Approved -> Low priority
    // 5. Date -> Newest first
    const statusPriority = {
      'submitted': 1,
      'pending_pm': 1,
      'pending_admin': 1,
      'draft': 2,
      'rejected': 3,
      'approved': 4
    };

    return result.sort((a, b) => {
      // 1. Sort by system recency (Primary)
      const timeA = new Date(a.last_modified_at || a.created_date || a.date).getTime();
      const timeB = new Date(b.last_modified_at || b.created_date || b.date).getTime();

      if (timeB !== timeA) {
        return timeB - timeA;
      }

      // 2. Fallback to status priority (Secondary)
      const priorityA = statusPriority[a.status] || 5;
      const priorityB = statusPriority[b.status] || 5;

      return priorityA - priorityB;
    });

  }, [targetTimesheets, statusFilter, projectFilter, dateRangeFilter, userFilter]);

  const handleFilterChange = (key, value) => {
    switch (key) {
      case 'statusFilter': setStatusFilter(value); break;
      case 'projectFilter': setProjectFilter(value); break;
      case 'dateRangeFilter': setDateRangeFilter(value); break;
      case 'userFilter': setUserFilter(value); break;
    }
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setProjectFilter("all");
    setDateRangeFilter("all");
    setUserFilter("all");
  };

  const hasActiveFilters = statusFilter !== "all" || projectFilter !== "all" || dateRangeFilter !== "all" || userFilter !== "all";

  // Don't show loader if user is already in context
  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative z-0 h-full overflow-hidden">
      <div className="max-w-[1800px] mx-auto w-full flex flex-col relative h-full">
        {/* Sticky Header Section */}
        <div className="sticky top-0 bg-white border-b border-slate-200/60 pb-4 pt-6 z-30 shadow-sm flex-shrink-0">
          <div className="px-6 md:px-8 pt-0 pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Timesheets</h1>
                <p className="text-slate-600">Track your time and manage work hours</p>
              </div>
              {!showForm && !(isAdmin && currentUser?.custom_role === 'owner') && (
                <div className="flex gap-2">
                  {myDraftCount > 0 && (
                    <Button
                      onClick={() => setShowSubmitDialog(true)}
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Submit {myDraftCount} Draft{myDraftCount > 1 ? 's' : ''}
                    </Button>
                  )}
                  {/* Log Time Button - Always enabled, restriction handled in Timer tab */}
                  <div className="relative group">
                    <Button
                      onClick={() => setShowForm(true)}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Log Time
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            {/* Stats Cards */}
            <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar">
              {(() => {
                const isRestrictedStats = currentUser?.custom_role === 'viewer' || currentUser?.custom_role === 'project_manager';
                const myTotalHoursVal = myTimesheets
                  .filter(t => t.status === 'approved')
                  .reduce((sum, t) => sum + (t.total_minutes || 0), 0) / 60;

                const myApprovedCountVal = myTimesheets.filter(t => t.status === 'approved').length;
                const mySubmittedCountVal = myTimesheets.filter(t => t.status === 'pending_pm' || t.status === 'pending_admin' || t.status === 'submitted').length;
                const myDraftCountVal = myTimesheets.filter(t => t.status === 'draft').length;

                return (
                  <>
                    <Card className="w-[23.8%] min-w-[160px] md:min-w-0 flex-shrink-0 snap-center bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group">
                      <CardContent className="pt-5 pb-5 px-4 md:pt-6 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
                          <div className="order-2 md:order-1 flex-1 min-w-0 mr-2">
                            <p className="text-xs md:text-sm font-medium text-slate-500 truncate mb-1">{isRestrictedStats ? "My Total Hours" : "Total Hours"}</p>
                            <p className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">
                              {isRestrictedStats ? myTotalHoursVal.toFixed(2) : totalHours.toFixed(2)}<span className="text-sm md:text-lg text-slate-400 font-normal ml-0.5">h</span>
                            </p>
                          </div>
                          <div className="order-1 md:order-2 self-start md:self-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                            <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {!isRestrictedStats && (
                      <>
                        <Card className="w-[23.8%] min-w-[160px] md:min-w-0 flex-shrink-0 snap-center bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg hover:border-green-200 transition-all duration-300 group">
                          <CardContent className="pt-5 pb-5 px-4 md:pt-6 md:p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
                              <div className="order-2 md:order-1 flex-1 min-w-0 mr-2">
                                <p className="text-xs md:text-sm font-medium text-slate-500 truncate mb-1">Billable Hours</p>
                                <p className="text-xl md:text-3xl font-bold text-green-600 tracking-tight">
                                  {billableHours.toFixed(2)}<span className="text-sm md:text-lg text-green-400 font-normal ml-0.5">h</span>
                                </p>
                              </div>
                              <div className="order-1 md:order-2 self-start md:self-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md shadow-green-500/20 group-hover:scale-110 transition-transform duration-300">
                                <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="w-[23.8%] min-w-[160px] md:min-w-0 flex-shrink-0 snap-center bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg hover:border-purple-200 transition-all duration-300 group">
                          <CardContent className="pt-5 pb-5 px-4 md:pt-6 md:p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
                              <div className="order-2 md:order-1 flex-1 min-w-0 mr-2">
                                <p className="text-xs md:text-sm font-medium text-slate-500 truncate mb-1">Non-Billable</p>
                                <p className="text-xl md:text-3xl font-bold text-purple-600 tracking-tight">
                                  {nonBillableHours.toFixed(2)}<span className="text-sm md:text-lg text-purple-400 font-normal ml-0.5">h</span>
                                </p>
                              </div>
                              <div className="order-1 md:order-2 self-start md:self-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                                <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                    {/* Approved Card */}
                    <Card className="w-[23.8%] min-w-[160px] md:min-w-0 flex-shrink-0 snap-center bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg hover:border-green-200 transition-all duration-300 group">
                      <CardContent className="pt-5 pb-5 px-4 md:pt-6 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
                          <div className="order-2 md:order-1 flex-1 min-w-0 mr-2">
                            <p className="text-xs md:text-sm font-medium text-slate-500 truncate mb-1">{isRestrictedStats ? "My Approved" : "Approved"}</p>
                            <p className="text-xl md:text-3xl font-bold text-green-600 tracking-tight">
                              {isRestrictedStats ? myApprovedCountVal : approvedCount}
                            </p>
                          </div>
                          <div className="order-1 md:order-2 self-start md:self-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md shadow-green-500/20 group-hover:scale-110 transition-transform duration-300">
                            <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Submitted Card */}
                    <Card className="w-[23.8%] min-w-[160px] md:min-w-0 flex-shrink-0 snap-center bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg hover:border-amber-200 transition-all duration-300 group">
                      <CardContent className="pt-5 pb-5 px-4 md:pt-6 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
                          <div className="order-2 md:order-1 flex-1 min-w-0 mr-2">
                            <p className="text-xs md:text-sm font-medium text-slate-500 truncate mb-1">{isRestrictedStats ? "My Submitted" : "Submitted"}</p>
                            <p className="text-xl md:text-3xl font-bold text-amber-600 tracking-tight">
                              {isRestrictedStats ? mySubmittedCountVal : submittedCount}
                            </p>
                          </div>
                          <div className="order-1 md:order-2 self-start md:self-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-110 transition-transform duration-300">
                            <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Drafts Card */}
                    <Card className="w-[23.8%] min-w-[160px] md:min-w-0 flex-shrink-0 snap-center bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group">
                      <CardContent className="pt-5 pb-5 px-4 md:pt-6 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
                          <div className="order-2 md:order-1 flex-1 min-w-0 mr-2">
                            <p className="text-xs md:text-sm font-medium text-slate-500 truncate mb-1">{isRestrictedStats ? "My Drafts" : "Drafts"}</p>
                            <p className="text-xl md:text-3xl font-bold text-slate-600 tracking-tight">
                              {isRestrictedStats ? myDraftCountVal : draftCount}
                            </p>
                          </div>
                          <div className="order-1 md:order-2 self-start md:self-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md shadow-slate-500/20 group-hover:scale-110 transition-transform duration-300">
                            <FileText className="h-5 w-5 md:h-6 md:w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Tabs Section - Merged with header */}
          {
            !showForm && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-shrink-0 z-20">
                <div className="bg-white/95 backdrop-blur-sm shadow-sm md:px-6 lg:px-0 py-0 md:py-0 mx-8 flex-shrink-0">
                  <div className="flex items-center justify-between gap-2 md:gap-4">

                    {/* Scrollable Tabs List */}
                    <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 w-auto flex-1 md:flex-none justify-start overflow-x-auto h-9 md:h-auto p-0.5 md:p-1 gap-1 hide-scrollbar">
                      <TabsTrigger value="my-timesheets" className="gap-2 whitespace-nowrap text-xs md:text-sm px-2 md:px-3">
                        {isAdmin || isPM ? <Briefcase className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                        {isAdmin || isPM ? "All Timesheets" : "My Timesheets"}
                      </TabsTrigger>
                      {(isAdmin || isPM) && (
                        <>
                          <TabsTrigger value="approvals" className="gap-2 whitespace-nowrap text-xs md:text-sm px-2 md:px-3">
                            <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            Approvals
                            {pendingApprovals > 0 && (
                              <Badge className="ml-1 bg-amber-500 text-white h-4 px-1 text-[10px]">
                                {pendingApprovals}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="alarms" className="gap-2 whitespace-nowrap text-xs md:text-sm px-2 md:px-3">
                            <ShieldAlert className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            Alarms
                            {appealedAlarmsCount > 0 && (
                              <Badge className="ml-1 bg-amber-500 text-white h-4 px-1 text-[10px]">
                                {appealedAlarmsCount}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <TabsTrigger value="team-timesheets" className="gap-2 whitespace-nowrap text-xs md:text-sm px-2 md:px-3">
                            <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            Team Overview
                          </TabsTrigger>
                          <TabsTrigger value="reports" className="gap-2 whitespace-nowrap text-xs md:text-sm px-2 md:px-3">
                            <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            Reports
                          </TabsTrigger>
                        </>
                      )}
                    </TabsList>

                    {/* Responsive Filters Component */}
                    {activeTab === "my-timesheets" && (
                      <div className="flex items-center gap-2">
                        <TimesheetFilters
                          isAdmin={isAdmin}
                          isPM={isPM}
                          users={users}
                          uniqueProjects={uniqueProjects}
                          filters={{
                            statusFilter,
                            projectFilter,
                            dateRangeFilter,
                            userFilter,
                          }}
                          onFilterChange={handleFilterChange}
                          onClearFilters={clearFilters}
                          hasActiveFilters={hasActiveFilters}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Tabs>
            )
          }
        </div >

        {/* Main Content */}
        {
          showForm ? (
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="px-3 pt-3 pb-6 md:pb-8">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="mb-4 pl-0 hover:pl-2 transition-all"
                >
                  ← Back to Timesheets
                </Button>
                <TimesheetEntryForm
                  currentUser={currentUser}
                  effectiveTenantId={effectiveTenantId}
                  onSubmit={(data) => saveTimesheetMutation.mutate(data)}
                  onCancel={handleCancel}
                  initialData={editingEntry}
                  loading={saveTimesheetMutation.isPending}
                />
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-3 pt-3 pb-24 md:pb-32">
                  <TabsContent value="my-timesheets" className="space-y-4 mt-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <TimesheetList
                        timesheets={filteredTimesheets}
                        currentUser={currentUser} // Pass currentUser for timezone logic
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        users={users}
                        // === CRITICAL: Only Admins, Members and Viewers can see Edit/Delete buttons ===
                        showActions={isAdmin || currentUser?.role === 'member' || currentUser?.custom_role === 'viewer'}
                        canEditLocked={isAdmin}
                        groupByDate={true}
                      />
                    )}
                  </TabsContent>

                  {(isAdmin || isPM) && (
                    <>
                      <TabsContent value="approvals" className="mt-4">
                        <ApprovalDashboard currentUser={currentUser} users={users} />
                      </TabsContent>
                      <TabsContent value="alarms" className="mt-4">
                        <AlarmsTab currentUser={currentUser} users={users} />
                      </TabsContent>
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <TabsContent value="team-timesheets" className="mt-4">
                        <AdminTimesheetDashboard
                          currentUser={currentUser}
                          effectiveTenantId={effectiveTenantId}
                          allTimesheets={allTimesheets}
                          loading={allLoading}
                        />
                      </TabsContent>

                      <TabsContent value="reports" className="mt-4">
                        <TimesheetReportGenerator
                          currentUser={currentUser}
                          effectiveTenantId={effectiveTenantId}
                          users={users}
                          allTimesheets={allTimesheets}
                        />
                      </TabsContent>
                    </>
                  )}
                </div>
              </div>
            </Tabs>
          )
        }
      </div >

      {/* Submit Dialog (Only for personal drafts) */}
      < SubmitTimesheetsDialog
        open={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)
        }
        draftEntries={myDraftEntries}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
          queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
        }}
      />
    </div >
  );
}